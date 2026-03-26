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
