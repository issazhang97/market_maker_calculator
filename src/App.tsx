import { useState, useEffect, useMemo, useCallback } from "react";
import { useFileManager } from "./hooks/useFileManager";
import { useSummaryData } from "./hooks/useSummaryData";
import { useYearlyData } from "./hooks/useYearlyData";
import { usePivotData } from "./hooks/usePivotData";
import { FileUploader } from "./components/FileUploader";
import { FileList } from "./components/FileList";
import { DateSelector } from "./components/DateSelector";
import { YearSelector } from "./components/YearSelector";
import { ViewSwitcher, type ViewType } from "./components/ViewSwitcher";
import { SummaryTable } from "./components/SummaryTable";
import { YearlyTable } from "./components/YearlyTable";
import { PivotTable } from "./components/PivotTable";
import { DimensionSelector } from "./components/DimensionSelector";
import { ExportButton } from "./components/ExportButton";
import { YearlyExportButton } from "./components/YearlyExportButton";
import { PivotExportButton } from "./components/PivotExportButton";
import type { PivotQuery } from "./types";
import "./App.css";

const DEFAULT_PIVOT_QUERY: PivotQuery = {
  rowDim: "product",
  colDim: "broker",
  filters: { year: "" },
};

function App() {
  const { files, addFiles, removeFile, clearFiles } = useFileManager();
  const [currentView, setCurrentView] = useState<ViewType>("daily");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [pivotQuery, setPivotQuery] = useState<PivotQuery>(DEFAULT_PIVOT_QUERY);
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

  // When custom available years load and no year is selected, pick the first
  useEffect(() => {
    if (customAvailableYears.length > 0 && !pivotQuery.filters.year) {
      setPivotQuery((q) => ({ ...q, filters: { ...q.filters, year: customAvailableYears[0] } }));
    }
  }, [customAvailableYears, pivotQuery.filters.year]);

  const handlePivotQueryChange = useCallback((q: PivotQuery) => {
    setPivotQuery(q);
  }, []);

  // Reset selections when files change
  useEffect(() => {
    setSelectedDate(null);
    setSelectedYear(null);
    setPivotQuery(DEFAULT_PIVOT_QUERY);
  }, [files]);

  const isLoading = currentView === "daily" ? loading : currentView === "yearly" ? yearlyLoading : customLoading;
  const currentError = currentView === "daily" ? error : currentView === "yearly" ? yearlyError : customError;

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

      {!isLoading && !currentError && files.length === 0 && (
        <div className="mt-8 text-center text-gray-400">
          请上传做市交易数据 Excel 文件
        </div>
      )}
    </div>
  );
}

export default App;
