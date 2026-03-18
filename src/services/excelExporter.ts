import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { PivotData } from "../types";

/**
 * Generate an Excel file from the pivot table data.
 * Returns a Uint8Array.
 */
export function exportToExcel(data: PivotData): Uint8Array {
  const { etfCodes, etfNames, rows, totals, grandTotal, date } = data;

  // Build array-of-arrays (AOA)
  const aoa: (string | number)[][] = [];

  // Row 0: Title row with date
  const titleRow: (string | number)[] = [`做市成交汇总 ${date}`];
  aoa.push(titleRow);

  // Row 1: Header row 1 — ETF codes (merged with row 2)
  const header1: (string | number)[] = ["券商名称"];
  for (const code of etfCodes) {
    const name = etfNames[code] || code;
    header1.push(`${code} ${name}`);
    header1.push(""); // placeholder for merged cell
  }
  header1.push("合计");
  header1.push(""); // placeholder
  aoa.push(header1);

  // Row 2: Header row 2 — sub-headers
  const header2: (string | number)[] = [""];
  for (let i = 0; i < etfCodes.length; i++) {
    header2.push("过去5日平均成交");
    header2.push("昨日成交");
  }
  header2.push("过去5日平均成交");
  header2.push("昨日成交");
  aoa.push(header2);

  // Data rows
  for (const row of rows) {
    const dataRow: (string | number)[] = [row.broker];
    for (const code of etfCodes) {
      const cell = row.cells[code] || { past5DaysAvg: 0, yesterday: 0 };
      dataRow.push(Math.round(cell.past5DaysAvg));
      dataRow.push(Math.round(cell.yesterday));
    }
    dataRow.push(Math.round(row.total.past5DaysAvg));
    dataRow.push(Math.round(row.total.yesterday));
    aoa.push(dataRow);
  }

  // Totals row
  const totalRow: (string | number)[] = ["合计"];
  for (const code of etfCodes) {
    const cell = totals[code] || { past5DaysAvg: 0, yesterday: 0 };
    totalRow.push(Math.round(cell.past5DaysAvg));
    totalRow.push(Math.round(cell.yesterday));
  }
  totalRow.push(Math.round(grandTotal.past5DaysAvg));
  totalRow.push(Math.round(grandTotal.yesterday));
  aoa.push(totalRow);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Cell merges
  const merges: XLSX.Range[] = [];
  const totalCols = 1 + etfCodes.length * 2 + 2;

  // Title row spans all columns
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

  // "券商名称" spans rows 1-2
  merges.push({ s: { r: 1, c: 0 }, e: { r: 2, c: 0 } });

  // Each ETF header spans 2 columns in row 1
  for (let i = 0; i < etfCodes.length; i++) {
    const colStart = 1 + i * 2;
    merges.push({ s: { r: 1, c: colStart }, e: { r: 1, c: colStart + 1 } });
  }

  // "合计" header spans 2 columns in row 1
  const totalColStart = 1 + etfCodes.length * 2;
  merges.push({ s: { r: 1, c: totalColStart }, e: { r: 1, c: totalColStart + 1 } });

  ws["!merges"] = merges;

  // Set column widths
  const colWidths: XLSX.ColInfo[] = [{ wch: 14 }]; // 券商名称
  for (let i = 0; i < etfCodes.length * 2 + 2; i++) {
    colWidths.push({ wch: 12 });
  }
  ws["!cols"] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "做市成交汇总");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbout);
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

  if (!filePath) return; // user cancelled

  const buffer = exportToExcel(data);
  await writeFile(filePath, buffer);
}
