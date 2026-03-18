import XLSX from "xlsx";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "sample-data");

// Replicate the parsing logic from excelParser.ts (English headers)
function parseExcelFile(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const records = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
    for (const row of rows) {
      const broker = row["broker"] || row["券商名称"];
      const dateRaw = row["date"] || row["交易日期"];
      const buy = Number(row["buyamount"] || row["买入金额"]) || 0;
      const sell = Number(row["sellamount"] || row["卖出金额"]) || 0;
      if (!broker || !dateRaw) continue;

      // Normalize date (handle "2026-3-12" → "2026-03-12")
      const dateStr = String(dateRaw).trim();
      const match = dateStr.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      const date = match
        ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
        : dateStr;

      records.push({ fundTicker: sheetName.trim(), broker, date, buyAmount: buy, sellAmount: sell });
    }
  }
  return records;
}

// Load all sample files
const files = readdirSync(dataDir).filter(f => f.endsWith(".xlsx")).sort();
console.log(`Found ${files.length} files: ${files.join(", ")}\n`);

const allRecords = [];
for (const f of files) {
  const buf = readFileSync(join(dataDir, f));
  const recs = parseExcelFile(buf);
  console.log(`  ${f}: ${recs.length} records`);
  allRecords.push(...recs);
}
console.log(`\nTotal records: ${allRecords.length}`);

// Replicate aggregation
const allDates = [...new Set(allRecords.map(r => r.date))].sort().reverse();
const latestDate = allDates[0];
const last5 = allDates.slice(0, 5);
const etfCodes = [...new Set(allRecords.map(r => r.fundTicker))].sort();

console.log(`\nLatest date (昨日): ${latestDate}`);
console.log(`Last 5 dates: ${last5.join(", ")}`);
console.log(`ETF codes: ${etfCodes.join(", ")}`);

// Group: broker -> etf -> date -> amount
const grouped = {};
for (const r of allRecords) {
  if (!grouped[r.broker]) grouped[r.broker] = {};
  if (!grouped[r.broker][r.fundTicker]) grouped[r.broker][r.fundTicker] = {};
  const amt = r.buyAmount + r.sellAmount;
  grouped[r.broker][r.fundTicker][r.date] = (grouped[r.broker][r.fundTicker][r.date] || 0) + amt;
}

const brokers = Object.keys(grouped).sort();
console.log(`\nBrokers (${brokers.length}): ${brokers.join(", ")}\n`);

// Print sample verification
console.log("=== Sample Verification (万元) ===");
console.log(`${"Broker".padEnd(12)} ${"ETF".padEnd(8)} ${"昨日成交".padEnd(12)} ${"5日平均".padEnd(12)}`);
console.log("-".repeat(48));

let errors = 0;
for (const broker of brokers.slice(0, 3)) {
  for (const etf of etfCodes.slice(0, 2)) {
    const dateMap = grouped[broker]?.[etf] || {};
    const yesterday = (dateMap[latestDate] || 0) / 10000;
    const avg5 = last5.reduce((s, d) => s + (dateMap[d] || 0), 0) / last5.length / 10000;
    console.log(`${broker.padEnd(12)} ${etf.padEnd(8)} ${yesterday.toFixed(0).padStart(10)}  ${avg5.toFixed(0).padStart(10)}`);
    if (yesterday < 0 || avg5 < 0) { errors++; console.log("  ERROR: negative value"); }
  }
}

// Grand totals
let grandYesterday = 0, grandAvg = 0;
for (const broker of brokers) {
  for (const etf of etfCodes) {
    const dateMap = grouped[broker]?.[etf] || {};
    grandYesterday += (dateMap[latestDate] || 0) / 10000;
    grandAvg += last5.reduce((s, d) => s + (dateMap[d] || 0), 0) / last5.length / 10000;
  }
}
console.log(`\nGrand total 昨日成交: ${Math.round(grandYesterday)} 万元`);
console.log(`Grand total 5日平均:  ${Math.round(grandAvg)} 万元`);

if (errors === 0) {
  console.log("\n✅ All checks passed!");
} else {
  console.log(`\n❌ ${errors} errors found`);
  process.exit(1);
}
