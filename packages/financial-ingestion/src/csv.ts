import { currencyCode, getCurrencyDefinition, type CurrencyCode } from "@afrifinos/financial-domain";
import type { NormalizedTransactionType, RawTransaction } from "@afrifinos/financial-engine";

export interface CsvTransactionRow extends RawTransaction {}

export interface CsvParseError {
  readonly row: number;
  readonly message: string;
}

export interface CsvParseResult {
  readonly rows: readonly CsvTransactionRow[];
  readonly errors: readonly CsvParseError[];
}

const REQUIRED_COLUMNS = ["occurred_at", "description", "amount_minor", "currency"] as const;
const OPTIONAL_COLUMNS = ["external_id", "type", "counterparty"] as const;
const ALLOWED_TYPES: readonly NormalizedTransactionType[] = [
  "income", "expense", "transfer", "fee", "refund", "reversal", "adjustment",
];

function parseCsvRecords(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim() !== "")) records.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("Malformed CSV: unterminated quoted field");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.trim() !== "")) records.push(row);
  return records;
}

function parseAmountMinor(value: string, row: number): bigint {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) {
    throw new Error(`amount_minor must be an integer, received '${value}'`);
  }
  try {
    return BigInt(normalized);
  } catch {
    throw new Error(`Invalid amount_minor at row ${row}`);
  }
}

function parseOccurredAt(value: string, row: number): string {
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid occurred_at at row ${row}: '${value}'`);
  return date.toISOString();
}

function parseCurrency(value: string, row: number): CurrencyCode {
  try {
    const code = currencyCode(value);
    getCurrencyDefinition(code);
    return code;
  } catch {
    throw new Error(`Unsupported currency at row ${row}: '${value}'`);
  }
}

function parseType(value: string | undefined, row: number): NormalizedTransactionType | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (!ALLOWED_TYPES.includes(normalized as NormalizedTransactionType)) {
    throw new Error(`Invalid transaction type at row ${row}: '${value}'`);
  }
  return normalized as NormalizedTransactionType;
}

export function parseTransactionCsv(input: string): CsvParseResult {
  const records = parseCsvRecords(input);
  if (records.length === 0) return { rows: [], errors: [] };

  const headers = records[0].map((header) => header.trim().toLowerCase());
  const headerSet = new Set(headers);
  const missing = REQUIRED_COLUMNS.filter((column) => !headerSet.has(column));
  if (missing.length > 0) {
    return { rows: [], errors: [{ row: 1, message: `Missing required columns: ${missing.join(", ")}` }] };
  }

  const indexes = new Map(headers.map((header, index) => [header, index]));
  const rows: CsvTransactionRow[] = [];
  const errors: CsvParseError[] = [];

  for (let index = 1; index < records.length; index += 1) {
    const rowNumber = index + 1;
    const record = records[index];
    try {
      const value = (column: string): string => record[indexes.get(column) ?? -1] ?? "";
      const description = value("description").trim();
      if (!description) throw new Error("description cannot be empty");

      rows.push({
        externalId: value("external_id").trim() || undefined,
        occurredAt: parseOccurredAt(value("occurred_at"), rowNumber),
        description,
        amountMinor: parseAmountMinor(value("amount_minor"), rowNumber),
        currency: parseCurrency(value("currency"), rowNumber),
        type: parseType(indexes.has("type") ? value("type") : undefined, rowNumber),
        counterparty: value("counterparty").trim() || undefined,
      });
    } catch (error) {
      errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Invalid row" });
    }
  }

  return { rows, errors };
}

export const transactionCsvColumns = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS] as const;
