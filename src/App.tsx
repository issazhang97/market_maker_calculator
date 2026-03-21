import { useState, useEffect } from "react";
import { useFileManager } from "./hooks/useFileManager";
import { useSummaryData } from "./hooks/useSummaryData";
import { FileUploader } from "./components/FileUploader";
import { FileList } from "./components/FileList";
import { DateSelector } from "./components/DateSelector";
import { SummaryTable } from "./components/SummaryTable";
import { ExportButton } from "./components/ExportButton";
import "./App.css";

function App() {
  const { files, addFiles, removeFile, clearFiles } = useFileManager();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { pivotData, availableDates, loading, error } = useSummaryData(files, selectedDate);

  // Reset selected date when files change
  useEffect(() => {
    setSelectedDate(null);
  }, [files]);

  return (
    <div className="min-h-screen bg-white p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">做市数据汇总</h1>

      <FileUploader onFilesAdded={addFiles} />
      <FileList files={files} onRemove={removeFile} onClear={clearFiles} />

      {availableDates.length > 0 && (
        <DateSelector
          dates={availableDates}
          selectedDate={selectedDate}
          onChange={setSelectedDate}
        />
      )}

      {loading && (
        <div className="mt-4 text-blue-600">正在解析文件...</div>
      )}
      {error && (
        <div className="mt-4 text-red-600">{error}</div>
      )}

      {pivotData && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-700">
              数据预览 (单位: 万元)
            </h2>
            <ExportButton data={pivotData} />
          </div>
          <SummaryTable data={pivotData} />
        </div>
      )}

      {!loading && !error && !pivotData && files.length === 0 && (
        <div className="mt-8 text-center text-gray-400">
          请上传做市交易数据 Excel 文件
        </div>
      )}
    </div>
  );
}

export default App;
