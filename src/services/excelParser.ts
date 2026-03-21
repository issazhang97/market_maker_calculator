import * as XLSX from "xlsx";
import type { TradeRecord } from "../types";

/** Known broker name patterns for filename-based detection */
const BROKER_PATTERNS: [RegExp, string][] = [
  [/方正/, "方正证券"],
  [/华泰/, "华泰证券"],
  [/中信/, "中信证券"],
  [/山西/, "山西证券"],
  [/银河/, "银河证券"],
  [/国信/, "国信证券"],
  [/国泰海通|国泰|海通/, "国泰海通证券"],
];

/**
 * Parse an Excel file buffer into TradeRecord[].
 * Each sheet name is treated as an ETF code (fundTicker).
 * Handles multiple broker formats with different headers, date formats, and units.
 * All amounts are normalized to 万元.
 */
export function parseExcelFile(buffer: ArrayBuffer, filename?: string): TradeRecord[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const records: TradeRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    // Strip .SH/.SZ suffix from sheet names
    const fundTicker = sheetName.replace(/\.(SH|SZ)$/i, "").trim();
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    // Detect whether amount columns indicate 万元 from headers
    const amountInWan = detectAmountUnit(rows[0]);

    for (const row of rows) {
      const broker = resolveBroker(row, filename);
      const dateRaw = findColumnValue(row, ["date", "交易日期", "日期"]);
      const buyRaw = findColumnValue(row, ["buyamount", "买入金额"]);
      const sellRaw = findColumnValue(row, ["sellamount", "卖出金额"]);
      const dailyTotalRaw = findColumnValue(row, ["当日成交金额", "总成交金额"]);

      if (!broker || !dateRaw) continue;

      const date = normalizeDate(dateRaw);
      let buyAmount = toNumber(buyRaw);
      let sellAmount = toNumber(sellRaw);
      let dailyTotal = dailyTotalRaw !== undefined ? toNumber(dailyTotalRaw) : undefined;

      // Normalize to 万元
      if (!amountInWan) {
        buyAmount = buyAmount / 10000;
        sellAmount = sellAmount / 10000;
        if (dailyTotal !== undefined) {
          dailyTotal = dailyTotal / 10000;
        }
      }

      records.push({ fundTicker, broker: String(broker).trim(), date, buyAmount, sellAmount, dailyTotal });
    }
  }

  return records;
}

/**
 * Resolve broker name from row data first, then fall back to filename.
 */
function resolveBroker(row: Record<string, unknown>, filename?: string): string | undefined {
  // Try broker columns in the row
  const rowBroker = findColumnValue(row, ["broker", "做市商", "券商名称", "券商"]);
  if (rowBroker !== undefined && String(rowBroker).trim() !== "") {
    return String(rowBroker).trim();
  }

  // Fall back to filename-based detection
  if (filename) {
    for (const [pattern, name] of BROKER_PATTERNS) {
      if (pattern.test(filename)) {
        return name;
      }
    }
  }

  return undefined;
}

/**
 * Detect whether the amount columns are already in 万元 by inspecting column headers.
 * Returns true if headers contain 万元 or 万, false otherwise (English headers = 元).
 */
function detectAmountUnit(firstRow: Record<string, unknown> | undefined): boolean {
  if (!firstRow) return false;
  for (const key of Object.keys(firstRow)) {
    const lower = key.trim().toLowerCase();
    if (
      (lower.includes("买入金额") || lower.includes("卖出金额")) &&
      (lower.includes("万元") || lower.includes("万"))
    ) {
      return true;
    }
  }
  // If we find Chinese amount headers without 万, they're still in 万元 (all Chinese formats use 万元)
  for (const key of Object.keys(firstRow)) {
    const lower = key.trim().toLowerCase();
    if (lower.includes("买入金额") || lower.includes("卖出金额")) {
      return true;
    }
  }
  return false;
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
  // Handle JavaScript Date objects (xlsx may convert some Excel dates)
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof val === "number") {
    // Check if it looks like YYYYMMDD integer (e.g. 20260319)
    if (val > 19000000 && val < 30000000) {
      const s = String(val);
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    // Excel serial date number
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    return String(val);
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    // Handle YYYYMMDD string (e.g. "20260319")
    const yyyymmdd = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (yyyymmdd) {
      return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
    }
    // Handle YYYY/MM/DD, YYYY-MM-DD, YYYY-M-D etc.
    const match = trimmed.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    }
    return trimmed;
  }

  return String(val);
}
