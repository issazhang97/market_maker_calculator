import { useState, useEffect } from "react";
import type { LoadedFile, TradeRecord, PivotQuery, GenericPivotData } from "../types";
import { parseExcelFile } from "../services/excelParser";
import { extractAvailableYears } from "../services/yearlyAggregator";
import { aggregatePivot, extractFilterOptions } from "../services/pivotAggregator";

export function usePivotData(files: LoadedFile[], query: PivotQuery) {
  const [pivotData, setPivotData] = useState<GenericPivotData | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableBrokers, setAvailableBrokers] = useState<string[]>([]);
  const [availableProducts, setAvailableProducts] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (files.length === 0) {
      setPivotData(null);
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
          setPivotData(null);
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

        const targetYear = query.filters.year && years.includes(query.filters.year)
          ? query.filters.year
          : years[0];

        if (!targetYear) {
          setPivotData(null);
          setLoading(false);
          return;
        }

        // Extract filter options for the selected year
        const options = extractFilterOptions(allRecords, targetYear);
        setAvailableBrokers(options.brokers);
        setAvailableProducts(options.products);

        // Build the effective query with the resolved year
        const effectiveQuery: PivotQuery = {
          ...query,
          filters: { ...query.filters, year: targetYear },
        };

        const data = aggregatePivot(allRecords, effectiveQuery);
        setPivotData(data);
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
  }, [files, query]);

  return { pivotData, availableYears, availableBrokers, availableProducts, loading, error };
}
