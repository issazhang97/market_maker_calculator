import type { TradeRecord, PivotDimension, PivotQuery, PivotCell, GenericPivotData } from "../types";
import { getEtfName } from "../constants/etfNames";

const DIM_LABELS: Record<PivotDimension, string> = {
  product: "产品",
  broker: "券商",
  quarter: "季度",
  month: "月份",
};

const QUARTER_LABELS: Record<string, string> = {
  Q1: "第一季度",
  Q2: "第二季度",
  Q3: "第三季度",
  Q4: "第四季度",
};

const MONTH_LABELS: Record<string, string> = {
  "01": "1月",
  "02": "2月",
  "03": "3月",
  "04": "4月",
  "05": "5月",
  "06": "6月",
  "07": "7月",
  "08": "8月",
  "09": "9月",
  "10": "10月",
  "11": "11月",
  "12": "12月",
};

function getDimValue(r: TradeRecord, dim: PivotDimension): string {
  switch (dim) {
    case "broker":
      return r.broker;
    case "product":
      return r.fundTicker;
    case "quarter": {
      const month = parseInt(r.date.slice(5, 7), 10);
      if (month <= 3) return "Q1";
      if (month <= 6) return "Q2";
      if (month <= 9) return "Q3";
      return "Q4";
    }
    case "month":
      return r.date.slice(5, 7);
  }
}

function getDimLabel(key: string, dim: PivotDimension): string {
  switch (dim) {
    case "product":
      return getEtfName(key);
    case "quarter":
      return QUARTER_LABELS[key] ?? key;
    case "month":
      return MONTH_LABELS[key] ?? key;
    default:
      return key;
  }
}

function emptyCell(): PivotCell {
  return { avgDailyTrading: 0, avgDailyHolding: 0 };
}

function addCell(target: PivotCell, source: PivotCell): void {
  target.avgDailyTrading += source.avgDailyTrading;
  target.avgDailyHolding += source.avgDailyHolding;
}

/**
 * Aggregate trade records into a generic pivot table based on the given query.
 * Matches yearlyAggregator logic: single-sided avg = sum((buy+sell)/2) / numDays per cell.
 */
export function aggregatePivot(
  records: TradeRecord[],
  query: PivotQuery
): GenericPivotData {
  const { rowDim, colDim, filters } = query;

  // 1. Filter records
  let filtered = records.filter((r) => r.date.startsWith(filters.year));
  if (filters.brokers && filters.brokers.length > 0) {
    const brokerSet = new Set(filters.brokers);
    filtered = filtered.filter((r) => brokerSet.has(r.broker));
  }
  if (filters.products && filters.products.length > 0) {
    const productSet = new Set(filters.products);
    filtered = filtered.filter((r) => productSet.has(r.fundTicker));
  }

  if (filtered.length === 0) {
    return {
      title: buildTitle(query),
      query,
      rowKeys: [],
      colKeys: [],
      cells: {},
      rowTotals: {},
      colTotals: {},
      grandTotal: emptyCell(),
    };
  }

  // 2. Build index: rowVal -> colVal -> date -> { trading, holding }
  const index: Record<string, Record<string, Record<string, { trading: number; holding: number }>>> = {};
  const rowKeySet = new Set<string>();
  const colKeySet = new Set<string>();

  for (const r of filtered) {
    const rowVal = getDimValue(r, rowDim);
    const colVal = getDimValue(r, colDim);
    rowKeySet.add(rowVal);
    colKeySet.add(colVal);

    if (!index[rowVal]) index[rowVal] = {};
    if (!index[rowVal][colVal]) index[rowVal][colVal] = {};

    const singleSided = (r.buyAmount + r.sellAmount) / 2;
    const holding = r.holdingAmount ?? 0;
    const existing = index[rowVal][colVal][r.date];

    if (existing) {
      existing.trading += singleSided;
      existing.holding += holding;
    } else {
      index[rowVal][colVal][r.date] = { trading: singleSided, holding: holding };
    }
  }

  // Sort keys
  const rowKeysArr = [...rowKeySet].sort();
  const colKeysArr = [...colKeySet].sort();

  // 3. Compute averages per (row, col) cell
  const cells: Record<string, Record<string, PivotCell>> = {};
  const rowTotals: Record<string, PivotCell> = {};
  const colTotals: Record<string, PivotCell> = {};
  const grandTotal = emptyCell();

  for (const rk of rowKeysArr) {
    rowTotals[rk] = emptyCell();
  }
  for (const ck of colKeysArr) {
    colTotals[ck] = emptyCell();
  }

  for (const rk of rowKeysArr) {
    cells[rk] = {};
    for (const ck of colKeysArr) {
      const dateMap = index[rk]?.[ck];
      if (!dateMap) {
        cells[rk][ck] = emptyCell();
        continue;
      }

      const dates = Object.keys(dateMap);
      const numDays = dates.length;
      const totalTrading = Object.values(dateMap).reduce((s, v) => s + v.trading, 0);
      const totalHolding = Object.values(dateMap).reduce((s, v) => s + v.holding, 0);

      const cell: PivotCell = {
        avgDailyTrading: totalTrading / numDays,
        avgDailyHolding: totalHolding / numDays,
      };

      cells[rk][ck] = cell;
      addCell(rowTotals[rk], cell);
      addCell(colTotals[ck], cell);
      addCell(grandTotal, cell);
    }
  }

  // 4. Build key objects with labels
  const rowKeys = rowKeysArr.map((key) => ({ key, label: getDimLabel(key, rowDim) }));
  const colKeys = colKeysArr.map((key) => ({ key, label: getDimLabel(key, colDim) }));

  return {
    title: buildTitle(query),
    query,
    rowKeys,
    colKeys,
    cells,
    rowTotals,
    colTotals,
    grandTotal,
  };
}

function buildTitle(query: PivotQuery): string {
  return `${query.filters.year}年 ${DIM_LABELS[query.rowDim]} × ${DIM_LABELS[query.colDim]}`;
}

/**
 * Extract available filter options from records for a given year.
 */
export function extractFilterOptions(
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

  const brokers = [...brokerSet].sort();
  const products = [...codeSet]
    .sort()
    .map((code) => ({ code, name: getEtfName(code) }));

  return { brokers, products };
}
