import type { TradeRecord, ETFSummaryCell, PivotRow, PivotData } from "../types";
import { ETF_DISPLAY_ORDER } from "../constants/etfColumns";

const WEEKDAY_NAMES = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/**
 * Build the pivot table from all trade records.
 */
export function aggregateData(
  records: TradeRecord[],
  etfNames: Record<string, string>
): PivotData {
  if (records.length === 0) {
    return {
      date: "",
      etfCodes: [],
      etfNames: {},
      rows: [],
      totals: {},
      grandTotal: { past5DaysAvg: 0, yesterday: 0 },
    };
  }

  // Find all distinct dates, sorted descending
  const allDates = [...new Set(records.map((r) => r.date))].sort().reverse();
  const latestDate = allDates[0];
  const last5Dates = allDates.slice(0, 5);

  // Format the date for display
  const dateDisplay = formatDateDisplay(latestDate);

  // Find all distinct ETF codes and sort by preferred order
  const etfCodeSet = new Set(records.map((r) => r.fundTicker));
  const etfCodes = sortETFCodes([...etfCodeSet]);

  // Group records: broker -> etfCode -> date -> total amount
  const grouped: Record<string, Record<string, Record<string, number>>> = {};
  for (const r of records) {
    if (!grouped[r.broker]) grouped[r.broker] = {};
    if (!grouped[r.broker][r.fundTicker]) grouped[r.broker][r.fundTicker] = {};
    const dayKey = r.date;
    const amount = r.buyAmount + r.sellAmount;
    grouped[r.broker][r.fundTicker][dayKey] =
      (grouped[r.broker][r.fundTicker][dayKey] || 0) + amount;
  }

  // Build pivot rows
  const rows: PivotRow[] = [];
  for (const broker of Object.keys(grouped)) {
    const cells: Record<string, ETFSummaryCell> = {};
    let totalYesterday = 0;
    let totalPast5Sum = 0;

    for (const code of etfCodes) {
      const dateMap = grouped[broker]?.[code] || {};
      const yesterday = (dateMap[latestDate] || 0) / 10000;
      const past5Sum = last5Dates.reduce((sum, d) => sum + (dateMap[d] || 0), 0);
      const past5Avg = past5Sum / last5Dates.length / 10000;

      cells[code] = { past5DaysAvg: past5Avg, yesterday };
      totalYesterday += yesterday;
      totalPast5Sum += past5Sum;
    }

    rows.push({
      broker,
      cells,
      total: {
        past5DaysAvg: totalPast5Sum / last5Dates.length / 10000,
        yesterday: totalYesterday,
      },
    });
  }

  // Sort rows by total yesterday descending
  rows.sort((a, b) => b.total.yesterday - a.total.yesterday);

  // Column totals
  const totals: Record<string, ETFSummaryCell> = {};
  for (const code of etfCodes) {
    let colYesterday = 0;
    let colPast5Avg = 0;
    for (const row of rows) {
      colYesterday += row.cells[code]?.yesterday || 0;
      colPast5Avg += row.cells[code]?.past5DaysAvg || 0;
    }
    totals[code] = { past5DaysAvg: colPast5Avg, yesterday: colYesterday };
  }

  const grandTotal: ETFSummaryCell = {
    past5DaysAvg: rows.reduce((s, r) => s + r.total.past5DaysAvg, 0),
    yesterday: rows.reduce((s, r) => s + r.total.yesterday, 0),
  };

  return { date: dateDisplay, etfCodes, etfNames, rows, totals, grandTotal };
}

function sortETFCodes(codes: string[]): string[] {
  const orderMap = new Map(ETF_DISPLAY_ORDER.map((c, i) => [c, i]));
  return codes.sort((a, b) => {
    const ia = orderMap.get(a) ?? 999;
    const ib = orderMap.get(b) ?? 999;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });
}

function formatDateDisplay(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const weekday = WEEKDAY_NAMES[dateObj.getDay()];
  return `${y}/${m.padStart(2, "0")}/${d.padStart(2, "0")}/${weekday}`;
}
