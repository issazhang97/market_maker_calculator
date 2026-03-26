import type {
  TradeRecord,
  TrendPoint,
  TrendSeries,
  RankingEntry,
  MarketShareRow,
  AnalyticsQuery,
} from "../types";
import { getEtfName } from "../constants/etfNames";

/**
 * Compute trend series from trade records based on the analytics query.
 * Each selected broker becomes a line/bar series.
 * Products are aggregated (summed) unless specific products are selected.
 */
export function computeTrendSeries(
  records: TradeRecord[],
  query: AnalyticsQuery
): TrendSeries {
  // Filter to target year
  let filtered = records.filter((r) => r.date.startsWith(query.year));

  // Filter by selected products
  if (query.selectedProducts.length > 0) {
    const productSet = new Set(query.selectedProducts);
    filtered = filtered.filter((r) => productSet.has(r.fundTicker));
  }

  // Determine brokers to show
  let brokers = query.selectedBrokers;
  if (brokers.length === 0) {
    // Default: top 5 by total volume
    brokers = getTopBrokers(filtered, 5);
  }

  const brokerSet = new Set(brokers);

  // Index: broker -> date -> { trading, holding }
  const index: Record<string, Record<string, { trading: number; holding: number }>> = {};
  for (const r of filtered) {
    if (!brokerSet.has(r.broker)) continue;
    if (!index[r.broker]) index[r.broker] = {};
    const trading = (r.buyAmount + r.sellAmount) / 2;
    const holding = r.holdingAmount ?? 0;
    if (index[r.broker][r.date]) {
      index[r.broker][r.date].trading += trading;
      index[r.broker][r.date].holding += holding;
    } else {
      index[r.broker][r.date] = { trading, holding };
    }
  }

  // Collect all dates across all brokers
  const allDatesSet = new Set<string>();
  for (const broker of brokers) {
    if (index[broker]) {
      for (const d of Object.keys(index[broker])) {
        allDatesSet.add(d);
      }
    }
  }
  const allDates = [...allDatesSet].sort();

  // Build daily points
  const dailyPoints: TrendPoint[] = allDates.map((date) => {
    const values: Record<string, number> = {};
    for (const broker of brokers) {
      const data = index[broker]?.[date];
      values[broker] = data ? data[query.metric] : 0;
    }
    return { date, values };
  });

  // Aggregate if needed
  let points: TrendPoint[];

  if (query.granularity === "weekly") {
    points = aggregateByWeek(dailyPoints, brokers);
  } else if (query.granularity === "monthly") {
    points = aggregateByMonth(dailyPoints, brokers);
  } else {
    points = dailyPoints;
  }

  return { points, keys: brokers, metric: query.metric, granularity: query.granularity };
}

/**
 * Compute broker rankings for the selected year and filters.
 * Returns rankings sorted by value descending.
 */
