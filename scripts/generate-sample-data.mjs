import XLSX from "xlsx";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "sample-data");
mkdirSync(outDir, { recursive: true });

const brokers = [
  "中信证券", "华泰证券", "国泰君安", "海通证券", "广发证券",
  "招商证券", "中金公司", "申万宏源", "银河证券", "东方证券",
  "中信建投", "光大证券",
];

const etfs = [
  { code: "510050", sheets: ["510050"] },
  { code: "510300", sheets: ["510300"] },
  { code: "510500", sheets: ["510500"] },
  { code: "159915", sheets: ["159915"] },
  { code: "513100", sheets: ["513100"] },
  { code: "518880", sheets: ["518880"] },
];

// Generate 5 trading dates (most recent 5 business days before 2026-03-18)
const tradingDates = [
  "2026-03-12",
  "2026-03-13",
  "2026-03-14",
  "2026-03-17",
  "2026-03-18",
];

function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/**
 * Generate one Excel file containing data for a single trading date.
 * Each sheet = one ETF, rows = brokers with buy/sell amounts.
 */
function generateDailyFile(date, filename) {
  const wb = XLSX.utils.book_new();

  for (const etf of etfs) {
    const rows = [];
    // Not every broker trades every ETF every day — randomly skip some
    for (const broker of brokers) {
      if (Math.random() < 0.15) continue; // 15% chance broker skips this ETF

      const buyAmount = randomAmount(500000, 80000000);   // 50万 ~ 8000万
      const sellAmount = randomAmount(500000, 80000000);

      rows.push({
        "交易日期": date,
        "券商名称": broker,
        "买入金额": buyAmount,
        "卖出金额": sellAmount,
        "买入数量": Math.round(buyAmount / 3.5),
        "卖出数量": Math.round(sellAmount / 3.5),
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    // Set column widths
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, etf.code);
  }

  const outPath = join(outDir, filename);
  XLSX.writeFile(wb, outPath);
  console.log(`Generated: ${outPath}`);
}

// Generate 5 daily files
for (const date of tradingDates) {
  const dateStr = date.replace(/-/g, "");
  generateDailyFile(date, `做市交易数据_${dateStr}.xlsx`);
}

console.log(`\nDone! Generated ${tradingDates.length} sample files in ${outDir}`);
console.log("\nExpected behavior:");
console.log(`- 昨日 = ${tradingDates[tradingDates.length - 1]}`);
console.log(`- 过去5日 = ${tradingDates.join(", ")}`);
console.log(`- ETFs: ${etfs.map(e => e.code).join(", ")}`);
console.log(`- Brokers: ${brokers.length} total (some may be missing per ETF/date)`);
