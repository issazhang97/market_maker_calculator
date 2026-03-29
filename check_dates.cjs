const XLSX = require('xlsx');
const path = require('path');

const baseDir = '/Users/wenjunzhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_d3w0mxuy59pt22_9b62/msg/file/2026-03/各区域数据';
const file = '平安基金做市数据_国泰海通证券_20260319.xlsx';

function parseDate(value) {
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  if (typeof value === 'string') {
    // Handle YYYYMMDD format
    if (value.match(/^\d{8}$/)) {
      return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    }
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) return value;
    if (value.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
      const parts = value.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  return null;
}

const filePath = path.join(baseDir, file);
const workbook = XLSX.readFile(filePath, { cellDates: false });

console.log('Checking 159143 sheet for target dates:');
const sheet = workbook.Sheets['159143'];
const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

const targetDates = ['2026-03-17', '2026-03-16', '2026-03-13', '2026-03-12', '2026-03-11'];

console.log(`\nAll dates in 159143 sheet:`);
data.forEach(row => {
  const dateStr = parseDate(row['日期']);
  if (targetDates.includes(dateStr)) {
    console.log(`  ${dateStr}: buy=${row['买入金额（万元）']}, sell=${row['卖出金额（万元）']}`);
  }
});

console.log(`\nLast 10 rows:`);
data.slice(-10).forEach(row => {
  const dateStr = parseDate(row['日期']);
  const buy = parseFloat(row['买入金额（万元）']) || 0;
  const sell = parseFloat(row['卖出金额（万元）']) || 0;
  const total = buy + sell;
  console.log(`  ${dateStr}: total=${total.toFixed(2)} (buy=${buy.toFixed(2)}, sell=${sell.toFixed(2)})`);
});
