import Papa from "papaparse";
import * as XLSX from "xlsx";
import { PaymentRow } from "./csv-validation";
import { toBusinessDateString } from "./business-date";

const HEADER_ALIASES: Record<keyof PaymentRow, string[]> = {
  amount: ["AMOUNT"],
  paymentDate: ["PAYMENTDATE", "PAYMENT DATE", "DATE"],
  method: ["METHOD", "PAYMENTMETHOD", "PAYMENT METHOD"],
  notes: ["NOTES", "NOTE"],
  invoiceNumber: ["INVOICENUMBER", "INVOICE NUMBER", "INVOICE#", "INVOICE"],
  clientName: ["CLIENTNAME", "CLIENT NAME", "CLIENT", "CUSTOMER", "CUSTOMERNAME"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9#/]/g, "");
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const aliasSet = new Set(aliases.map((alias) => normalizeHeader(alias)));
  return headers.findIndex((header) => aliasSet.has(header));
}

function findHeaderRow(rows: unknown[][]): number {
  const maxRowsToScan = Math.min(rows.length, 10);

  for (let i = 0; i < maxRowsToScan; i++) {
    const normalized = (rows[i] || []).map(normalizeHeader);
    const hasAmount = findColumnIndex(normalized, HEADER_ALIASES.amount) !== -1;
    const hasDate =
      findColumnIndex(normalized, HEADER_ALIASES.paymentDate) !== -1;
    const hasMethod = findColumnIndex(normalized, HEADER_ALIASES.method) !== -1;

    if (hasAmount && hasDate && hasMethod) {
      return i;
    }
  }

  return rows.length > 0 ? 0 : -1;
}

function formatAmount(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return String(value ?? "")
    .trim()
    .replace(/[$,]/g, "");
}

function formatPaymentDate(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return toBusinessDateString(date);
  }

  return raw;
}

async function parseCsvPaymentRows(file: File): Promise<PaymentRow[]> {
  const text = await file.text();
  const filteredText = text
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
  const parseResult = Papa.parse<PaymentRow>(filteredText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => value.trim(),
  });

  if (parseResult.errors.length > 0) {
    throw new Error("CSV parsing error");
  }

  return parseResult.data;
}

async function parseXlsxPaymentRows(file: File): Promise<PaymentRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("No worksheet found in file");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: "",
  }) as unknown[][];

  if (rows.length === 0) {
    return [];
  }

  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex === -1) {
    throw new Error(
      "Could not find a valid header row. Expected amount, paymentDate, and method columns.",
    );
  }

  const normalizedHeaders = (rows[headerRowIndex] || []).map(normalizeHeader);
  const columnMap = {
    amount: findColumnIndex(normalizedHeaders, HEADER_ALIASES.amount),
    paymentDate: findColumnIndex(normalizedHeaders, HEADER_ALIASES.paymentDate),
    method: findColumnIndex(normalizedHeaders, HEADER_ALIASES.method),
    notes: findColumnIndex(normalizedHeaders, HEADER_ALIASES.notes),
    invoiceNumber: findColumnIndex(
      normalizedHeaders,
      HEADER_ALIASES.invoiceNumber,
    ),
    clientName: findColumnIndex(normalizedHeaders, HEADER_ALIASES.clientName),
  };

  if (
    columnMap.amount === -1 ||
    columnMap.paymentDate === -1 ||
    columnMap.method === -1
  ) {
    throw new Error("amount, paymentDate, and method columns are required.");
  }

  const parsedRows: PaymentRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const hasAnyContent = row.some((cell) => String(cell ?? "").trim() !== "");
    if (!hasAnyContent) continue;

    const amount = formatAmount(row[columnMap.amount]);
    const paymentDate = formatPaymentDate(row[columnMap.paymentDate]);
    const method = String(row[columnMap.method] ?? "").trim();

    if (!amount && !paymentDate && !method) continue;

    parsedRows.push({
      amount,
      paymentDate,
      method,
      notes:
        columnMap.notes >= 0
          ? String(row[columnMap.notes] ?? "").trim() || undefined
          : undefined,
      invoiceNumber:
        columnMap.invoiceNumber >= 0
          ? String(row[columnMap.invoiceNumber] ?? "").trim() || undefined
          : undefined,
      clientName:
        columnMap.clientName >= 0
          ? String(row[columnMap.clientName] ?? "").trim() || undefined
          : undefined,
    });
  }

  return parsedRows;
}

export async function parsePaymentSpreadsheet(file: File): Promise<PaymentRow[]> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    return parseCsvPaymentRows(file);
  }

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    return parseXlsxPaymentRows(file);
  }

  throw new Error("Unsupported file format. Upload a CSV or XLSX file.");
}

export function buildPaymentSheetWorkbook(
  exampleMethods: string[] = ["Cash", "Zelle"],
): XLSX.WorkBook {
  const method1 = exampleMethods[0] ?? "Cash";
  const method2 = exampleMethods[1] ?? method1;
  const methodsList =
    exampleMethods.length > 0 ? exampleMethods.join(", ") : "Cash, Zelle";

  const aoa: Array<Array<string | number>> = [
    ["", "PAYMENT BULK UPLOAD SHEET"],
    ["", `Accepted methods (case-insensitive): ${methodsList}`],
    [""],
    [
      "amount",
      "paymentDate",
      "method",
      "notes",
      "invoiceNumber",
      "clientName",
    ],
    [
      1250,
      "2025-01-15",
      method1,
      "January payment",
      "",
      "",
    ],
    [850, "2025-01-16", method2, "", "", ""],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!merges"] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 5 } },
  ];
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 24 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Payments");

  return workbook;
}

export function paymentWorkbookToBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}

export function buildPaymentCsvTemplate(
  exampleMethods: string[] = ["Cash", "Zelle"],
): string {
  const method1 = exampleMethods[0] ?? "Cash";
  const method2 = exampleMethods[1] ?? method1;
  const methodsList =
    exampleMethods.length > 0 ? exampleMethods.join(", ") : "Cash, Zelle";
  const headers = "amount,paymentDate,method,notes,invoiceNumber,clientName";
  const exampleRow1 = `1250.00,2025-01-15,${method1},January payment,,`;
  const exampleRow2 = `850.00,2025-01-16,${method2},,,`;
  return [
    `# Accepted methods (case-insensitive): ${methodsList}`,
    headers,
    exampleRow1,
    exampleRow2,
  ].join("\n");
}
