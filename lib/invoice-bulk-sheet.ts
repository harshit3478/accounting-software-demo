import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface SpreadsheetInvoiceRow {
  name: string;
  email?: string;
  description: string;
  vca116g: number;
  k18_121g: number;
  vca118g: number;
  amount: number;
  insurance?: number;
  shipping?: number;
  dueDate?: string;
  isLayaway?: boolean;
  externalInvoiceNumber?: string;
  rowNumber: number;
}

export interface InvoiceSheetValidationError {
  row: number;
  errors: string[];
}

export interface InvoiceSheetDuplicate {
  rows: number[];
  reason: string;
}

const HEADER_ALIASES: Record<string, string[]> = {
  index: ["#", "NO", "NUMBER", "SR", "SRNO", "SERIAL"],
  name: ["NAME", "CLIENT", "CLIENTNAME", "CUSTOMER", "CUSTOMERNAME"],
  email: ["EMAIL", "E-MAIL", "CLIENTEMAIL", "CUSTOMEREMAIL"],
  description: ["DESCRIPTION", "DESC", "ITEM", "ITEMS"],
  vca116g: ["VCA116G", "VCA116/G"],
  k18_121g: ["18K121/G", "18K121G"],
  vca118g: ["VCA118G", "VCA118/G"],
  amount: ["AMOUNT", "TOTAL", "INVOICEAMOUNT"],
  insurance: ["INSURANCE", "INSURANCEAMOUNT"],
  shipping: ["SHIPPING", "SHIPPINGFEE", "SHIPPINGAMOUNT"],
  dueDate: ["DUEDATE", "DUE", "DUE_DATE"],
  isLayaway: ["ISLAYAWAY", "LAYAWAY"],
  externalInvoiceNumber: [
    "EXTERNALINVOICENUMBER",
    "EXTERNALINVOICE",
    "EXTERNAL#",
  ],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9#/]/g, "");
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[$,]/g, "");
  if (!cleaned) return NaN;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseOptionalNumber(value: unknown): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const parsed = parseNumber(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseBoolean(value: unknown): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1";
}

function parseDate(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString().split("T")[0];
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const aliasSet = new Set(aliases.map((a) => normalizeHeader(a)));
  return headers.findIndex((header) => aliasSet.has(header));
}

function findHeaderRow(rows: unknown[][]): number {
  const maxRowsToScan = Math.min(rows.length, 30);

  for (let i = 0; i < maxRowsToScan; i++) {
    const normalized = (rows[i] || []).map(normalizeHeader);
    const hasName = findColumnIndex(normalized, HEADER_ALIASES.name) !== -1;
    const hasAmount = findColumnIndex(normalized, HEADER_ALIASES.amount) !== -1;

    if (hasName && hasAmount) {
      return i;
    }
  }

  return -1;
}

async function parseCsvRows(file: File): Promise<unknown[][]> {
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: false,
  });

  if (parsed.errors.length > 0) {
    throw new Error("CSV parsing error");
  }

  return parsed.data as unknown[][];
}

async function parseXlsxRows(file: File): Promise<unknown[][]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("No worksheet found in file");
  }

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: "",
  }) as unknown[][];
}