export function computeRankings(
  records: TradeRecord[],
  query: AnalyticsQuery
): RankingEntry[] {
  let filtered = records.filter((r) => r.date.startsWith(query.year));

  if (query.selectedProducts.length > 0) {
    const productSet = new Set(query.selectedProducts);
    filtered = filtered.filter((r) => productSet.has(r.fundTicker));
  }

  // Sum by broker
  const brokerTotals: Record<string, number> = {};
  for (const r of filtered) {
    const value =
      query.metric === "trading"
        ? (r.buyAmount + r.sellAmount) / 2
        : (r.holdingAmount ?? 0);
    brokerTotals[r.broker] = (brokerTotals[r.broker] || 0) + value;
  }

  const grandTotal = Object.values(brokerTotals).reduce((s, v) => s + v, 0);

  const entries: RankingEntry[] = Object.entries(brokerTotals)
    .map(([broker, value]) => ({
      broker,
      value,
      share: grandTotal > 0 ? (value / grandTotal) * 100 : 0,
      rank: 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Assign ranks
  entries.forEach((e, i) => {
    e.rank = i + 1;
  });

  return entries;
}

/**
 * Compute market share comparison between current and previous period.
 * Period is determined by granularity: monthly compares current vs previous month,
 * weekly compares current vs previous week, daily compares latest day vs day before.
 */
export function computeMarketShare(
  records: TradeRecord[],
  query: AnalyticsQuery
): MarketShareRow[] {
  let filtered = records.filter((r) => r.date.startsWith(query.year));

  if (query.selectedProducts.length > 0) {
    const productSet = new Set(query.selectedProducts);
    filtered = filtered.filter((r) => productSet.has(r.fundTicker));
  }

  const { currentPeriod, previousPeriod } = getPeriodBounds(filtered, query.granularity);

  if (!currentPeriod || !previousPeriod) return [];

  const currentRecords = filtered.filter(
    (r) => r.date >= currentPeriod.start && r.date <= currentPeriod.end
  );
  const previousRecords = filtered.filter(
    (r) => r.date >= previousPeriod.start && r.date <= previousPeriod.end
  );

  const currentTotals = sumByBroker(currentRecords, query.metric);
  const previousTotals = sumByBroker(previousRecords, query.metric);

  const allBrokers = new Set([
    ...Object.keys(currentTotals),
    ...Object.keys(previousTotals),
  ]);

  const currentGrand = Object.values(currentTotals).reduce((s, v) => s + v, 0);
  const previousGrand = Object.values(previousTotals).reduce((s, v) => s + v, 0);

  const rows: MarketShareRow[] = [...allBrokers].map((broker) => {
    const cv = currentTotals[broker] || 0;
    const pv = previousTotals[broker] || 0;
    const cs = currentGrand > 0 ? (cv / currentGrand) * 100 : 0;
    const ps = previousGrand > 0 ? (pv / previousGrand) * 100 : 0;
    return {
      broker,
      currentValue: cv,
      currentShare: cs,
      previousValue: pv,
      previousShare: ps,
      shareChange: cs - ps,
    };
  });

  // Sort by current value descending
  rows.sort((a, b) => b.currentValue - a.currentValue);

  return rows;
}

/**
 * Extract available brokers and products from records for a given year.
 */
export function extractAnalyticsOptions(
  records: TradeRecord[],
  year: string
): { brokers: string[]; products: { code: string; name: string }[] } {
  const yearRecords = records.filter((r) => r.date.startsWith(year));
  const brokerSet = new Set<string>();
  const codeSet = new Set<string>();

  for (const r of yearRecords) {
    brokerSet.add(r.broker);
    codeSet.add(r.fundTicker);
  }

  return {
    brokers: [...brokerSet].sort(),
    products: [...codeSet].sort().map((code) => ({ code, name: getEtfName(code) })),
  };
}

// --- Internal helpers ---

function getTopBrokers(records: TradeRecord[], count: number): string[] {
  const totals: Record<string, number> = {};
  for (const r of records) {
    const trading = (r.buyAmount + r.sellAmount) / 2;
    totals[r.broker] = (totals[r.broker] || 0) + trading;
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([broker]) => broker);
}

function sumByBroker(
  records: TradeRecord[],
  metric: "trading" | "holding"
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const r of records) {
    const value =
      metric === "trading"
        ? (r.buyAmount + r.sellAmount) / 2
        : (r.holdingAmount ?? 0);
    totals[r.broker] = (totals[r.broker] || 0) + value;
  }
  return totals;
}

interface PeriodBounds {
  start: string;
  end: string;
}

function getPeriodBounds(
  records: TradeRecord[],
  granularity: "daily" | "weekly" | "monthly"
): { currentPeriod: PeriodBounds | null; previousPeriod: PeriodBounds | null } {
  const allDates = [...new Set(records.map((r) => r.date))].sort();
  if (allDates.length < 2) return { currentPeriod: null, previousPeriod: null };

  const latestDate = allDates[allDates.length - 1];

  if (granularity === "daily") {
    const prevDate = allDates[allDates.length - 2];
    return {
      currentPeriod: { start: latestDate, end: latestDate },
      previousPeriod: { start: prevDate, end: prevDate },
    };
  }

  if (granularity === "weekly") {
    const latestD = new Date(latestDate);
    const weekStart = new Date(latestD);
    weekStart.setDate(latestD.getDate() - latestD.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);
    const prevWeekEnd = new Date(prevWeekStart);
    prevWeekEnd.setDate(prevWeekStart.getDate() + 6);

    return {
      currentPeriod: { start: fmtDate(weekStart), end: fmtDate(weekEnd) },
      previousPeriod: { start: fmtDate(prevWeekStart), end: fmtDate(prevWeekEnd) },
    };
  }

  // monthly
  const latestMonth = latestDate.slice(0, 7); // YYYY-MM
  const [y, m] = latestMonth.split("-").map(Number);
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;

  const currentMonthStart = `${latestMonth}-01`;
  const currentMonthEnd = `${latestMonth}-31`;
  const prevMonthStart = `${prevMonth}-01`;
  const prevMonthEnd = `${prevMonth}-31`;

  return {
    currentPeriod: { start: currentMonthStart, end: currentMonthEnd },
    previousPeriod: { start: prevMonthStart, end: prevMonthEnd },
  };
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function aggregateByWeek(
  dailyPoints: TrendPoint[],
  keys: string[]
): TrendPoint[] {
  const weekMap: Record<string, { sums: Record<string, number>; counts: Record<string, number> }> = {};

  for (const point of dailyPoints) {
    const week = getISOWeek(point.date);
    if (!weekMap[week]) {
      weekMap[week] = { sums: {}, counts: {} };
    }
    for (const key of keys) {
      const val = point.values[key] || 0;
      if (val > 0) {
        weekMap[week].sums[key] = (weekMap[week].sums[key] || 0) + val;
        weekMap[week].counts[key] = (weekMap[week].counts[key] || 0) + 1;
      }
    }
  }

  return Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { sums, counts }]) => {
      const values: Record<string, number> = {};
      for (const key of keys) {
        const count = counts[key] || 0;
        values[key] = count > 0 ? (sums[key] || 0) / count : 0;
      }
      return { date: week, values };
    });
}

function aggregateByMonth(
  dailyPoints: TrendPoint[],
  keys: string[]
): TrendPoint[] {
  const monthMap: Record<string, { sums: Record<string, number>; counts: Record<string, number> }> = {};

  for (const point of dailyPoints) {
    const month = point.date.slice(0, 7); // YYYY-MM
    if (!monthMap[month]) {
      monthMap[month] = { sums: {}, counts: {} };
    }
    for (const key of keys) {
      const val = point.values[key] || 0;
      if (val > 0) {
        monthMap[month].sums[key] = (monthMap[month].sums[key] || 0) + val;
        monthMap[month].counts[key] = (monthMap[month].counts[key] || 0) + 1;
      }
    }
  }

  return Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { sums, counts }]) => {
      const values: Record<string, number> = {};
      for (const key of keys) {
        const count = counts[key] || 0;
        values[key] = count > 0 ? (sums[key] || 0) / count : 0;
      }
      return { date: month, values };
    });
}
