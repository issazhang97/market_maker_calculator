import { useState, useEffect } from "react";
import type { LoadedFile, TradeRecord, YearlyPivotData } from "../types";
import { parseExcelFile } from "../services/excelParser";
import { extractAvailableYears, aggregateYearlyData } from "../services/yearlyAggregator";

export function useYearlyData(files: LoadedFile[], selectedYear: string | null) {
  const [yearlyData, setYearlyData] = useState<YearlyPivotData | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (files.length === 0) {
      setYearlyData(null);
      setAvailableYears([]);
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
          setYearlyData(null);
          setAvailableYears([]);
          setError("未找到有效的交易数据。请检查文件格式是否正确。");
          setLoading(false);
          return;
        }

        if (cancelled) return;

        const years = extractAvailableYears(allRecords);
        setAvailableYears(years);

        const targetYear = selectedYear && years.includes(selectedYear) ? selectedYear : years[0];
        if (targetYear) {
          const data = aggregateYearlyData(allRecords, targetYear);
          setYearlyData(data);
        } else {
          setYearlyData(null);
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
  }, [files, selectedYear]);

  return { yearlyData, availableYears, loading, error };
}
