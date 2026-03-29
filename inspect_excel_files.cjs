const XLSX = require('xlsx');
const fs = require('fs');

const files = [
  '/Users/wenjunzhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_d3w0mxuy59pt22_9b62/msg/file/2026-03/各区域数据/平安基金做市数据_国泰海通证券_20260319.xlsx',
  '/Users/wenjunzhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_d3w0mxuy59pt22_9b62/msg/file/2026-03/各区域数据/平安基金做市数据_国信证券_20260319.xlsx',
  '/Users/wenjunzhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_d3w0mxuy59pt22_9b62/msg/file/2026-03/各区域数据/平安基金-方正证券每日做市情况-20260319.xlsx',
  '/Users/wenjunzhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_d3w0mxuy59pt22_9b62/msg/file/2026-03/各区域数据/平安基金-中信做市数据统计-20260319.xlsx',
  '/Users/wenjunzhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_d3w0mxuy59pt22_9b62/msg/file/2026-03/各区域数据/平安基金_银河证券_20260319.xlsx',
  '/Users/wenjunzhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_d3w0mxuy59pt22_9b62/msg/file/2026-03/各区域数据/山西证券——平安基金做市数据统计-20260319.xlsx',
  '/Users/wenjunzhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_d3w0mxuy59pt22_9b62/msg/file/2026-03/各区域数据/华泰证券——平安基金做市数据统计-20260319.xlsx'
];

files.forEach((filePath, index) => {
  const fileName = filePath.split('/').pop();
  console.log('\n' + '='.repeat(80));
  console.log(`FILE ${index + 1}: ${fileName}`);
  console.log('='.repeat(80));
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log('❌ FILE NOT FOUND');
      return;
    }

    const workbook = XLSX.readFile(filePath);
    
    console.log(`\n📋 SHEET NAMES: ${workbook.SheetNames.join(', ')}`);
    
    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      console.log(`\n--- Sheet ${sheetIndex + 1}: "${sheetName}" ---`);
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      console.log(`Total rows (including headers): ${jsonData.length}`);
      
      if (jsonData.length > 0) {
        console.log('\n🔤 HEADERS:');
        // Check first few rows for headers
        for (let i = 0; i < Math.min(3, jsonData.length); i++) {
          const row = jsonData[i];
          const hasContent = row.some(cell => cell !== '');
          if (hasContent) {
            console.log(`Row ${i}: [${row.map(c => `"${c}"`).join(', ')}]`);
          }
        }
        
        console.log('\n📊 SAMPLE DATA (first 5 data rows after headers):');
        // Find where actual data starts (skip empty or header rows)
        let dataStartRow = 0;
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const firstCell = String(row[0] || '').trim();
          // Look for typical header indicators
          if (firstCell.includes('产品') || firstCell.includes('日期') || firstCell.includes('序号')) {
            dataStartRow = i + 1;
            break;
          }
        }
        
        const sampleRows = Math.min(5, jsonData.length - dataStartRow);
        for (let i = 0; i < sampleRows; i++) {
          const rowIndex = dataStartRow + i;
          if (rowIndex < jsonData.length) {
            const row = jsonData[rowIndex];
            const hasContent = row.some(cell => cell !== '');
            if (hasContent) {
              console.log(`Data Row ${i + 1}: [${row.map(c => {
                const str = String(c);
                return str.length > 50 ? `"${str.substring(0, 47)}..."` : `"${str}"`;
              }).join(', ')}]`);
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('INSPECTION COMPLETE');
console.log('='.repeat(80));
