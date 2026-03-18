import * as XLSX from "xlsx";
import type { TradeRecord } from "../types";

/**
 * Parse an Excel file buffer into TradeRecord[].
 * Each sheet name is treated as an ETF code (fundTicker).
 * Supports both English headers (fundticker, broker, date, buyamount, sellamount)
 * and Chinese headers (券商名称, 交易日期, 买入金额, 卖出金额).
 */
export function parseExcelFile(buffer: ArrayBuffer): TradeRecord[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const records: TradeRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const fundTicker = sheetName.trim();
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    for (const row of rows) {
      const broker = findColumnValue(row, ["broker", "券商名称", "券商"]);
      const dateRaw = findColumnValue(row, ["date", "交易日期", "日期"]);
      const buyRaw = findColumnValue(row, ["buyamount", "买入金额", "买入"]);
      const sellRaw = findColumnValue(row, ["sellamount", "卖出金额", "卖出"]);

      if (!broker || !dateRaw) continue;

      const date = normalizeDate(dateRaw);
      const buyAmount = toNumber(buyRaw);
      const sellAmount = toNumber(sellRaw);

      records.push({ fundTicker, broker: String(broker).trim(), date, buyAmount, sellAmount });
    }
  }

  return records;
}

function findColumnValue(row: Record<string, unknown>, candidates: string[]): unknown {
  for (const key of Object.keys(row)) {
    const lower = key.trim().toLowerCase();
    for (const candidate of candidates) {
      if (lower === candidate.toLowerCase() || lower.includes(candidate.toLowerCase())) {
        return row[key];
      }
    }
  }
  return undefined;
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/,/g, "").trim();
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function normalizeDate(val: unknown): string {
  if (typeof val === "number") {
    // Excel serial date number
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    return String(val);
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    // Handle YYYY/MM/DD, YYYY-MM-DD, YYYY-M-D etc.
    const match = trimmed.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    }
    return trimmed;
  }
  return String(val);
}
