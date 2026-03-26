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

        const dates = extractAvailableDates(allRecords);
        setAvailableDates(dates);

        const data = aggregateData(allRecords, selectedDate || undefined);
        setPivotData(data);

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
