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
