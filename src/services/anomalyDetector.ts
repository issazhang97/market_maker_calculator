import type { TradeRecord, AnomalyFlags } from "../types";

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
