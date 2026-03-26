# Analytics Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "数据分析" Analytics tab with trend charts, broker rankings, market share tracking, and anomaly detection highlighting in the daily summary table.

**Architecture:** New `analyticsAggregator.ts` service computes trend series, rankings, and market share data from `TradeRecord[]`. New `anomalyDetector.ts` computes rolling 20-day mean/stddev flags. A new `useAnalyticsData` hook wires the aggregator to React state. Charts rendered with Recharts in a new `AnalyticsView` component. Anomaly flags are passed into the existing `SummaryTable` for cell highlighting.

**Tech Stack:** React 19, TypeScript, Recharts (new dep), Tailwind CSS + existing App.css patterns

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/types/analytics.ts` | All analytics-related type definitions (TrendPoint, TrendSeries, RankingEntry, MarketShareRow, AnomalyFlag, AnalyticsQuery) |
| `src/services/anomalyDetector.ts` | Rolling 20-day mean/stddev anomaly detection, returns flags keyed by broker->fundTicker |
| `src/services/analyticsAggregator.ts` | Compute trend series (daily/weekly/monthly), broker rankings, market share comparison |
| `src/hooks/useAnalyticsData.ts` | Hook: parses files, runs analyticsAggregator, manages AnalyticsQuery state |
| `src/components/charts/ChartControls.tsx` | Controls: metric toggle, granularity toggle, chart type toggle, broker/product multi-select, year filter |
| `src/components/charts/TrendChart.tsx` | Recharts line/bar chart rendering trend series |
| `src/components/charts/RankingChart.tsx` | Recharts horizontal bar chart for broker rankings |
| `src/components/charts/MarketShareTable.tsx` | Period-over-period market share comparison table |
| `src/components/AnalyticsView.tsx` | Container composing ChartControls + TrendChart + RankingChart + MarketShareTable |

### Modified Files

| File | Change |
|------|--------|
| `src/types/index.ts` | Re-export from `analytics.ts` |
| `src/components/ViewSwitcher.tsx` | Add "analytics" to ViewType, add "数据分析" tab button |
| `src/App.tsx` | Import AnalyticsView, wire useAnalyticsData hook, add analytics view rendering |
| `src/hooks/useSummaryData.ts` | Call anomalyDetector, return anomaly flags |
| `src/components/SummaryTable.tsx` | Accept anomalyFlags prop, apply highlight CSS to flagged cells |
| `src/App.css` | Add anomaly highlight styles and analytics section styles |

---

### Task 1: Install Recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install recharts**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm install recharts
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm ls recharts
```

Expected: shows recharts version in dependency tree.

- [ ] **Step 3: Verify build still works**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator
git add package.json package-lock.json
git commit -m "Add recharts dependency for analytics charts"
```

---

### Task 2: Add Analytics Types

**Files:**
- Create: `src/types/analytics.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create `src/types/analytics.ts`**

```typescript
// Trend data point — one per date/period, with values keyed by series name (broker or product)
export interface TrendPoint {
  date: string; // YYYY-MM-DD for daily, "YYYY-Wxx" for weekly, "YYYY-MM" for monthly
  values: Record<string, number>; // keyed by broker name or product name
}

// Trend series for chart rendering
export interface TrendSeries {
  points: TrendPoint[];
  keys: string[]; // broker or product names — each becomes a chart line/bar
  metric: "trading" | "holding";
  granularity: "daily" | "weekly" | "monthly";
}

// One broker's ranking for the selected period
export interface RankingEntry {
  broker: string;
  value: number; // total volume or holding for the period
  share: number; // percentage 0-100
  rank: number;  // 1-based
}

// Market share comparison row — current period vs previous period
export interface MarketShareRow {
  broker: string;
  currentValue: number;
  currentShare: number;  // percentage 0-100
  previousValue: number;
  previousShare: number; // percentage 0-100
  shareChange: number;   // currentShare - previousShare (positive = gained)
}

// Anomaly flag for a single broker x product cell
export interface AnomalyFlag {
  type: "spike" | "drop";
  value: number;  // the actual day's value
  mean: number;   // rolling 20-day mean
  stddev: number; // rolling 20-day stddev
}

// All anomaly flags keyed by broker -> fundTicker
export type AnomalyFlags = Record<string, Record<string, AnomalyFlag>>;

// Query state for the analytics view
export interface AnalyticsQuery {
  year: string;
  metric: "trading" | "holding";
  granularity: "daily" | "weekly" | "monthly";
  chartType: "line" | "bar";
  selectedBrokers: string[];
  selectedProducts: string[];
}
```

- [ ] **Step 2: Modify `src/types/index.ts` to re-export analytics types**

Add this line at the end of `src/types/index.ts`:

```typescript
export type { TrendPoint, TrendSeries, RankingEntry, MarketShareRow, AnomalyFlag, AnomalyFlags, AnalyticsQuery } from "./analytics";
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator
git add src/types/analytics.ts src/types/index.ts
git commit -m "Add analytics type definitions"
```

---

### Task 3: Implement Anomaly Detector

**Files:**
- Create: `src/services/anomalyDetector.ts`

The anomaly detector computes a rolling 20-day mean and standard deviation of daily trading volume for each broker x fundTicker pair. If the target date's value falls outside mean +/- 2 sigma, it flags that cell.

- [ ] **Step 1: Create `src/services/anomalyDetector.ts`**

