const XLSX = require('xlsx');
const path = require('path');

const baseDir = '/Users/wenjunzhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_d3w0mxuy59pt22_9b62/msg/file/2026-03/各区域数据';
const file = '平安基金做市数据_国泰海通证券_20260319.xlsx';

function detectBrokerFromFilename(filename) {
  if (filename.includes('方正')) return '方正证券';
  if (filename.includes('华泰')) return '华泰证券';
  if (filename.includes('中信')) return '中信证券';
  if (filename.includes('山西')) return '山西证券';
  if (filename.includes('银河')) return '银河证券';
  if (filename.includes('国信')) return '国信证券';
  if (filename.includes('国泰海通')) return '国泰海通证券';
  return null;
}

const filePath = path.join(baseDir, file);
console.log(`Parsing: ${file}`);
console.log(`Detected broker from filename: ${detectBrokerFromFilename(file)}`);

const workbook = XLSX.readFile(filePath, { cellDates: false });
console.log(`\nSheet names: ${workbook.SheetNames.join(', ')}`);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { raw: false });
  
  if (data.length > 0) {
    console.log(`Rows: ${data.length}`);
    console.log(`Headers: ${Object.keys(data[0]).join(', ')}`);
    console.log(`\nFirst 3 rows:`);
    data.slice(0, 3).forEach((row, i) => {
      console.log(`Row ${i + 1}:`, JSON.stringify(row));
    });
  } else {
    console.log('No data in this sheet');
  }
});