export async function parseInvoiceSpreadsheet(
  file: File,
): Promise<SpreadsheetInvoiceRow[]> {
  const lowerName = file.name.toLowerCase();
  const rows = lowerName.endsWith(".csv")
    ? await parseCsvRows(file)
    : await parseXlsxRows(file);

  if (rows.length === 0) {
    return [];
  }

  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex === -1) {
    throw new Error(
      "Could not find a valid header row. Expected at least NAME and AMOUNT columns.",
    );
  }

  const normalizedHeaders = (rows[headerRowIndex] || []).map(normalizeHeader);

  const columnMap = {
    name: findColumnIndex(normalizedHeaders, HEADER_ALIASES.name),
    email: findColumnIndex(normalizedHeaders, HEADER_ALIASES.email),
    description: findColumnIndex(normalizedHeaders, HEADER_ALIASES.description),
    vca116g: findColumnIndex(normalizedHeaders, HEADER_ALIASES.vca116g),
    k18_121g: findColumnIndex(normalizedHeaders, HEADER_ALIASES.k18_121g),
    vca118g: findColumnIndex(normalizedHeaders, HEADER_ALIASES.vca118g),
    amount: findColumnIndex(normalizedHeaders, HEADER_ALIASES.amount),
    insurance: findColumnIndex(normalizedHeaders, HEADER_ALIASES.insurance),
    shipping: findColumnIndex(normalizedHeaders, HEADER_ALIASES.shipping),
    dueDate: findColumnIndex(normalizedHeaders, HEADER_ALIASES.dueDate),
    isLayaway: findColumnIndex(normalizedHeaders, HEADER_ALIASES.isLayaway),
    externalInvoiceNumber: findColumnIndex(
      normalizedHeaders,
      HEADER_ALIASES.externalInvoiceNumber,
    ),
  };

  if (columnMap.name === -1 || columnMap.amount === -1) {
    throw new Error("NAME and AMOUNT columns are required.");
  }

  const parsedRows: SpreadsheetInvoiceRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];

    const nameValue = String(row[columnMap.name] ?? "").trim();
    const emailValue =
      columnMap.email >= 0
        ? String(row[columnMap.email] ?? "").trim() || undefined
        : undefined;
    const descriptionValue =
      columnMap.description >= 0
        ? String(row[columnMap.description] ?? "").trim()
        : "";

    const amountNumber = parseNumber(row[columnMap.amount]);
    const vca116g =
      columnMap.vca116g >= 0 ? parseNumber(row[columnMap.vca116g]) : NaN;
    const k18_121g =
      columnMap.k18_121g >= 0 ? parseNumber(row[columnMap.k18_121g]) : NaN;
    const vca118g =
      columnMap.vca118g >= 0 ? parseNumber(row[columnMap.vca118g]) : NaN;

    const hasAnyContent = row.some((cell) => String(cell ?? "").trim() !== "");
    if (!hasAnyContent) continue;

    if (
      nameValue.toUpperCase() === "TOTAL" ||
      nameValue.toUpperCase() === "TOTAL:"
    ) {
      continue;
    }

    const calculatedAmount = Number.isFinite(amountNumber)
      ? amountNumber
      : [vca116g, k18_121g, vca118g].reduce((sum, value) => {
          if (Number.isFinite(value)) return sum + value;
          return sum;
        }, 0);

    parsedRows.push({
      name: nameValue,
      email: emailValue,
      description: descriptionValue,
      vca116g: Number.isFinite(vca116g) ? vca116g : 0,
      k18_121g: Number.isFinite(k18_121g) ? k18_121g : 0,
      vca118g: Number.isFinite(vca118g) ? vca118g : 0,
      amount: calculatedAmount,
      insurance:
        columnMap.insurance >= 0
          ? parseOptionalNumber(row[columnMap.insurance])
          : undefined,
      shipping:
        columnMap.shipping >= 0
          ? parseOptionalNumber(row[columnMap.shipping])
          : undefined,
      dueDate:
        columnMap.dueDate >= 0 ? parseDate(row[columnMap.dueDate]) : undefined,
      isLayaway:
        columnMap.isLayaway >= 0
          ? parseBoolean(row[columnMap.isLayaway])
          : undefined,
      externalInvoiceNumber:
        columnMap.externalInvoiceNumber >= 0
          ? String(row[columnMap.externalInvoiceNumber] ?? "").trim() ||
            undefined
          : undefined,
      rowNumber: i + 1,
    });
  }

  return parsedRows;
}

