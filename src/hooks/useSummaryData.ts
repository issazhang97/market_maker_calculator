import { useState, useEffect } from "react";
import type { LoadedFile, TradeRecord, PivotData } from "../types";
import { parseExcelFile } from "../services/excelParser";
import { fetchETFNames } from "../services/etfNameService";
import { aggregateData } from "../services/dataAggregator";

export function useSummaryData(files: LoadedFile[]) {
  const [pivotData, setPivotData] = useState<PivotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (files.length === 0) {
      setPivotData(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function process() {
      setLoading(true);
      setError(null);

      try {
        // Parse all files
        const allRecords: TradeRecord[] = [];
        for (const file of files) {
          const records = parseExcelFile(file.data);
          allRecords.push(...records);
        }

        if (allRecords.length === 0) {
          setPivotData(null);
          setError("未找到有效的交易数据。请检查文件格式是否正确。");
          setLoading(false);
          return;
        }

        // Get unique ETF codes
        const etfCodes = [...new Set(allRecords.map((r) => r.fundTicker))];

        // Fetch ETF names
        const etfNames = await fetchETFNames(etfCodes);

        if (cancelled) return;

        // Aggregate
        const data = aggregateData(allRecords, etfNames);
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
  }, [files]);

  return { pivotData, loading, error };
}
