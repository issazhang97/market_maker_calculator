import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { PivotData } from "../types";

/**
 * Generate an Excel file matching the output format:
 *   Row 0: date/weekday | product name (merged 2 cols) | ... | 合计 (merged 2 cols)
 *   Row 1: (万元)       | 过去5日平均成交 | 昨日成交 | ...
 *   Row 2+: broker      | values (2 decimal, blank if 0) ...
 *   Last:   合计         | column sums ...
 */
export function exportToExcel(data: PivotData): Uint8Array {
  const { products, rows, totals, grandTotal, date } = data;

  const aoa: (string | number)[][] = [];

  // Row 0: Date + product name headers
  const header1: (string | number)[] = [date];
  for (const name of products) {
    header1.push(name);
    header1.push("");
  }
  header1.push("合计");
  header1.push("");
  aoa.push(header1);

  // Row 1: (万元) + sub-headers
  const header2: (string | number)[] = ["(万元)"];
  for (let i = 0; i < products.length; i++) {
    header2.push("过去5日平均成交");
    header2.push("昨日成交");
  }
  header2.push("过去5日平均成交");
  header2.push("昨日成交");
  aoa.push(header2);

  // Data rows
  for (const row of rows) {
    const dataRow: (string | number)[] = [row.broker];
    for (const name of products) {
      const cell = row.cells[name] || { past5DaysAvg: 0, yesterday: 0 };
      dataRow.push(cell.past5DaysAvg === 0 ? "" : round2(cell.past5DaysAvg));
      dataRow.push(cell.yesterday === 0 ? "" : round2(cell.yesterday));
    }
    dataRow.push(row.total.past5DaysAvg === 0 ? "" : round2(row.total.past5DaysAvg));
    dataRow.push(row.total.yesterday === 0 ? "" : round2(row.total.yesterday));
    aoa.push(dataRow);
  }

  // Totals row
  const totalRow: (string | number)[] = ["合计"];
  for (const name of products) {
    const cell = totals[name] || { past5DaysAvg: 0, yesterday: 0 };
    totalRow.push(cell.past5DaysAvg === 0 ? "" : round2(cell.past5DaysAvg));
    totalRow.push(cell.yesterday === 0 ? "" : round2(cell.yesterday));
  }
  totalRow.push(grandTotal.past5DaysAvg === 0 ? "" : round2(grandTotal.past5DaysAvg));
  totalRow.push(grandTotal.yesterday === 0 ? "" : round2(grandTotal.yesterday));
  aoa.push(totalRow);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Cell merges
  const merges: XLSX.Range[] = [];

  // Each product name header spans 2 columns in row 0
  for (let i = 0; i < products.length; i++) {
    const colStart = 1 + i * 2;
    merges.push({ s: { r: 0, c: colStart }, e: { r: 0, c: colStart + 1 } });
  }

  // "合计" header spans 2 columns in row 0
  const totalColStart = 1 + products.length * 2;
  merges.push({ s: { r: 0, c: totalColStart }, e: { r: 0, c: totalColStart + 1 } });

  ws["!merges"] = merges;

  // Set column widths
  const colWidths: XLSX.ColInfo[] = [{ wch: 18 }]; // date / broker column
  for (let i = 0; i < products.length * 2 + 2; i++) {
    colWidths.push({ wch: 14 });
  }
  ws["!cols"] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "做市成交汇总");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbout);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Open a save dialog and write the exported Excel file.
 */
export async function downloadExcel(data: PivotData): Promise<void> {
  const defaultName = `做市成交汇总_${data.date.replace(/\//g, "")}.xlsx`;

  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });

  if (!filePath) return;

  const buffer = exportToExcel(data);
  await writeFile(filePath, buffer);
}
