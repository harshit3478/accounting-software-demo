import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireSuperAdmin } from "../../../../../lib/auth";
import { getBusinessTodayString } from "../../../../../lib/business-date";
import { workbookToBuffer } from "../../../../../lib/invoice-bulk-sheet";
import prisma from "../../../../../lib/prisma";
import {
  createQuickBooksClient,
  fetchAllCustomersFromQuickBooks,
  refreshQuickBooksToken,
} from "../../../../../lib/quickbooks";

function formatAddress(addr: any): string {
  if (!addr || typeof addr !== "object") return "";
  return [
    addr.Line1,
    addr.Line2,
    addr.City,
    addr.CountrySubDivisionCode,
    addr.PostalCode,
    addr.Country,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

function mapCustomerRow(customer: any): Record<string, string | number | boolean> {
  return {
    Id: customer?.Id ?? "",
    DisplayName: customer?.DisplayName ?? "",
    CompanyName: customer?.CompanyName ?? "",
    GivenName: customer?.GivenName ?? "",
    FamilyName: customer?.FamilyName ?? "",
    Email: customer?.PrimaryEmailAddr?.Address ?? "",
    Phone: customer?.PrimaryPhone?.FreeFormNumber ?? "",
    Mobile: customer?.Mobile?.FreeFormNumber ?? "",
    BillingAddress: formatAddress(customer?.BillAddr),
    ShippingAddress: formatAddress(customer?.ShipAddr),
    Balance: Number(customer?.Balance ?? 0),
    Active: customer?.Active !== false,
    Notes: typeof customer?.Notes === "string" ? customer.Notes : "",
    CreatedAt: customer?.MetaData?.CreateTime ?? "",
    UpdatedAt: customer?.MetaData?.LastUpdatedTime ?? "",
  };
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

async function resolveQuickBooksUserId(superAdminId: number): Promise<number | null> {
  const own = await prisma.quickBooksConnection.findUnique({
    where: { userId: superAdminId },
    select: { userId: true, isActive: true },
  });
  if (own?.isActive) return own.userId;

  const anyActive = await prisma.quickBooksConnection.findFirst({
    where: { isActive: true },
    select: { userId: true },
    orderBy: { updatedAt: "desc" },
  });
  return anyActive?.userId ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const number = parsePositiveInt(searchParams.get("number"), 1000);

    const connectionUserId = await resolveQuickBooksUserId(user.id);
    if (!connectionUserId) {
      return NextResponse.json(
        { error: "QuickBooks not connected or inactive" },
        { status: 400 },
      );
    }

    let qbo = await createQuickBooksClient(connectionUserId);
    if (!qbo) {
      return NextResponse.json(
        { error: "Failed to create QuickBooks client" },
        { status: 500 },
      );
    }

    let customers: any[];
    try {
      customers = await fetchAllCustomersFromQuickBooks(qbo);
    } catch (error: any) {
      const isAuthError =
        error?.statusCode === 401 ||
        error?.fault?.type === "AUTHENTICATION" ||
        JSON.stringify(error).includes("AuthenticationFailed");

      if (!isAuthError) throw error;

      await refreshQuickBooksToken(connectionUserId);
      qbo = await createQuickBooksClient(connectionUserId);
      if (!qbo) {
        return NextResponse.json(
          { error: "Failed to recreate QuickBooks client after refresh" },
          { status: 500 },
        );
      }
      customers = await fetchAllCustomersFromQuickBooks(qbo);
    }

    const totalCustomers = customers.length;
    const start = (page - 1) * number;
    const pageCustomers = customers.slice(start, start + number);
    const rows = pageCustomers.map(mapCustomerRow);

    // Summary row at the bottom of the sheet
    rows.push({
      Id: "",
      DisplayName: "Total Customers",
      CompanyName: totalCustomers,
      GivenName: "",
      FamilyName: "",
      Email: "",
      Phone: "",
      Mobile: "",
      BillingAddress: "",
      ShippingAddress: "",
      Balance: "",
      Active: "",
      Notes: `Page ${page} · Showing ${pageCustomers.length} of ${totalCustomers}`,
      CreatedAt: "",
      UpdatedAt: "",
    } as any);

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 28 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
      { wch: 28 },
      { wch: 16 },
      { wch: 16 },
      { wch: 40 },
      { wch: 40 },
      { wch: 12 },
      { wch: 10 },
      { wch: 40 },
      { wch: 22 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    const fileBuffer = workbookToBuffer(workbook);

    const timestamp = getBusinessTodayString();
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="quickbooks-customers-${timestamp}-page-${page}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("QuickBooks customers export error:", error);

    if (error.message === "Super admin access required") {
      return NextResponse.json(
        { error: "Only superadmin can export QuickBooks customers" },
        { status: 403 },
      );
    }

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || "Failed to export QuickBooks customers" },
      { status: 500 },
    );
  }
}