export function validateInvoiceSheetRows(rows: SpreadsheetInvoiceRow[]): {
  invalidRows: InvoiceSheetValidationError[];
  duplicates: InvoiceSheetDuplicate[];
} {
  const invalidRows: InvoiceSheetValidationError[] = [];
  const duplicateMap = new Map<string, number[]>();

  rows.forEach((row) => {
    const errors: string[] = [];

    if (!row.name || row.name.trim().length === 0) {
      errors.push("name: Name is required");
    }

    if (row.email && row.email.trim().length > 0) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(row.email.trim())) {
        errors.push("email: Email must be a valid email address");
      }
    }

    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      errors.push("amount: Amount must be a positive number");
    }

    if (
      row.insurance !== undefined &&
      (!Number.isFinite(row.insurance) || row.insurance < 0)
    ) {
      errors.push("insurance: Insurance must be a number >= 0");
    }

    if (
      row.shipping !== undefined &&
      (!Number.isFinite(row.shipping) || row.shipping < 0)
    ) {
      errors.push("shipping: Shipping must be a number >= 0");
    }

    if (errors.length > 0) {
      invalidRows.push({
        row: row.rowNumber,
        errors,
      });
    }

    const duplicateKey = `${(row.email || "").toLowerCase().trim()}_${row.name.toLowerCase().trim()}_${row.description.toLowerCase().trim()}_${row.amount.toFixed(2)}`;
    if (!duplicateMap.has(duplicateKey)) {
      duplicateMap.set(duplicateKey, []);
    }
    duplicateMap.get(duplicateKey)!.push(row.rowNumber);
  });

  const duplicates: InvoiceSheetDuplicate[] = [];
  duplicateMap.forEach((rowIndexes) => {
    if (rowIndexes.length > 1) {
      duplicates.push({
        rows: rowIndexes,
        reason: "Same name, description and amount",
      });
    }
  });

  return { invalidRows, duplicates };
}

export interface InvoiceSheetExportRow {
  name: string;
  email?: string;
  description: string;
  vca116g?: number;
  k18_121g?: number;
  vca118g?: number;
  amount: number;
  insurance?: number;
  shipping?: number;
}

export function buildInvoiceSheetWorkbook(
  rows: InvoiceSheetExportRow[],
  options?: {
    title?: string;
    subtitle?: string;
  },
): XLSX.WorkBook {
  const title = options?.title || "GOLD CONECTION BY APPLE";
  const subtitle = options?.subtitle || "INVOICE BULK SHEET";

  const aoa: Array<Array<string | number>> = [
    ["", title],
    ["", subtitle],
    [""],
    [
      "#",
      "NAME",
      "EMAIL",
      "DESCRIPTION",
      "VCA 116/G",
      "18K 121/G",
      "VCA 118/G",
      "AMOUNT",
      "INSURANCE",
      "SHIPPING",
    ],
  ];

  let sumVca116g = 0;
  let sum18K121g = 0;
  let sumVca118g = 0;
  let sumAmount = 0;
  let sumInsurance = 0;
  let sumShipping = 0;

  rows.forEach((row, idx) => {
    const vca116g = Number(row.vca116g || 0);
    const k18_121g = Number(row.k18_121g || 0);
    const vca118g = Number(row.vca118g || 0);
    const amount = Number(row.amount || 0);
    const insurance = Number(row.insurance || 0);
    const shipping = Number(row.shipping || 0);

    sumVca116g += vca116g;
    sum18K121g += k18_121g;
    sumVca118g += vca118g;
    sumAmount += amount;
    sumInsurance += insurance;
    sumShipping += shipping;

    aoa.push([
      idx + 1,
      row.name,
      row.email || "",
      row.description,
      vca116g,
      k18_121g,
      vca118g,
      amount,
      insurance,
      shipping,
    ]);
  });

  aoa.push([
    "",
    "TOTAL:",
    "",
    "",
    Number(sumVca116g.toFixed(2)),
    Number(sum18K121g.toFixed(2)),
    Number(sumVca118g.toFixed(2)),
    Number(sumAmount.toFixed(2)),
    Number(sumInsurance.toFixed(2)),
    Number(sumShipping.toFixed(2)),
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!merges"] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 9 } },
  ];
  worksheet["!cols"] = [
    { wch: 5 },
    { wch: 28 },
    { wch: 30 },
    { wch: 38 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");

  return workbook;
}

export function workbookToBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}
