import { useState } from "react";
import type { YearlyPivotData } from "../types";
import { downloadYearlyExcel } from "../services/yearlyExporter";

interface Props {
  data: YearlyPivotData | null;
}

export function YearlyExportButton({ data }: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  if (!data) return null;

  const handleExport = async () => {
    setStatus("saving");
    try {
      await downloadYearlyExcel(data);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error("Export failed:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={status === "saving"}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
    >
      {status === "saving" && "正在保存..."}
      {status === "done" && "已保存"}
      {status === "error" && "保存失败"}
      {status === "idle" && "导出 Excel"}
    </button>
  );
}
