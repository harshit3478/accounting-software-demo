import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import prisma from "../../../../../lib/prisma";
import {
  groupInvoiceSpreadsheetRows,
  getBulkRowItemPricing,
  parseInvoiceSpreadsheet,
  validateInvoiceSheetRows,
} from "../../../../../lib/invoice-bulk-sheet";
import {
  generateInvoiceNumber,
  calculateInvoiceStatus,
} from "../../../../../lib/invoice-utils";
import {
  CUSTOMER_EMAIL_EXISTS_ERROR,
  customerEmailErrorResponse,
  findCustomerByEmail,
  normalizeCustomerEmail,
} from "../../../../../lib/customer-email";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const skipMissingCustomers =
      String(formData.get("skipMissingCustomers") || "false") === "true";
    const customerEmailOverridesRaw = String(
      formData.get("customerEmailOverrides") || "{}",
    );
    let customerEmailOverrides: Record<string, string> = {};

    try {
      const parsedOverrides = JSON.parse(customerEmailOverridesRaw);
      if (parsedOverrides && typeof parsedOverrides === "object") {
        customerEmailOverrides = Object.fromEntries(
          Object.entries(parsedOverrides).map(([key, value]) => [
            key,
            String(value || "")
              .trim()
              .toLowerCase(),
          ]),
        );
      }
    } catch {
      customerEmailOverrides = {};
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const rows = await parseInvoiceSpreadsheet(file);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "Spreadsheet has no invoice rows",
        },
        { status: 400 },
      );
    }

    const { invalidRows } = validateInvoiceSheetRows(rows);

    if (invalidRows.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed. All rows must be valid before upload.",
          validationErrors: invalidRows,
        },
        { status: 400 },
      );
    }

    // Create all invoices in a transaction
    const createdInvoices = await prisma.$transaction(async (tx) => {
      const invoices = [];
      const groupedRows = groupInvoiceSpreadsheetRows(rows, {
        emailOverrides: customerEmailOverrides,
      });

      // Get starting invoice number
      const year = new Date().getFullYear();
      const lastInvoice = await tx.invoice.findFirst({
        where: {
          invoiceNumber: {
            startsWith: `INV-${year}-`,
          },
        },
        orderBy: {
          invoiceNumber: "desc",
        },
      });

      let nextNumber = 1;
      if (lastInvoice) {
        const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-")[2]);
        nextNumber = lastNumber + 1;
      }

      for (const group of groupedRows) {
        const representativeRow = group.rows[0];
        const email = normalizeCustomerEmail(
          group.email || representativeRow?.email,
        );
        let customerId: number | null = null;
        let customerName = representativeRow?.name || "Bulk Imported Customer";

        if (email) {
          const existingCustomer = await findCustomerByEmail(tx, email, {
            id: true,
            name: true,
          });

          if (existingCustomer) {
            customerId = existingCustomer.id;
            customerName = existingCustomer.name;
          } else if (skipMissingCustomers) {
            continue;
          } else {
            try {
              const createdCustomer = await tx.customer.create({
                data: {
                  name: customerName,
                  email,
                },
                select: { id: true, name: true },
              });
              customerId = createdCustomer.id;
              customerName = createdCustomer.name;
            } catch (createError) {
              const emailError = customerEmailErrorResponse(createError);
              if (emailError) {
                throw new Error(CUSTOMER_EMAIL_EXISTS_ERROR);
              }
              throw createError;
            }
          }
        } else {
          continue;
        }

        const subtotal = group.rows.reduce(
          (sum, row) => sum + Number(row.amount || 0),
          0,
        );
        const insuranceAmount = group.rows.reduce(
          (sum, row) => sum + Number(row.insurance || 0),
          0,
        );
        const shippingFee = group.rows.reduce(
          (sum, row) => sum + Number(row.shipping || 0),
          0,
        );
        const tax = 0;
        const discount = 0;
        const amount = subtotal + insuranceAmount + shippingFee;
        const dueDateRow = group.rows.find((row) => row.dueDate);
        const dueDate = dueDateRow?.dueDate
          ? new Date(dueDateRow.dueDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const isLayaway = group.rows.some((row) => row.isLayaway === true);
        const externalInvoiceNumber =
          group.rows
            .find((row) => row.externalInvoiceNumber?.trim())
            ?.externalInvoiceNumber?.trim() || null;

        const liveTypeName =
          group.rows.find((row) => row.liveType?.trim())?.liveType?.trim() ||
          undefined;
        const liveTypeCountry =
          group.rows.find((row) => row.country?.trim())?.country?.trim() ||
          undefined;
        let liveTypeId: number | null = null;
        let liveTypeSnapshot: string | null = null;

        if (liveTypeName) {
          const liveTypeModel = (tx as any).liveType;
          if (liveTypeModel) {
            let foundLiveType = await liveTypeModel.findFirst({
              where: {
                name: liveTypeName,
                ...(liveTypeCountry ? { country: liveTypeCountry } : {}),
              },
              orderBy: { id: "asc" },
            });

            if (!foundLiveType) {
              foundLiveType = await liveTypeModel.findUnique({
                where: { name: liveTypeName },
              });
            }

            if (!foundLiveType) {
              try {
                foundLiveType = await liveTypeModel.create({
                  data: {
                    name: liveTypeName,
                    country: liveTypeCountry || "",
                    isActive: true,
                    isDefault: false,
                    sortOrder: 0,
                    createdBy: user.id,
                  },
                });
              } catch (createError: any) {
                if (createError?.code === "P2002") {
                  foundLiveType = await liveTypeModel.findUnique({
                    where: { name: liveTypeName },
                  });
                } else {
                  throw createError;
                }
              }
            }

            if (foundLiveType) {
              liveTypeId = foundLiveType.id;
              liveTypeSnapshot = `${foundLiveType.name} (${foundLiveType.country})`;
            }
          }

          if (!liveTypeSnapshot) {
            liveTypeSnapshot = liveTypeCountry
              ? `${liveTypeName} (${liveTypeCountry})`
              : liveTypeName;
          }
        }

        // Generate sequential invoice number
        const invoiceNumber = `INV-${year}-${nextNumber.toString().padStart(4, "0")}`;
        nextNumber++;

        const items = group.rows.map((row) => {
          const { quantity, price } = getBulkRowItemPricing(row);

          return {
            name: row.description?.trim() || "Bulk imported item",
            quantity,
            price,
            unit: row.unit?.trim() || undefined,
            liveType: row.liveType?.trim() || undefined,
            country: row.country?.trim() || undefined,
            vca116g: Number(row.vca116g || 0),
            k18_121g: Number(row.k18_121g || 0),
            vca118g: Number(row.vca118g || 0),
          };
        });

        // Calculate initial status
        const status = calculateInvoiceStatus(amount, 0, dueDate);

        // Create invoice
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            clientName: customerName,
            customerId,
            items,
            subtotal,
            tax,
            discount,
            shippingFee,
            insuranceAmount,
            amount,
            paidAmount: 0,
            dueDate,
            status,
            isLayaway,
            description: null,
            userId: user.id,
            externalInvoiceNumber,
            source: "xlsx_upload",
            liveTypeId,
            liveTypeSnapshot,
          },
        });

        await tx.invoiceEditHistory.create({
          data: {
            invoiceId: invoice.id,
            editedById: user.id,
            reason: "Invoice created via bulk upload",
            changes: {
              source: { from: null, to: "xlsx_upload" },
            },
          },
        });

        invoices.push(invoice);
      }

      return invoices;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdInvoices.length} invoice(s)`,
      count: createdInvoices.length,
      invoiceIds: createdInvoices.map((inv) => inv.id),
    });
  } catch (error: any) {
    console.error("Bulk upload spreadsheet invoices error:", error);
    const emailError = customerEmailErrorResponse(error);
    if (emailError) {
      return NextResponse.json(
        { error: emailError.message },
        { status: emailError.status },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