```typescript
import type { TradeRecord, AnomalyFlag, AnomalyFlags } from "../types";

const WINDOW_SIZE = 20;
const SIGMA_THRESHOLD = 2;
const MIN_DATA_POINTS = 5;

/**
 * Detect anomalies for the target date by computing rolling mean/stddev
 * over the preceding WINDOW_SIZE trading days for each broker x fundTicker.
 *
 * Returns flags keyed by broker -> fundTicker.
 */
export function detectAnomalies(
  records: TradeRecord[],
  targetDate: string
): AnomalyFlags {
  const flags: AnomalyFlags = {};

  // Index: broker -> fundTicker -> date -> singleSidedTrading
  const index: Record<string, Record<string, Record<string, number>>> = {};

  for (const r of records) {
    if (!index[r.broker]) index[r.broker] = {};
    if (!index[r.broker][r.fundTicker]) index[r.broker][r.fundTicker] = {};

    const trading = (r.buyAmount + r.sellAmount) / 2;
    index[r.broker][r.fundTicker][r.date] =
      (index[r.broker][r.fundTicker][r.date] || 0) + trading;
  }

  for (const broker of Object.keys(index)) {
    for (const ticker of Object.keys(index[broker])) {
      const dateMap = index[broker][ticker];
      const allDates = Object.keys(dateMap).sort();

      const targetIdx = allDates.indexOf(targetDate);
      if (targetIdx < 0) continue; // no data for this broker/ticker on target date

      // Collect the WINDOW_SIZE days preceding the target date (not including target)
      const windowStart = Math.max(0, targetIdx - WINDOW_SIZE);
      const windowDates = allDates.slice(windowStart, targetIdx);

      if (windowDates.length < MIN_DATA_POINTS) continue;

      const windowValues = windowDates.map((d) => dateMap[d]);
      const mean = windowValues.reduce((s, v) => s + v, 0) / windowValues.length;
      const variance =
        windowValues.reduce((s, v) => s + (v - mean) ** 2, 0) / windowValues.length;
      const stddev = Math.sqrt(variance);

      if (stddev === 0) continue; // no variation — skip

      const value = dateMap[targetDate];
      const upperBound = mean + SIGMA_THRESHOLD * stddev;
      const lowerBound = mean - SIGMA_THRESHOLD * stddev;

      if (value > upperBound) {
        if (!flags[broker]) flags[broker] = {};
        flags[broker][ticker] = { type: "spike", value, mean, stddev };
      } else if (value < lowerBound) {
        if (!flags[broker]) flags[broker] = {};
        flags[broker][ticker] = { type: "drop", value, mean, stddev };
      }
    }
  }

  return flags;
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator
git add src/services/anomalyDetector.ts
git commit -m "Add anomaly detector with rolling 20-day mean/stddev"
```

---

### Task 4: Integrate Anomaly Detection into Summary View

**Files:**
- Modify: `src/hooks/useSummaryData.ts`
- Modify: `src/components/SummaryTable.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Modify `src/hooks/useSummaryData.ts` to compute and return anomaly flags**

The hook already parses files and computes `allRecords`. After aggregation, call `detectAnomalies` with the selected date. The full file should become:

```typescript
import { useState, useEffect } from "react";
import type { LoadedFile, TradeRecord, PivotData, AnomalyFlags } from "../types";
import { parseExcelFile } from "../services/excelParser";
import { aggregateData, extractAvailableDates } from "../services/dataAggregator";
import { detectAnomalies } from "../services/anomalyDetector";

export function useSummaryData(files: LoadedFile[], selectedDate: string | null) {
  const [pivotData, setPivotData] = useState<PivotData | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [anomalyFlags, setAnomalyFlags] = useState<AnomalyFlags>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (files.length === 0) {
      setPivotData(null);
      setAvailableDates([]);
      setAnomalyFlags({});
      setError(null);
      return;
    }

    let cancelled = false;

    function process() {
      setLoading(true);
      setError(null);

      try {
        // Parse all files
        const allRecords: TradeRecord[] = [];
        for (const file of files) {
          const records = parseExcelFile(file.data, file.name);
          allRecords.push(...records);
        }

        if (allRecords.length === 0) {
          setPivotData(null);
          setAvailableDates([]);
          setAnomalyFlags({});
          setError("未找到有效的交易数据。请检查文件格式是否正确。");
          setLoading(false);
          return;
        }

        if (cancelled) return;

        // Extract available dates for the selector
        const dates = extractAvailableDates(allRecords);
        setAvailableDates(dates);

        // Aggregate by product groupings
        const data = aggregateData(allRecords, selectedDate || undefined);
        setPivotData(data);

        // Detect anomalies for the target date
        const targetDate = selectedDate || dates[0];
        if (targetDate) {
          const flags = detectAnomalies(allRecords, targetDate);
          setAnomalyFlags(flags);
        } else {
          setAnomalyFlags({});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "解析文件时出错");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    process();
    return () => {
      cancelled = true;
    };
  }, [files, selectedDate]);

  return { pivotData, availableDates, anomalyFlags, loading, error };
}
```

- [ ] **Step 2: Update `src/App.tsx` to pass anomalyFlags to SummaryTable**

In `App.tsx`, destructure `anomalyFlags` from `useSummaryData`:

Change this line:
```typescript
const { pivotData, availableDates, loading, error } = useSummaryData(files, selectedDate);
```

To:
```typescript
const { pivotData, availableDates, anomalyFlags, loading, error } = useSummaryData(files, selectedDate);
```

And pass it to `SummaryTable`:
```tsx
<SummaryTable data={pivotData} anomalyFlags={anomalyFlags} />
```

- [ ] **Step 3: Add anomaly highlight CSS to `src/App.css`**

Append these styles at the end of `src/App.css`:

```css
/* Anomaly highlighting */
.anomaly-spike {
  background-color: #dcfce7 !important;
  position: relative;
}

