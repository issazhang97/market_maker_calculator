import type { TradeRecord, ETFSummaryCell, PivotRow, PivotData } from "../types";
import { PRODUCT_MAPPINGS, getCodesForBroker } from "../constants/etfColumns";

const WEEKDAY_NAMES = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/**
 * Return all distinct dates from records, sorted descending.
 */
export function extractAvailableDates(records: TradeRecord[]): string[] {
  return [...new Set(records.map((r) => r.date))].sort().reverse();
}

/**
 * Build the pivot table from all trade records.
 * Groups ETF codes into product categories using PRODUCT_MAPPINGS.
 * If targetDate is provided, use it as "昨日" instead of the latest date.
 */
export function aggregateData(
  records: TradeRecord[],
  targetDate?: string
): PivotData {
  if (records.length === 0) {
    return {
      date: "",
      products: [],
      rows: [],
      totals: {},
      grandTotal: { past5DaysAvg: 0, yesterday: 0 },
    };
  }

  // Find all distinct dates, sorted descending
  const allDates = extractAvailableDates(records);
  const latestDate = targetDate && allDates.includes(targetDate) ? targetDate : allDates[0];
  const targetIndex = allDates.indexOf(latestDate);
  const last5Dates = allDates.slice(targetIndex, targetIndex + 5);

  // Format the date for display
  const dateDisplay = formatDateDisplay(latestDate);

  // Product names in display order
  const productNames = PRODUCT_MAPPINGS.map((p) => p.name);

  // Group records: broker -> etfCode -> date -> total amount
  // Use dailyTotal when available (more accurate), otherwise buy + sell
  const grouped: Record<string, Record<string, Record<string, number>>> = {};
  for (const r of records) {
    if (!grouped[r.broker]) grouped[r.broker] = {};
    if (!grouped[r.broker][r.fundTicker]) grouped[r.broker][r.fundTicker] = {};
    const dayKey = r.date;
    const amount = r.dailyTotal ?? (r.buyAmount + r.sellAmount);
    grouped[r.broker][r.fundTicker][dayKey] =
      (grouped[r.broker][r.fundTicker][dayKey] || 0) + amount;
  }

  // Build pivot rows — aggregate ETF codes into products per broker
  const rows: PivotRow[] = [];
  for (const broker of Object.keys(grouped)) {
    const cells: Record<string, ETFSummaryCell> = {};
    let totalYesterday = 0;
    let totalPast5Sum = 0;

    for (const product of PRODUCT_MAPPINGS) {
      const codes = getCodesForBroker(product, broker);
      let productYesterday = 0;
      let productPast5Sum = 0;

      // Per-date totals for tooltip
      const dailyAmounts: { date: string; amount: number; perCode?: { code: string; amount: number }[] }[] = [];

      let activeDays = 0;
      for (const d of last5Dates) {
        let dayTotal = 0;
        let dateHasRecord = false;
        const perCode: { code: string; amount: number }[] = [];
        for (const code of codes) {
          // Distinguish "record exists with value 0" from "no record at all"
          const hasRecord = grouped[broker]?.[code]?.[d] !== undefined;
          if (hasRecord) dateHasRecord = true;
          const amt = grouped[broker]?.[code]?.[d] || 0;
          dayTotal += amt;
          if (codes.length > 1 && amt > 0) {
            perCode.push({ code, amount: amt });
          }
        }
        if (dateHasRecord) activeDays++;
        dailyAmounts.push({ date: d, amount: dayTotal, perCode: perCode.length > 0 ? perCode : undefined });
        productPast5Sum += dayTotal;
        if (d === latestDate) productYesterday = dayTotal;
      }

      const productPast5Avg = activeDays > 0 ? productPast5Sum / activeDays : 0;

      // Build tooltips
      const avgTooltip = buildAvgTooltip(product.name, codes, dailyAmounts, productPast5Sum, activeDays);
      const yestTooltip = buildYestTooltip(product.name, codes, dailyAmounts[0]);

      cells[product.name] = { past5DaysAvg: productPast5Avg, yesterday: productYesterday, avgTooltip, yestTooltip };
      totalYesterday += productYesterday;
      totalPast5Sum += productPast5Avg; // Sum of per-product averages (each already divided by its own activeDays)
    }

    rows.push({
      broker,
      cells,
      total: {
        past5DaysAvg: totalPast5Sum,
        yesterday: totalYesterday,
      },
    });
  }

  // Sort rows by total yesterday descending
  rows.sort((a, b) => b.total.yesterday - a.total.yesterday);

  // Column totals
  const totals: Record<string, ETFSummaryCell> = {};
  for (const name of productNames) {
    let colYesterday = 0;
    let colPast5Avg = 0;
    for (const row of rows) {
      colYesterday += row.cells[name]?.yesterday || 0;
      colPast5Avg += row.cells[name]?.past5DaysAvg || 0;
    }
    totals[name] = { past5DaysAvg: colPast5Avg, yesterday: colYesterday };
  }

  const grandTotal: ETFSummaryCell = {
    past5DaysAvg: rows.reduce((s, r) => s + r.total.past5DaysAvg, 0),
    yesterday: rows.reduce((s, r) => s + r.total.yesterday, 0),
  };

  return { date: dateDisplay, products: productNames, rows, totals, grandTotal };
}

