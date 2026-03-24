import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { YearlyPivotData } from "../types";

/**
 * Generate an Excel file for yearly pivot data.
 *   Row 0: year | broker names (merged 2 cols each) | 合计 (merged 2 cols)
 *   Row 1: 名称 | 代码 | 日均成交 | 日均持仓 | ... | 年均单边日均成交 | 年均持仓
 *   Row 2+: product rows
 *   Last:   合计 row
 */
export function exportYearlyToExcel(data: YearlyPivotData): Uint8Array {
  const { year, brokers, rows, brokerTotals, grandTotalTrading, grandTotalHolding } = data;

  const aoa: (string | number)[][] = [];

  // Row 0: Year + broker headers + 合计
  const header1: (string | number)[] = [`${year}年`, ""];
  for (const broker of brokers) {
    header1.push(broker);
    header1.push("");
  }
  header1.push("合计");
  header1.push("");
  aoa.push(header1);

  // Row 1: 名称 | 代码 | sub-headers
  const header2: (string | number)[] = ["名称", "代码"];
  for (let i = 0; i < brokers.length; i++) {
    header2.push("日均成交");
    header2.push("日均持仓");
  }
  header2.push("年均单边日均成交");
  header2.push("年均持仓");
  aoa.push(header2);

  // Data rows
  for (const row of rows) {
    const dataRow: (string | number)[] = [row.productName, row.productCode];
    for (const broker of brokers) {
      const cell = row.cells[broker] || { avgDailyTrading: 0, avgDailyHolding: 0 };
      dataRow.push(cell.avgDailyTrading === 0 ? "" : round2(cell.avgDailyTrading));
      dataRow.push(cell.avgDailyHolding === 0 ? "" : round2(cell.avgDailyHolding));
    }
    dataRow.push(row.totalTrading === 0 ? "" : round2(row.totalTrading));
    dataRow.push(row.totalHolding === 0 ? "" : round2(row.totalHolding));
    aoa.push(dataRow);
  }

  // Totals row
  const totalRow: (string | number)[] = ["合计", ""];
  for (const broker of brokers) {
    const cell = brokerTotals[broker] || { avgDailyTrading: 0, avgDailyHolding: 0 };
    totalRow.push(cell.avgDailyTrading === 0 ? "" : round2(cell.avgDailyTrading));
    totalRow.push(cell.avgDailyHolding === 0 ? "" : round2(cell.avgDailyHolding));
  }
  totalRow.push(grandTotalTrading === 0 ? "" : round2(grandTotalTrading));
  totalRow.push(grandTotalHolding === 0 ? "" : round2(grandTotalHolding));
  aoa.push(totalRow);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Cell merges
  const merges: XLSX.Range[] = [];

  // Year label spans 2 columns in row 0
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });

  // Each broker header spans 2 columns in row 0
  for (let i = 0; i < brokers.length; i++) {
    const colStart = 2 + i * 2;
    merges.push({ s: { r: 0, c: colStart }, e: { r: 0, c: colStart + 1 } });
  }

  // "合计" header spans 2 columns in row 0
  const totalColStart = 2 + brokers.length * 2;
  merges.push({ s: { r: 0, c: totalColStart }, e: { r: 0, c: totalColStart + 1 } });

  ws["!merges"] = merges;

  // Set column widths
  const colWidths: XLSX.ColInfo[] = [{ wch: 14 }, { wch: 10 }]; // name + code
  for (let i = 0; i < brokers.length * 2 + 2; i++) {
    colWidths.push({ wch: 14 });
  }
  ws["!cols"] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "年度日均成交与持仓");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbout);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Open a save dialog and write the exported yearly Excel file.
 */
export async function downloadYearlyExcel(data: YearlyPivotData): Promise<void> {
  const defaultName = `年度日均成交与持仓_${data.year}.xlsx`;

  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });

  if (!filePath) return;

  const buffer = exportYearlyToExcel(data);
  await writeFile(filePath, buffer);
}
