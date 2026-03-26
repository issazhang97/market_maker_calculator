# Analytics Feature Design

## Overview

Add a dedicated "数据分析" (Analytics) tab to the market maker calculator with interactive trend charts, broker ranking/market share tracking, and anomaly detection with visual highlighting in existing tables.

**Charting library:** Recharts (React-native, ~200KB, JSX API)

## Feature 1: Trend Visualization

### New Analytics Tab

A 4th tab "数据分析" in `ViewSwitcher`, containing interactive charts for exploring trading volume and holding trends over time.

### Controls (ChartControls)

- **Metric toggle:** 成交量 (trading volume) / 持仓 (holdings)
- **Granularity toggle:** 日 (daily) / 周 (weekly) / 月 (monthly)
- **Broker selector:** multi-select dropdown, pick which brokers to show as separate lines/bars. Default: top 5 by volume
- **Product selector:** multi-select dropdown, pick which ETFs. Default: all products aggregated into total
- **Year filter:** year selector (same pattern as other views)

### Chart Types

- **Line chart** (default): shows volume/holding trajectory over time, one line per selected broker
- **Bar chart** (toggle): better for comparing discrete periods (weekly/monthly)

### Aggregation Logic

- **Daily:** raw values per date. Single-sided trading = `(buyAmount + sellAmount) / 2`, holding = `holdingAmount`
- **Weekly:** sum daily values within Mon-Sun, divide by active trading days in that week
- **Monthly:** sum daily values within calendar month, divide by active trading days in that month

### Chart Features

- Recharts `<Tooltip>` on hover showing exact values
- `<Legend>` showing broker/product color mapping
- Responsive width (fills container)
- Y-axis label: "万元"

### Layout

Controls at top, chart below, full width. Stacked vertically in the Analytics tab.

## Feature 2: Ranking & Change Tracking

Located below the trend chart in the Analytics tab.

### 2a. Broker Ranking Bar Chart

- Horizontal bar chart showing brokers ranked by total trading volume (or holding) for the selected time period
- Bars colored by rank position (gradient from top to bottom)
- Numeric value displayed at the end of each bar
- Same controls apply (metric toggle, year/product filters)

### 2b. Market Share Comparison Table

A compact table showing period-over-period comparison:

| Column | Description |
|--------|-------------|
| 券商 | Broker name |
| 本期成交 | Current period trading volume |
| 占比 | Current period market share % |
| 上期成交 | Previous period trading volume |
| 占比 | Previous period market share % |
| 变化 | Share change with directional indicator |

- Period is defined by the granularity toggle (monthly = current vs previous month, weekly = current vs previous week)
- Visual indicators: green ↑ for rising share, red ↓ for falling, — for unchanged
- Sortable by any column

## Feature 3: Anomaly Detection

### Algorithm

- For each broker x product combination, compute a **rolling 20-day mean and standard deviation** of daily trading volume
- Flag days where value falls outside **mean +/- 2 sigma**
- Two flag types:
  - **Spike:** value > mean + 2sigma (unusually high)
  - **Drop:** value < mean - 2sigma (unusually low)
- Minimum 5 data points required before flagging starts (avoid false positives on sparse data)
- Hardcoded parameters: 20-day window, 2sigma threshold (no configuration UI)

### Visual Highlighting

Applied only to **SummaryTable** (daily view), on "昨日成交" cells:

- **Spike:** light green background (`bg-green-100`) with small ▲ indicator
- **Drop:** light red background (`bg-red-100`) with small ▼ indicator
- Hover tooltip: "异常: 当日成交 X万, 20日均值 Y万 (+/-2sigma: A-B万)"

**Not applied to** YearlyTable or PivotTable (these show averages, not individual days).

### Data Flow

`anomalyDetector.ts` takes `TradeRecord[]` and target date, returns:
```typescript
Record<string, Record<string, AnomalyFlag>>
// keyed by broker -> fundTicker -> { type: 'spike'|'drop', mean, stddev, value }
```

`useSummaryData` hook calls the detector and passes flags to `SummaryTable`.

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/services/analyticsAggregator.ts` | Compute trend series and rankings from `TradeRecord[]` |
| `src/services/anomalyDetector.ts` | Compute anomaly flags (rolling mean +/- 2sigma) |
| `src/hooks/useAnalyticsData.ts` | Hook wiring aggregator to file/filter state |
| `src/components/AnalyticsView.tsx` | Main analytics container with sub-sections |
| `src/components/charts/TrendChart.tsx` | Line/bar chart for volume/holding trends |
| `src/components/charts/RankingChart.tsx` | Horizontal bar chart for broker rankings |
| `src/components/charts/ChartControls.tsx` | Filters: broker/product multi-select, granularity toggle, metric toggle |
| `src/components/charts/MarketShareTable.tsx` | Period-over-period market share comparison table |

### Modified Files

| File | Change |
|------|--------|
| `src/components/ViewSwitcher.tsx` | Add "数据分析" as 4th tab |
| `src/App.tsx` | Wire up analytics view, hook, and state |
| `src/components/SummaryTable.tsx` | Apply anomaly highlighting CSS classes to flagged cells |
| `src/types/index.ts` | Add analytics-related type definitions |

### Data Flow

```
TradeRecord[]
    |
    +---> analyticsAggregator.ts ---> { trendSeries, rankings, marketShare }
    |                                        |
    |                                  AnalyticsView.tsx
    |                                   +-- TrendChart
    |                                   +-- RankingChart
    |                                   +-- MarketShareTable
    |
    +---> anomalyDetector.ts ----------> anomalyFlags
                                              |
                                        SummaryTable.tsx (cell highlighting)
```

### New Dependency

- `recharts` — React charting library

## Types

```typescript
// Trend data point
interface TrendPoint {
  date: string;           // YYYY-MM-DD or period label
  values: Record<string, number>; // keyed by broker or product name
}

// Trend series for chart rendering
interface TrendSeries {
  points: TrendPoint[];
  keys: string[];         // broker or product names (chart lines)
  metric: "trading" | "holding";
  granularity: "daily" | "weekly" | "monthly";
}

// Ranking entry
interface RankingEntry {
  broker: string;
  value: number;
  share: number;          // percentage 0-100
  rank: number;
}

// Market share comparison row
interface MarketShareRow {
  broker: string;
  currentValue: number;
  currentShare: number;
  previousValue: number;
  previousShare: number;
  shareChange: number;    // positive = gained share
}

// Anomaly flag
interface AnomalyFlag {
  type: "spike" | "drop";
  value: number;
  mean: number;
  stddev: number;
}

// Analytics query state
interface AnalyticsQuery {
  year: string;
  metric: "trading" | "holding";
  granularity: "daily" | "weekly" | "monthly";
  chartType: "line" | "bar";
  selectedBrokers: string[];
  selectedProducts: string[];
}
```