function fmt(n: number): string {
  return n === 0 ? "0" : n.toFixed(2);
}

function fmtPad(n: number, width = 10): string {
  return fmt(n).padStart(width);
}

function shortDate(d: string): string {
  return d.slice(5); // "2026-03-17" → "03-17"
}

interface DailyInfo {
  date: string;
  amount: number;
  perCode?: { code: string; amount: number }[];
}

function buildAvgTooltip(
  productName: string,
  codes: string[],
  dailyAmounts: DailyInfo[],
  sum: number,
  windowSize: number,
): string {
  if (sum === 0) return "";
  const lines: string[] = [];

  // Header
  lines.push(`【${productName}】过去5日平均成交`);
  if (codes.length === 1) {
    lines.push(`ETF: ${codes[0]}`);
  } else {
    lines.push(`ETF: ${codes.join(" + ")}`);
  }
  lines.push("─".repeat(32));

  // Per-date rows
  for (const { date, amount, perCode } of dailyAmounts) {
    lines.push(`${shortDate(date)}:${fmtPad(amount)}`);
    if (perCode && perCode.length > 0) {
      for (const c of perCode) {
        lines.push(`  └ ${c.code}:${fmtPad(c.amount)}`);
      }
    }
  }

  // Summary
  lines.push("─".repeat(32));
  lines.push(`合计:${fmtPad(sum)}`);
  lines.push(`÷ ${windowSize} =${fmtPad(sum / windowSize)}`);

  return lines.join("\n");
}

function buildYestTooltip(
  productName: string,
  codes: string[],
  dayInfo?: DailyInfo,
): string {
  if (!dayInfo || dayInfo.amount === 0) return "";
  const lines: string[] = [];

  lines.push(`【${productName}】昨日成交`);
  if (codes.length === 1) {
    lines.push(`ETF: ${codes[0]}`);
  } else {
    lines.push(`ETF: ${codes.join(" + ")}`);
  }
  lines.push("─".repeat(32));
  lines.push(`${shortDate(dayInfo.date)}:${fmtPad(dayInfo.amount)}`);

  if (dayInfo.perCode && dayInfo.perCode.length > 0) {
    lines.push("─".repeat(32));
    for (const c of dayInfo.perCode) {
      lines.push(`  ${c.code}:${fmtPad(c.amount)}`);
    }
  }

  return lines.join("\n");
}

function formatDateDisplay(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const weekday = WEEKDAY_NAMES[dateObj.getDay()];
  return `${y}/${m.padStart(2, "0")}/${d.padStart(2, "0")}/${weekday}`;
}
