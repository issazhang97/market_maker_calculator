import type { TradeRecord, YearlyCell, YearlyProductRow, YearlyPivotData } from "../types";
import { getEtfName } from "../constants/etfNames";

/**
 * Extract distinct years from trade records, sorted descending.
 */
export function extractAvailableYears(records: TradeRecord[]): string[] {
  const years = new Set<string>();
  for (const r of records) {
    const year = r.date.slice(0, 4);
    if (/^\d{4}$/.test(year)) {
      years.add(year);
    }
  }
  return [...years].sort().reverse();
}

/**
 * Aggregate trade records into yearly pivot data for a given year.
 * Auto-discovers all ETF codes from data (not limited to PRODUCT_MAPPINGS).
 * Uses ETF_NAME_MAP for display names.
 *
 * Layout: products as rows, brokers as columns.
 * - 单边日均成交 = avg of (buyAmount + sellAmount) / 2 across data days
 * - 日均持仓 = avg of holdingAmount across data days
 */
export function aggregateYearlyData(
  records: TradeRecord[],
  targetYear: string
): YearlyPivotData {
  // Filter to target year
  const yearRecords = records.filter((r) => r.date.startsWith(targetYear));

  if (yearRecords.length === 0) {
    return {
      year: targetYear,
      brokers: [],
      rows: [],
      brokerTotals: {},
      grandTotalTrading: 0,
      grandTotalHolding: 0,
    };
  }

  // Collect all brokers and all ETF codes
  const brokerSet = new Set<string>();
  const codeSet = new Set<string>();
  for (const r of yearRecords) {
    brokerSet.add(r.broker);
    codeSet.add(r.fundTicker);
  }
  const brokers = [...brokerSet].sort();
  const allCodes = [...codeSet].sort();

  // Index: broker -> fundTicker -> date -> { trading, holding }
  const index: Record<
    string,
    Record<string, Record<string, { trading: number; holding: number }>>
  > = {};

  for (const r of yearRecords) {
    if (!index[r.broker]) index[r.broker] = {};
    if (!index[r.broker][r.fundTicker]) index[r.broker][r.fundTicker] = {};

    const existing = index[r.broker][r.fundTicker][r.date];
    const singleSided = (r.buyAmount + r.sellAmount) / 2;
    const holding = r.holdingAmount ?? 0;

    if (existing) {
      existing.trading += singleSided;
      existing.holding += holding;
    } else {
      index[r.broker][r.fundTicker][r.date] = {
        trading: singleSided,
        holding: holding,
      };
    }
  }

  // Build rows: one per ETF code found in data
  const rows: YearlyProductRow[] = [];
  const brokerTotals: Record<string, YearlyCell> = {};
  for (const b of brokers) {
    brokerTotals[b] = { avgDailyTrading: 0, avgDailyHolding: 0 };
  }
  let grandTotalTrading = 0;
  let grandTotalHolding = 0;

  for (const code of allCodes) {
    const cells: Record<string, YearlyCell> = {};
    let rowTotalTrading = 0;
    let rowTotalHolding = 0;

    for (const broker of brokers) {
      const codeData = index[broker]?.[code];
      if (!codeData) {
        cells[broker] = { avgDailyTrading: 0, avgDailyHolding: 0 };
        continue;
      }

      const dates = Object.keys(codeData);
      const numDays = dates.length;

      const totalTrading = Object.values(codeData).reduce((s, v) => s + v.trading, 0);
      const totalHolding = Object.values(codeData).reduce((s, v) => s + v.holding, 0);

      const avgTrading = totalTrading / numDays;
      const avgHolding = totalHolding / numDays;

      const tradingTooltip = buildYearlyTooltip(
        getEtfName(code), code, broker, "单边日均成交",
        dates, codeData, "trading", totalTrading, numDays
      );
      const holdingTooltip = buildYearlyTooltip(
        getEtfName(code), code, broker, "日均持仓",
        dates, codeData, "holding", totalHolding, numDays
      );

      cells[broker] = { avgDailyTrading: avgTrading, avgDailyHolding: avgHolding, tradingTooltip, holdingTooltip };
      brokerTotals[broker].avgDailyTrading += avgTrading;
      brokerTotals[broker].avgDailyHolding += avgHolding;
      rowTotalTrading += avgTrading;
      rowTotalHolding += avgHolding;
    }

    rows.push({
      productName: getEtfName(code),
      productCode: code,
      cells,
      totalTrading: rowTotalTrading,
      totalHolding: rowTotalHolding,
    });

    grandTotalTrading += rowTotalTrading;
    grandTotalHolding += rowTotalHolding;
  }

  return {
    year: targetYear,
    brokers,
    rows,
    brokerTotals,
    grandTotalTrading,
    grandTotalHolding,
  };
}

function fmtNum(n: number): string {
  return n === 0 ? "0" : n.toFixed(2);
}

function fmtPad(n: number, width = 12): string {
  return fmtNum(n).padStart(width);
}

function buildYearlyTooltip(
  productName: string,
  code: string,
  broker: string,
  metric: string,
  dates: string[],
  codeData: Record<string, { trading: number; holding: number }>,
  field: "trading" | "holding",
  total: number,
  numDays: number,
): string {
  if (total === 0) return "";

  const lines: string[] = [];
  lines.push(`【${productName}】${broker}`);
  lines.push(`ETF: ${code}  ${metric}`);
  lines.push("─".repeat(34));

  // Show sample dates (first 5 + last 5 if too many)
  const sorted = [...dates].sort();
  const MAX_SHOW = 10;
  if (sorted.length <= MAX_SHOW) {
    for (const d of sorted) {
      lines.push(`${d}:${fmtPad(codeData[d][field])}`);
    }
  } else {
    for (const d of sorted.slice(0, 5)) {
      lines.push(`${d}:${fmtPad(codeData[d][field])}`);
    }
    lines.push(`  ... (${sorted.length - 10} 天省略)`);
    for (const d of sorted.slice(-5)) {
      lines.push(`${d}:${fmtPad(codeData[d][field])}`);
    }
  }

  lines.push("─".repeat(34));
  lines.push(`合计:${fmtPad(total)}`);
  lines.push(`÷ ${numDays}天 =${fmtPad(total / numDays)}`);

  return lines.join("\n");
}