.anomaly-drop {
  background-color: #fee2e2 !important;
  position: relative;
}

.anomaly-indicator {
  font-size: 10px;
  margin-left: 4px;
}

.anomaly-spike .anomaly-indicator {
  color: #16a34a;
}

.anomaly-drop .anomaly-indicator {
  color: #dc2626;
}
```

- [ ] **Step 4: Modify `src/components/SummaryTable.tsx` to apply anomaly highlighting**

The SummaryTable needs to accept `anomalyFlags` and look up flags for each broker/product "昨日成交" cell. The key challenge: the table uses product *names* (from `PRODUCT_MAPPINGS`), but anomaly flags are keyed by *fundTicker*. We need to check if any fundTicker in a product group has a flag.

Import the needed types and product mappings. Replace the full file:

```tsx
import type { PivotData, ETFSummaryCell, AnomalyFlags } from "../types";
import { PRODUCT_MAPPINGS, getCodesForBroker } from "../constants/etfColumns";
import { TooltipCell } from "./TooltipCell";

interface Props {
  data: PivotData;
  anomalyFlags?: AnomalyFlags;
}

function formatNum(n: number): string {
  if (n === 0) return "";
  return n.toFixed(2);
}

function formatAnomaly(mean: number, stddev: number): string {
  const lower = Math.max(0, mean - 2 * stddev);
  const upper = mean + 2 * stddev;
  return `20日均值: ${mean.toFixed(2)}万\n范围: ${lower.toFixed(2)} - ${upper.toFixed(2)}万`;
}

export function SummaryTable({ data, anomalyFlags }: Props) {
  const { products, rows, totals, grandTotal, date } = data;

  // Build a lookup: for each product name and broker, find the anomaly flag (if any)
  function getAnomalyForCell(broker: string, productName: string) {
    if (!anomalyFlags?.[broker]) return undefined;
    const product = PRODUCT_MAPPINGS.find((p) => p.name === productName);
    if (!product) return undefined;
    const codes = getCodesForBroker(product, broker);
    for (const code of codes) {
      const flag = anomalyFlags[broker]?.[code];
      if (flag) return flag;
    }
    return undefined;
  }

  return (
    <div className="overflow-x-auto">
      <table className="summary-table">
        <thead>
          {/* Row 1: Date + product name headers */}
          <tr>
            <th className="th-broker">
              {date}
            </th>
            {products.map((name) => (
              <th key={name} colSpan={2} className="th-etf">
                {name}
              </th>
            ))}
            <th colSpan={2} className="th-total">
              合计
            </th>
          </tr>

          {/* Row 2: (万元) label + sub-headers */}
          <tr>
            <th className="th-broker">(万元)</th>
            {products.map((name) => (
              <SubHeaders key={name} />
            ))}
            <SubHeaders />
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => (
            <tr key={row.broker} className={i % 2 === 0 ? "row-even" : "row-odd"}>
              <td className="td-broker">{row.broker}</td>
              {products.map((name) => {
                const cell = row.cells[name] || { past5DaysAvg: 0, yesterday: 0 };
                const anomaly = getAnomalyForCell(row.broker, name);
                return (
                  <CellPair key={name} cell={cell} anomaly={anomaly} />
                );
              })}
              <CellPair cell={row.total} isTotal />
            </tr>
          ))}

          {/* Totals row */}
          <tr className="row-totals">
            <td className="td-broker font-bold">合计</td>
            {products.map((name) => {
              const cell = totals[name] || { past5DaysAvg: 0, yesterday: 0 };
              return (
                <CellPair key={name} cell={cell} />
              );
            })}
            <CellPair cell={grandTotal} isTotal />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SubHeaders() {
  return (
    <>
      <th className="th-sub">过去5日平均成交</th>
      <th className="th-sub">昨日成交</th>
    </>
  );
}

