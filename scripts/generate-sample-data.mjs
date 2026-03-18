import XLSX from "xlsx";
import { mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "sample-data");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const brokers = [
  "中信证券", "华泰证券", "国泰君安", "海通证券", "广发证券",
  "招商证券", "中金公司", "申万宏源", "银河证券", "东方证券",
  "中信建投", "光大证券", "方正证券",
];

const etfCodes = [
  "159651", "159719", "159960", "159793", "512930", "561600",
];

// 5 recent trading dates (matching real format: YYYY-M-D without zero-padding)
const tradingDates = [
  "2026-3-12", "2026-3-13", "2026-3-14", "2026-3-17", "2026-3-18",
];

function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/**
 * Generate ONE Excel file that matches the real input format:
 *  - Multiple sheets, each sheet name = ETF code
 *  - Each sheet contains ALL dates × ALL brokers
 *  - English column headers: fundticker, broker, date, buyshares, buyamount,
 *    sellshares, sellamount, creation, redemption, holdshares, holdvalue
 */
function generateFile(filename) {
  const wb = XLSX.utils.book_new();

  for (const code of etfCodes) {
    const rows = [];

    for (const date of tradingDates) {
      for (const broker of brokers) {
        if (Math.random() < 0.1) continue; // 10% chance broker skips this day

        const buyAmount = randomAmount(500000, 80000000);
        const sellAmount = randomAmount(500000, 80000000);
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
          redemption: Math.round(Math.random() * 5000000),
          holdshares: Math.round(Math.random() * 100000000),
          holdvalue: Math.round(Math.random() * 500000000),
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, code);
  }

  const outPath = join(outDir, filename);
  XLSX.writeFile(wb, outPath);
  console.log(`Generated: ${outPath}`);
}

// Generate a single file (matching real usage: one file = all data)
generateFile("做市交易数据_sample.xlsx");

console.log(`\nDone! Generated sample file in ${outDir}`);
console.log(`\nFormat: English headers (fundticker, broker, date, buyamount, sellamount, ...)`);
console.log(`Dates: ${tradingDates.join(", ")}`);
console.log(`ETFs: ${etfCodes.join(", ")}`);
console.log(`Brokers: ${brokers.length} total`);
