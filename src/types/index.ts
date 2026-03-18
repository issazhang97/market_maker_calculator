export interface TradeRecord {
  fundTicker: string;   // ETF code (from sheet name)
  broker: string;       // 券商名称
  date: string;         // 交易日期 (YYYY-MM-DD or similar)
  buyAmount: number;    // 买入金额
  sellAmount: number;   // 卖出金额
}

export interface ETFSummaryCell {
  past5DaysAvg: number; // 过去5日平均成交 (万元)
  yesterday: number;    // 昨日成交 (万元)
}

export interface PivotRow {
  broker: string;
  cells: Record<string, ETFSummaryCell>; // keyed by ETF code
  total: ETFSummaryCell;                 // row total
}

export interface PivotData {
  date: string;              // e.g. "2026/03/17/星期二"
  etfCodes: string[];        // ordered ETF codes
  etfNames: Record<string, string>; // code -> name
  rows: PivotRow[];          // broker rows sorted by total desc
  totals: Record<string, ETFSummaryCell>; // column totals
  grandTotal: ETFSummaryCell;
}

export interface LoadedFile {
  name: string;
  data: ArrayBuffer;
}