function CellPair({
  cell,
  isTotal = false,
  anomaly,
}: {
  cell: ETFSummaryCell;
  isTotal?: boolean;
  anomaly?: { type: "spike" | "drop"; value: number; mean: number; stddev: number };
}) {
  const cls = isTotal ? "td-num td-total-col" : "td-num";
  const anomalyCls = anomaly
    ? anomaly.type === "spike"
      ? "anomaly-spike"
      : "anomaly-drop"
    : "";
  const anomalyTooltip = anomaly
    ? `异常: 当日成交 ${anomaly.value.toFixed(2)}万\n${formatAnomaly(anomaly.mean, anomaly.stddev)}`
    : undefined;

  return (
    <>
      <td className={cls}>
        <TooltipCell value={formatNum(cell.past5DaysAvg)} tooltip={cell.avgTooltip} />
      </td>
      <td className={`${cls} ${anomalyCls}`}>
        <TooltipCell
          value={
            formatNum(cell.yesterday) +
            (anomaly ? (anomaly.type === "spike" ? " ▲" : " ▼") : "")
          }
          tooltip={anomalyTooltip || cell.yestTooltip}
        />
      </td>
    </>
  );
}
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator
git add src/hooks/useSummaryData.ts src/components/SummaryTable.tsx src/App.tsx src/App.css
git commit -m "Add anomaly detection highlighting to daily summary table"
```

---

### Task 5: Implement Analytics Aggregator

**Files:**
- Create: `src/services/analyticsAggregator.ts`

This is the core computation engine for the analytics tab. It produces trend series, rankings, and market share data.

- [ ] **Step 1: Create `src/services/analyticsAggregator.ts`**

```typescript
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
  let granularity = query.granularity;

  if (granularity === "weekly") {
    points = aggregateByWeek(dailyPoints, brokers);
  } else if (granularity === "monthly") {
    points = aggregateByMonth(dailyPoints, brokers);
  } else {
    points = dailyPoints;
  }

  return { points, keys: brokers, metric: query.metric, granularity };
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
  const currentMonthEnd = `${latestMonth}-31`; // date comparison is string-based, 31 is safe
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
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator
git add src/services/analyticsAggregator.ts
git commit -m "Add analytics aggregator for trends, rankings, and market share"
```

---

### Task 6: Create useAnalyticsData Hook

**Files:**
- Create: `src/hooks/useAnalyticsData.ts`

- [ ] **Step 1: Create `src/hooks/useAnalyticsData.ts`**

```typescript
import { useState, useEffect, useMemo } from "react";
import type {
  LoadedFile,
  TradeRecord,
  TrendSeries,
  RankingEntry,
  MarketShareRow,
  AnalyticsQuery,
} from "../types";
import { parseExcelFile } from "../services/excelParser";
import { extractAvailableYears } from "../services/yearlyAggregator";
import {
  computeTrendSeries,
  computeRankings,
  computeMarketShare,
  extractAnalyticsOptions,
} from "../services/analyticsAggregator";

export function useAnalyticsData(files: LoadedFile[], query: AnalyticsQuery) {
  const [trendSeries, setTrendSeries] = useState<TrendSeries | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [marketShare, setMarketShare] = useState<MarketShareRow[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableBrokers, setAvailableBrokers] = useState<string[]>([]);
  const [availableProducts, setAvailableProducts] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stabilize query to prevent unnecessary recomputation
  const stableQuery = useMemo(() => query, [
    query.year,
    query.metric,
    query.granularity,
    query.chartType,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(query.selectedBrokers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(query.selectedProducts),
  ]);

  useEffect(() => {
    if (files.length === 0) {
      setTrendSeries(null);
      setRankings([]);
      setMarketShare([]);
      setAvailableYears([]);
      setAvailableBrokers([]);
      setAvailableProducts([]);
      setError(null);
      return;
    }

    let cancelled = false;

    function process() {
      setLoading(true);
      setError(null);

      try {
        const allRecords: TradeRecord[] = [];
        for (const file of files) {
          const records = parseExcelFile(file.data, file.name);
          allRecords.push(...records);
        }

        if (allRecords.length === 0) {
          setTrendSeries(null);
          setRankings([]);
          setMarketShare([]);
          setAvailableYears([]);
          setAvailableBrokers([]);
          setAvailableProducts([]);
          setError("未找到有效的交易数据。请检查文件格式是否正确。");
          setLoading(false);
          return;
        }

        if (cancelled) return;

        const years = extractAvailableYears(allRecords);
        setAvailableYears(years);

        const targetYear =
          stableQuery.year && years.includes(stableQuery.year)
            ? stableQuery.year
            : years[0];

        if (!targetYear) {
          setTrendSeries(null);
          setRankings([]);
          setMarketShare([]);
          setLoading(false);
          return;
        }

        const options = extractAnalyticsOptions(allRecords, targetYear);
        setAvailableBrokers(options.brokers);
        setAvailableProducts(options.products);

        const effectiveQuery: AnalyticsQuery = {
          ...stableQuery,
          year: targetYear,
        };

        const trend = computeTrendSeries(allRecords, effectiveQuery);
        setTrendSeries(trend);

        const rank = computeRankings(allRecords, effectiveQuery);
        setRankings(rank);

        const share = computeMarketShare(allRecords, effectiveQuery);
        setMarketShare(share);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "分析数据时出错");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    process();
    return () => {
      cancelled = true;
    };
  }, [files, stableQuery]);

  return {
    trendSeries,
    rankings,
    marketShare,
    availableYears,
    availableBrokers,
    availableProducts,
    loading,
    error,
  };
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run build
```

Expected: Build succeeds (hook is not yet consumed, but should compile).

- [ ] **Step 3: Commit**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator
git add src/hooks/useAnalyticsData.ts
git commit -m "Add useAnalyticsData hook"
```

---

### Task 7: Create Chart Components

**Files:**
- Create: `src/components/charts/ChartControls.tsx`
- Create: `src/components/charts/TrendChart.tsx`
- Create: `src/components/charts/RankingChart.tsx`
- Create: `src/components/charts/MarketShareTable.tsx`

- [ ] **Step 1: Create `src/components/charts/` directory**

```bash
mkdir -p /Users/wenjunzhang/code/market_maker_calculator/src/components/charts
```

- [ ] **Step 2: Create `src/components/charts/ChartControls.tsx`**

This reuses the existing multi-select dropdown pattern from `DimensionSelector.tsx`.

```tsx
import { useState, useRef, useEffect, useCallback } from "react";
import type { AnalyticsQuery } from "../../types";

interface Props {
  query: AnalyticsQuery;
  onChange: (query: AnalyticsQuery) => void;
  availableYears: string[];
  availableBrokers: string[];
  availableProducts: { code: string; name: string }[];
}

export function ChartControls({
  query,
  onChange,
  availableYears,
  availableBrokers,
  availableProducts,
}: Props) {
  return (
    <div className="dim-selector">
      <div className="dim-selector-row">
        <label className="dim-label">
          年度:
          <select
            className="dim-select"
            value={query.year}
            onChange={(e) => onChange({ ...query, year: e.target.value, selectedBrokers: [], selectedProducts: [] })}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </label>

        <label className="dim-label">
          指标:
          <select
            className="dim-select"
            value={query.metric}
            onChange={(e) => onChange({ ...query, metric: e.target.value as "trading" | "holding" })}
          >
            <option value="trading">成交量</option>
            <option value="holding">持仓</option>
          </select>
        </label>

        <label className="dim-label">
          粒度:
          <select
            className="dim-select"
            value={query.granularity}
            onChange={(e) => onChange({ ...query, granularity: e.target.value as "daily" | "weekly" | "monthly" })}
          >
            <option value="daily">日</option>
            <option value="weekly">周</option>
            <option value="monthly">月</option>
          </select>
        </label>

        <label className="dim-label">
          图表:
          <select
            className="dim-select"
            value={query.chartType}
            onChange={(e) => onChange({ ...query, chartType: e.target.value as "line" | "bar" })}
          >
            <option value="line">折线图</option>
            <option value="bar">柱状图</option>
          </select>
        </label>
      </div>

      <div className="dim-selector-row">
        <MultiSelectDropdown
          label="筛选券商"
          allItems={availableBrokers.map((b) => ({ value: b, label: b }))}
          selected={query.selectedBrokers}
          onChange={(brokers) => onChange({ ...query, selectedBrokers: brokers })}
        />
        <MultiSelectDropdown
          label="筛选产品"
          allItems={availableProducts.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` }))}
          selected={query.selectedProducts}
          onChange={(products) => onChange({ ...query, selectedProducts: products })}
        />
      </div>
    </div>
  );
}

