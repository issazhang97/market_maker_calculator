import XLSX from "xlsx";
import { mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "sample-data");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const brokers = [
  "中信证券", "华泰证券", "国信证券", "银河证券", "方正证券",
  "国泰海通", "山西证券", "广发证券", "招商证券", "东方证券",
];

const etfCodes = [
  "159651", "159719", "159960", "159793", "512930", "561600",
  "512390", "159521",
];

// Many trading dates (like the real data: ~25 trading days)
const tradingDates = [
  "2026-2-12", "2026-2-13", "2026-2-24", "2026-2-25", "2026-2-26",
  "2026-2-27", "2026-3-2", "2026-3-3", "2026-3-4", "2026-3-5",
  "2026-3-6", "2026-3-9", "2026-3-10", "2026-3-11", "2026-3-12",
  "2026-3-13", "2026-3-16", "2026-3-17",
];

function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/**
 * Generate ONE Excel file matching real input format exactly:
 *  - Multiple sheets, each sheet name = ETF code
 *  - Each sheet: all brokers × all dates
 *  - English column headers: fundticker, broker, date, buyshares, buyamount,
 *    sellshares, sellamount, creation, redemption, holdshares, holdvalue
 *  - Date format: YYYY-M-D (no zero-padding, matching real data)
 */
function generateFile(filename) {
  const wb = XLSX.utils.book_new();

  for (const code of etfCodes) {
    const rows = [];

    for (const date of tradingDates) {
      for (const broker of brokers) {
        if (Math.random() < 0.08) continue; // small chance broker skips

        const buyAmount = randomAmount(100000, 30000000);
        const sellAmount = randomAmount(100000, 30000000);
        const buyShares = Math.round(buyAmount / 3.5);
        const sellShares = Math.round(sellAmount / 3.5);

        rows.push({
          fundticker: code,
          broker: broker,
          date: date,
          buyshares: buyShares,
          buyamount: buyAmount,
          sellshares: sellShares,
          sellamount: sellAmount,
          creation: Math.round(Math.random() * 5000000),
          "": 0,  // empty column (matches real data column I)
          redemption: Math.round(Math.random() * 5000000),
          holdshares: Math.round(Math.random() * 100000000),
          holdvalue: Math.round(Math.random() * 500000000),
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 6 }, { wch: 12 },
      { wch: 14 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, code);
  }

  const outPath = join(outDir, filename);
  XLSX.writeFile(wb, outPath);
  console.log(`Generated: ${outPath}`);
}

generateFile("做市交易数据_sample.xlsx");

console.log(`\nDone! Generated sample file in ${outDir}`);
console.log(`\nFormat: English headers (fundticker, broker, date, buyamount, sellamount, ...)`);
console.log(`Date format: YYYY-M-D (no zero-padding)`);
console.log(`Dates: ${tradingDates.length} trading days (${tradingDates[0]} to ${tradingDates[tradingDates.length - 1]})`);
console.log(`ETFs: ${etfCodes.join(", ")}`);
console.log(`Brokers: ${brokers.join(", ")}`);
