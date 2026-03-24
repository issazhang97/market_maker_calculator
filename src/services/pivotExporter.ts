import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { GenericPivotData } from "../types";

const DIM_LABELS: Record<string, string> = {
  product: "产品",
  broker: "券商",
  quarter: "季度",
  month: "月份",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cellVal(n: number): string | number {
  return n === 0 ? "" : round2(n);
}

/**
 * Generate an Excel file for generic pivot data.
 */
export function exportPivotToExcel(data: GenericPivotData): Uint8Array {
  const { query, rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal } = data;
  const isProductRow = query.rowDim === "product";
  const rowLabelCols = isProductRow ? 2 : 1;

  const aoa: (string | number)[][] = [];

  // Row 0: title + col headers (each span 2) + 合计
  const header1: (string | number)[] = [data.title];
  for (let i = 1; i < rowLabelCols; i++) header1.push("");
  for (const col of colKeys) {
    header1.push(col.label);
    header1.push("");
  }
  header1.push("合计");
  header1.push("");
  aoa.push(header1);

  // Row 1: sub-headers
  const header2: (string | number)[] = isProductRow
    ? ["名称", "代码"]
    : [query.rowDim === "broker" ? "券商" : query.rowDim === "quarter" ? "季度" : "月份"];
  for (let i = 0; i < colKeys.length; i++) {
    header2.push("日均成交");
    header2.push("日均持仓");
  }
  header2.push("日均成交");
  header2.push("日均持仓");
  aoa.push(header2);

  // Data rows
  for (const row of rowKeys) {
    const dataRow: (string | number)[] = isProductRow
      ? [row.label, row.key]
      : [row.label];
    for (const col of colKeys) {
      const cell = cells[row.key][col.key];
      dataRow.push(cellVal(cell.avgDailyTrading));
      dataRow.push(cellVal(cell.avgDailyHolding));
    }
    const rt = rowTotals[row.key];
    dataRow.push(cellVal(rt.avgDailyTrading));
    dataRow.push(cellVal(rt.avgDailyHolding));
    aoa.push(dataRow);
  }

  // Totals row
  const totalRow: (string | number)[] = ["合计"];
  for (let i = 1; i < rowLabelCols; i++) totalRow.push("");
  for (const col of colKeys) {
    const ct = colTotals[col.key];
    totalRow.push(cellVal(ct.avgDailyTrading));
    totalRow.push(cellVal(ct.avgDailyHolding));
  }
  totalRow.push(cellVal(grandTotal.avgDailyTrading));
  totalRow.push(cellVal(grandTotal.avgDailyHolding));
  aoa.push(totalRow);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Cell merges
  const merges: XLSX.Range[] = [];

  // Title spans rowLabelCols in row 0
  if (rowLabelCols > 1) {
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: rowLabelCols - 1 } });
  }

  // Each col header spans 2 columns in row 0
  for (let i = 0; i < colKeys.length; i++) {
    const colStart = rowLabelCols + i * 2;
    merges.push({ s: { r: 0, c: colStart }, e: { r: 0, c: colStart + 1 } });
  }

  // 合计 header spans 2 columns in row 0
  const totalColStart = rowLabelCols + colKeys.length * 2;
  merges.push({ s: { r: 0, c: totalColStart }, e: { r: 0, c: totalColStart + 1 } });

  // Totals row: 合计 label spans rowLabelCols
  if (rowLabelCols > 1) {
    const lastRow = aoa.length - 1;
    merges.push({ s: { r: lastRow, c: 0 }, e: { r: lastRow, c: rowLabelCols - 1 } });
  }

  ws["!merges"] = merges;

  // Column widths
  const colWidths: XLSX.ColInfo[] = [];
  if (isProductRow) {
    colWidths.push({ wch: 14 }, { wch: 10 });
  } else {
    colWidths.push({ wch: 14 });
  }
  for (let i = 0; i < colKeys.length * 2 + 2; i++) {
    colWidths.push({ wch: 14 });
  }
  ws["!cols"] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "自定义分析");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbout);
}

/**
 * Open a save dialog and write the exported pivot Excel file.
 */
export async function downloadPivotExcel(data: GenericPivotData): Promise<void> {
  const { query } = data;
  const rowLabel = DIM_LABELS[query.rowDim] ?? query.rowDim;
  const colLabel = DIM_LABELS[query.colDim] ?? query.colDim;
  const defaultName = `自定义分析_${query.filters.year}_${rowLabel}×${colLabel}.xlsx`;

  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });

  if (!filePath) return;

  const buffer = exportPivotToExcel(data);
  await writeFile(filePath, buffer);
}