// Reusable multi-select dropdown (same pattern as DimensionSelector)
interface MultiSelectProps {
  label: string;
  allItems: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function MultiSelectDropdown({ label, allItems, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAllSelected = selected.length === 0;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  const toggleItem = (value: string) => {
    if (isAllSelected) {
      onChange(allItems.filter((i) => i.value !== value).map((i) => i.value));
    } else if (selected.includes(value)) {
      const next = selected.filter((v) => v !== value);
      onChange(next);
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  const displayText = isAllSelected
    ? "全部"
    : selected.length === 1
      ? allItems.find((i) => i.value === selected[0])?.label ?? selected[0]
      : `已选${selected.length}项`;

  return (
    <div className="dim-label multi-select-wrapper" ref={ref}>
      {label}:
      <button className="dim-select multi-select-btn" onClick={() => setOpen(!open)}>
        {displayText}
        <span className="multi-select-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="multi-select-dropdown">
          <label className="multi-select-item">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={selectAll}
            />
            全部
          </label>
          {allItems.map((item) => (
            <label key={item.value} className="multi-select-item">
              <input
                type="checkbox"
                checked={isAllSelected || selected.includes(item.value)}
                onChange={() => toggleItem(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/charts/TrendChart.tsx`**

```tsx
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { TrendSeries } from "../../types";

// 10 distinct colors for chart lines/bars
const COLORS = [
  "#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5",
  "#70ad47", "#264478", "#9b59b6", "#e74c3c", "#1abc9c",
];

interface Props {
  data: TrendSeries;
  chartType: "line" | "bar";
}

export function TrendChart({ data, chartType }: Props) {
  const { points, keys } = data;

  // Transform points into Recharts-compatible format: { date, broker1, broker2, ... }
  const chartData = points.map((p) => ({
    date: formatDateLabel(p.date),
    ...p.values,
  }));

  const metricLabel = data.metric === "trading" ? "成交量 (万元)" : "持仓 (万元)";

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis fontSize={12} label={{ value: metricLabel, angle: -90, position: "insideLeft", offset: -5, fontSize: 12 }} />
          <Tooltip formatter={(value: number) => value.toFixed(2)} />
          <Legend />
          {keys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} label={{ value: metricLabel, angle: -90, position: "insideLeft", offset: -5, fontSize: 12 }} />
        <Tooltip formatter={(value: number) => value.toFixed(2)} />
        <Legend />
        {keys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function formatDateLabel(date: string): string {
  // "2026-03-17" -> "03-17", "2026-W12" -> "W12", "2026-03" -> "3月"
  if (date.includes("-W")) {
    return date.slice(5); // "W12"
  }
  if (/^\d{4}-\d{2}$/.test(date)) {
    const month = parseInt(date.slice(5), 10);
    return `${month}月`;
  }
  return date.slice(5); // "03-17"
}
```

- [ ] **Step 4: Create `src/components/charts/RankingChart.tsx`**

```tsx
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { RankingEntry } from "../../types";

// Gradient from blue (top rank) to light gray (bottom rank)
function getRankColor(rank: number, total: number): string {
  const ratio = (rank - 1) / Math.max(total - 1, 1);
  // Interpolate from #4472c4 (blue) to #d0d0d0 (light gray)
  const r = Math.round(68 + ratio * (208 - 68));
  const g = Math.round(114 + ratio * (208 - 114));
  const b = Math.round(196 + ratio * (208 - 196));
  return `rgb(${r}, ${g}, ${b})`;
}

interface Props {
  data: RankingEntry[];
  metric: "trading" | "holding";
}

export function RankingChart({ data, metric }: Props) {
  if (data.length === 0) return null;

  const metricLabel = metric === "trading" ? "成交量 (万元)" : "持仓 (万元)";

  // Recharts horizontal bar: use layout="vertical"
  const chartData = data.map((entry) => ({
    broker: entry.broker,
    value: entry.value,
    share: entry.share,
    rank: entry.rank,
  }));

  const barHeight = 32;
  const chartHeight = Math.max(chartData.length * barHeight + 60, 200);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" fontSize={12} label={{ value: metricLabel, position: "insideBottom", offset: -2, fontSize: 12 }} />
        <YAxis type="category" dataKey="broker" fontSize={12} width={100} />
        <Tooltip
          formatter={(value: number, _name: string, props: { payload: { share: number } }) => [
            `${value.toFixed(2)} (${props.payload.share.toFixed(1)}%)`,
            metricLabel,
          ]}
        />
        <Bar dataKey="value" label={{ position: "right", fontSize: 11, formatter: (v: number) => v.toFixed(0) }}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={getRankColor(entry.rank, chartData.length)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 5: Create `src/components/charts/MarketShareTable.tsx`**

```tsx
import { useState } from "react";
import type { MarketShareRow } from "../../types";

interface Props {
  data: MarketShareRow[];
}

type SortKey = "broker" | "currentValue" | "currentShare" | "previousValue" | "previousShare" | "shareChange";

export function MarketShareTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("currentValue");
  const [sortAsc, setSortAsc] = useState(false);

  if (data.length === 0) return null;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return "";
    return sortAsc ? " ↑" : " ↓";
  };

  return (
    <div className="overflow-x-auto">
      <table className="summary-table">
        <thead>
          <tr>
            <th className="th-broker cursor-pointer" onClick={() => handleSort("broker")}>
              券商{sortIndicator("broker")}
            </th>
            <th className="th-etf cursor-pointer" onClick={() => handleSort("currentValue")}>
              本期成交{sortIndicator("currentValue")}
            </th>
            <th className="th-etf cursor-pointer" onClick={() => handleSort("currentShare")}>
              占比{sortIndicator("currentShare")}
            </th>
            <th className="th-sub cursor-pointer" onClick={() => handleSort("previousValue")}>
              上期成交{sortIndicator("previousValue")}
            </th>
            <th className="th-sub cursor-pointer" onClick={() => handleSort("previousShare")}>
              占比{sortIndicator("previousShare")}
            </th>
            <th className="th-total cursor-pointer" onClick={() => handleSort("shareChange")}>
              变化{sortIndicator("shareChange")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.broker} className={i % 2 === 0 ? "row-even" : "row-odd"}>
              <td className="td-broker">{row.broker}</td>
              <td className="td-num">{row.currentValue.toFixed(2)}</td>
              <td className="td-num">{row.currentShare.toFixed(1)}%</td>
              <td className="td-num">{row.previousValue.toFixed(2)}</td>
              <td className="td-num">{row.previousShare.toFixed(1)}%</td>
              <td className="td-num">
                <ShareChangeCell change={row.shareChange} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShareChangeCell({ change }: { change: number }) {
  if (Math.abs(change) < 0.05) {
    return <span className="text-gray-500">—</span>;
  }
  if (change > 0) {
    return <span className="text-green-600">↑+{change.toFixed(1)}%</span>;
  }
  return <span className="text-red-600">↓{change.toFixed(1)}%</span>;
}
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run build
```

Expected: Build succeeds (components not yet consumed by App, but should compile).

- [ ] **Step 7: Commit**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator
git add src/components/charts/
git commit -m "Add chart components: TrendChart, RankingChart, ChartControls, MarketShareTable"
```

---

### Task 8: Create AnalyticsView Container

**Files:**
- Create: `src/components/AnalyticsView.tsx`

- [ ] **Step 1: Create `src/components/AnalyticsView.tsx`**

```tsx
import type {
  TrendSeries,
  RankingEntry,
  MarketShareRow,
  AnalyticsQuery,
} from "../types";
import { ChartControls } from "./charts/ChartControls";
import { TrendChart } from "./charts/TrendChart";
import { RankingChart } from "./charts/RankingChart";
import { MarketShareTable } from "./charts/MarketShareTable";

interface Props {
  query: AnalyticsQuery;
  onQueryChange: (query: AnalyticsQuery) => void;
  trendSeries: TrendSeries | null;
  rankings: RankingEntry[];
  marketShare: MarketShareRow[];
  availableYears: string[];
  availableBrokers: string[];
  availableProducts: { code: string; name: string }[];
}

export function AnalyticsView({
  query,
  onQueryChange,
  trendSeries,
  rankings,
  marketShare,
  availableYears,
  availableBrokers,
  availableProducts,
}: Props) {
  return (
    <div className="mt-6">
      <ChartControls
        query={query}
        onChange={onQueryChange}
        availableYears={availableYears}
        availableBrokers={availableBrokers}
        availableProducts={availableProducts}
      />

      {trendSeries && trendSeries.points.length > 0 && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            {query.metric === "trading" ? "成交量趋势" : "持仓趋势"} (单位: 万元)
          </h2>
          <TrendChart data={trendSeries} chartType={query.chartType} />
        </div>
      )}

      {rankings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            券商排名
          </h2>
          <RankingChart data={rankings} metric={query.metric} />
        </div>
      )}

      {marketShare.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            市场份额变化
          </h2>
          <MarketShareTable data={marketShare} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator
git add src/components/AnalyticsView.tsx
git commit -m "Add AnalyticsView container component"
```

---

### Task 9: Wire Everything Into App

**Files:**
- Modify: `src/components/ViewSwitcher.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update `src/components/ViewSwitcher.tsx`**

Add "analytics" to the ViewType union and add the 4th tab button. The full file:

```tsx
export type ViewType = "daily" | "yearly" | "custom" | "analytics";

interface Props {
  currentView: ViewType;
  onChange: (view: ViewType) => void;
}

export function ViewSwitcher({ currentView, onChange }: Props) {
  return (
    <div className="view-switcher">
      <button
        className={`view-tab ${currentView === "daily" ? "view-tab-active" : ""}`}
        onClick={() => onChange("daily")}
      >
        每日成交汇总
      </button>
      <button
        className={`view-tab ${currentView === "yearly" ? "view-tab-active" : ""}`}
        onClick={() => onChange("yearly")}
      >
        年度日均成交与持仓
      </button>
      <button
        className={`view-tab ${currentView === "custom" ? "view-tab-active" : ""}`}
        onClick={() => onChange("custom")}
      >
        自定义分析
      </button>
      <button
        className={`view-tab ${currentView === "analytics" ? "view-tab-active" : ""}`}
        onClick={() => onChange("analytics")}
      >
        数据分析
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/App.tsx`**

Add imports, state, and rendering for the analytics view. The full file:

```tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useFileManager } from "./hooks/useFileManager";
import { useSummaryData } from "./hooks/useSummaryData";
import { useYearlyData } from "./hooks/useYearlyData";
import { usePivotData } from "./hooks/usePivotData";
import { useAnalyticsData } from "./hooks/useAnalyticsData";
import { FileUploader } from "./components/FileUploader";
import { FileList } from "./components/FileList";
import { DateSelector } from "./components/DateSelector";
import { YearSelector } from "./components/YearSelector";
import { ViewSwitcher, type ViewType } from "./components/ViewSwitcher";
import { SummaryTable } from "./components/SummaryTable";
import { YearlyTable } from "./components/YearlyTable";
import { PivotTable } from "./components/PivotTable";
import { AnalyticsView } from "./components/AnalyticsView";
import { DimensionSelector } from "./components/DimensionSelector";
import { ExportButton } from "./components/ExportButton";
import { YearlyExportButton } from "./components/YearlyExportButton";
import { PivotExportButton } from "./components/PivotExportButton";
import type { PivotQuery, AnalyticsQuery } from "./types";
import "./App.css";

const DEFAULT_PIVOT_QUERY: PivotQuery = {
  rowDim: "product",
  colDim: "broker",
  filters: { year: "" },
};

const DEFAULT_ANALYTICS_QUERY: AnalyticsQuery = {
  year: "",
  metric: "trading",
  granularity: "daily",
  chartType: "line",
  selectedBrokers: [],
  selectedProducts: [],
};

function App() {
  const { files, addFiles, removeFile, clearFiles } = useFileManager();
  const [currentView, setCurrentView] = useState<ViewType>("daily");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [pivotQuery, setPivotQuery] = useState<PivotQuery>(DEFAULT_PIVOT_QUERY);
  const [analyticsQuery, setAnalyticsQuery] = useState<AnalyticsQuery>(DEFAULT_ANALYTICS_QUERY);

  const { pivotData, availableDates, anomalyFlags, loading, error } = useSummaryData(files, selectedDate);
  const { yearlyData, availableYears, loading: yearlyLoading, error: yearlyError } = useYearlyData(files, selectedYear);

  // Stabilize pivotQuery reference for usePivotData
  const stablePivotQuery = useMemo(() => pivotQuery, [
    pivotQuery.rowDim,
    pivotQuery.colDim,
    pivotQuery.filters.year,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(pivotQuery.filters.brokers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(pivotQuery.filters.products),
  ]);

  const {
    pivotData: customPivotData,
    availableYears: customAvailableYears,
    availableBrokers: customAvailableBrokers,
    availableProducts: customAvailableProducts,
    loading: customLoading,
    error: customError,
  } = usePivotData(files, stablePivotQuery);

  const {
    trendSeries,
    rankings,
    marketShare,
    availableYears: analyticsAvailableYears,
    availableBrokers: analyticsBrokers,
    availableProducts: analyticsProducts,
    loading: analyticsLoading,
    error: analyticsError,
  } = useAnalyticsData(files, analyticsQuery);

  // When custom available years load and no year is selected, pick the first
  useEffect(() => {
    if (customAvailableYears.length > 0 && !pivotQuery.filters.year) {
      setPivotQuery((q) => ({ ...q, filters: { ...q.filters, year: customAvailableYears[0] } }));
    }
  }, [customAvailableYears, pivotQuery.filters.year]);

  // When analytics available years load and no year is selected, pick the first
  useEffect(() => {
    if (analyticsAvailableYears.length > 0 && !analyticsQuery.year) {
      setAnalyticsQuery((q) => ({ ...q, year: analyticsAvailableYears[0] }));
    }
  }, [analyticsAvailableYears, analyticsQuery.year]);

  const handlePivotQueryChange = useCallback((q: PivotQuery) => {
    setPivotQuery(q);
  }, []);

  const handleAnalyticsQueryChange = useCallback((q: AnalyticsQuery) => {
    setAnalyticsQuery(q);
  }, []);

  // Reset selections when files change
  useEffect(() => {
    setSelectedDate(null);
    setSelectedYear(null);
    setPivotQuery(DEFAULT_PIVOT_QUERY);
    setAnalyticsQuery(DEFAULT_ANALYTICS_QUERY);
  }, [files]);

  const isLoading = currentView === "daily" ? loading
    : currentView === "yearly" ? yearlyLoading
    : currentView === "custom" ? customLoading
    : analyticsLoading;

  const currentError = currentView === "daily" ? error
    : currentView === "yearly" ? yearlyError
    : currentView === "custom" ? customError
    : analyticsError;

  return (
    <div className="min-h-screen bg-white p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">做市数据汇总</h1>

      <FileUploader onFilesAdded={addFiles} />
      <FileList files={files} onRemove={removeFile} onClear={clearFiles} />

      {files.length > 0 && (
        <ViewSwitcher currentView={currentView} onChange={setCurrentView} />
      )}

      {currentView === "daily" && availableDates.length > 0 && (
        <DateSelector
          dates={availableDates}
          selectedDate={selectedDate}
          onChange={setSelectedDate}
        />
      )}

      {currentView === "yearly" && availableYears.length > 0 && (
        <YearSelector
          years={availableYears}
          selectedYear={selectedYear}
          onChange={setSelectedYear}
        />
      )}

      {isLoading && (
        <div className="mt-4 text-blue-600">正在解析文件...</div>
      )}
      {currentError && (
        <div className="mt-4 text-red-600">{currentError}</div>
      )}

      {currentView === "daily" && pivotData && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-700">
              数据预览 (单位: 万元)
            </h2>
            <ExportButton data={pivotData} />
          </div>
          <SummaryTable data={pivotData} anomalyFlags={anomalyFlags} />
        </div>
      )}

      {currentView === "yearly" && yearlyData && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-700">
              年度日均成交与持仓 (单位: 万元)
            </h2>
            <YearlyExportButton data={yearlyData} />
          </div>
          <YearlyTable data={yearlyData} />
        </div>
      )}

      {currentView === "custom" && files.length > 0 && (
        <div className="mt-6">
          <DimensionSelector
            query={pivotQuery}
            onChange={handlePivotQueryChange}
            availableYears={customAvailableYears}
            availableBrokers={customAvailableBrokers}
            availableProducts={customAvailableProducts}
          />
          {customPivotData && (
            <>
              <div className="flex items-center justify-between mb-3 mt-4">
                <h2 className="text-lg font-semibold text-gray-700">
                  自定义分析 (单位: 万元)
                </h2>
                <PivotExportButton data={customPivotData} />
              </div>
              <PivotTable data={customPivotData} />
            </>
          )}
        </div>
      )}

      {currentView === "analytics" && files.length > 0 && (
        <AnalyticsView
          query={analyticsQuery}
          onQueryChange={handleAnalyticsQueryChange}
          trendSeries={trendSeries}
          rankings={rankings}
          marketShare={marketShare}
          availableYears={analyticsAvailableYears}
          availableBrokers={analyticsBrokers}
          availableProducts={analyticsProducts}
        />
      )}

      {!isLoading && !currentError && files.length === 0 && (
        <div className="mt-8 text-center text-gray-400">
          请上传做市交易数据 Excel 文件
        </div>
      )}
    </div>
  );
}

export default App;
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual smoke test**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run dev
```

Open the app, upload sample Excel files, verify:
1. All 4 tabs appear in the view switcher
2. Daily view still works as before, with green/red anomaly highlighting on unusual cells
3. Analytics tab shows: controls at top, trend chart, ranking bar chart, market share table
4. Switching metric/granularity/chart type updates charts correctly
5. Multi-select broker/product filters work

- [ ] **Step 5: Commit**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator
git add src/components/ViewSwitcher.tsx src/App.tsx
git commit -m "Wire analytics view into app with 4th tab"
```

---

### Task 10: Final Build Verification and Cleanup

- [ ] **Step 1: Full production build**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator && npm run build
```

Expected: Build succeeds with no TypeScript errors and no warnings.

- [ ] **Step 2: Check for unused imports or variables**

The TypeScript config has `noUnusedLocals: true` and `noUnusedParameters: true`, so the build in Step 1 will catch these. If any are found, fix them.

- [ ] **Step 3: Final commit if any cleanup was needed**

```bash
cd /Users/wenjunzhang/code/market_maker_calculator
git add -A
git commit -m "Final cleanup for analytics feature"
```
