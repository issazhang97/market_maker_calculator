const XLSX = require('xlsx');
const path = '/Users/wenjunzhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_d3w0mxuy59pt22_9b62/msg/file/2026-03/各区域数据/';
const dates5 = ['2026-03-17','2026-03-16','2026-03-13','2026-03-12','2026-03-11'];

function parseDate(d) {
  if (typeof d === 'number') {
    if (d > 19000000 && d < 30000000) { const s = String(d); return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8); }
    const p = XLSX.SSF.parse_date_code(d);
    if (p) return p.y+'-'+String(p.m).padStart(2,'0')+'-'+String(p.d).padStart(2,'0');
  }
  if (typeof d === 'string') {
    const m = d.trim().match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  }
  return String(d);
}

function findCol(row, candidates) {
  for (const k of Object.keys(row)) {
    const lk = k.toLowerCase().trim();
    for (const c of candidates) { if (lk.includes(c.toLowerCase())) return k; }
  }
  return null;
}

const files = [
  { path: path + '平安基金-中信做市数据统计-20260319.xlsx', broker: '中信证券' },
  { path: path + '华泰证券——平安基金做市数据统计-20260319.xlsx', broker: '华泰证券' },
  { path: path + '平安基金做市数据_国信证券_20260319.xlsx', broker: '国信证券' },
  { path: path + '平安基金_银河证券_20260319.xlsx', broker: '银河证券' },
  { path: path + '平安基金-方正证券每日做市情况-20260319.xlsx', broker: '方正证券' },
  { path: path + '平安基金做市数据_国泰海通证券_20260319.xlsx', broker: '国泰海通证券' },
  { path: path + '山西证券——平安基金做市数据统计-20260319.xlsx', broker: '山西证券' },
];

// Build: hasRecord[broker][code][date] = true if a row exists in the Excel
const hasRecord = {};
const grouped = {}; // broker→code→date→amount

for (const f of files) {
  const wb = XLSX.readFile(f.path);
  hasRecord[f.broker] = {};
  grouped[f.broker] = {};
  for (const sn of wb.SheetNames) {
    const code = sn.replace(/\.(SZ|SH)$/i, '');
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn]);
    if (rows.length === 0) continue;
    
    const dateKey = findCol(rows[0], ['日期', 'date']);
    const buyKey = findCol(rows[0], ['买入金额', 'buyamount']);
    const sellKey = findCol(rows[0], ['卖出金额', 'sellamount']);
    const dailyKey = findCol(rows[0], ['当日成交金额', '总成交金额']);
    const isChinese = buyKey && (buyKey.includes('买入金额'));
    const div = isChinese ? 1 : 10000;
    
    hasRecord[f.broker][code] = {};
    grouped[f.broker][code] = {};
    
    for (const row of rows) {
      if (!dateKey || !row[dateKey]) continue;
      const d = parseDate(row[dateKey]);
      hasRecord[f.broker][code][d] = true;
      
      const buy = (Number(row[buyKey]) || 0) / div;
      const sell = (Number(row[sellKey]) || 0) / div;
      const daily = dailyKey && row[dailyKey] !== '' && row[dailyKey] !== undefined
        ? (Number(row[dailyKey]) || 0) / div : null;
      const amount = daily !== null ? daily : (buy + sell);
      
      grouped[f.broker][code][d] = (grouped[f.broker][code][d] || 0) + amount;
    }
  }
}

// FIXED product mapping: removed 国泰海通 黄金股票 override
const PRODUCTS = [
  { name: '自由现金流', defaultCodes: ['159233'] },
  { name: 'AI', defaultCodes: ['512930'] },
  { name: '通用航空', defaultCodes: ['561660'] },
  { name: '黄金股票', defaultCodes: ['159322'], ov: { '方正证券': ['511020','512390','515700','516180'] } },
  { name: '消费电子', defaultCodes: ['561600'], ov: { '国信证券': ['159215'] } },
  { name: '港股医药', defaultCodes: ['159718'] },
  { name: '央企红利', defaultCodes: ['159143'] },
  { name: '港股通科技', defaultCodes: ['159152'] },
];

const ref = {
  '中信证券': { '自由现金流':[1890.80,1190.00],'AI':[312.60,450.00],'通用航空':[335.40,405.00],'黄金股票':[284.60,163.00],'港股医药':[233.00,401.00],'央企红利':[118.00,43.00],'港股通科技':[155.33,222.00] },
  '华泰证券': { '自由现金流':[1176.33,1156.33],'通用航空':[105.75,104.38],'黄金股票':[78.09,66.88],'消费电子':[8.02,0],'港股医药':[41.02,75.13] },
  '国信证券': { '自由现金流':[1229.07,1317.51] },
  '银河证券': { '自由现金流':[1143.89,1208.37],'AI':[0.02,0.04],'通用航空':[540.06,217.08],'央企红利':[279.02,119.21],'港股通科技':[667.02,578.49] },
  '方正证券': { '自由现金流':[1561.92,1966.14],'AI':[10.68,28.53],'黄金股票':[1274.50,1337.20],'消费电子':[31.36,5.69],'港股医药':[155.18,460.16],'港股通科技':[748.62,603.52] },
  '国泰海通证券': { '消费电子':[193.50,238.67],'央企红利':[209.67,138.73] },
  '山西证券': { '自由现金流':[435.90,484.77] },
};

console.log('=== FIXED CALCULATION (active days divisor + no 国泰海通 黄金 override) ===\n');

let mismatches = 0;
for (const broker of Object.keys(grouped)) {
  for (const p of PRODUCTS) {
    const codes = p.ov?.[broker] || p.defaultCodes;
    
    let sum = 0, yest = 0, activeDays = 0;
    for (const d of dates5) {
      let dayAmt = 0;
      let dateHasRecord = false;
      for (const code of codes) {
        if (hasRecord[broker]?.[code]?.[d]) dateHasRecord = true;
        dayAmt += grouped[broker]?.[code]?.[d] || 0;
      }
      sum += dayAmt;
      if (dateHasRecord) activeDays++;
      if (d === '2026-03-17') yest = dayAmt;
    }
    const avg = activeDays > 0 ? sum / activeDays : 0;
    
    const rv = ref[broker]?.[p.name];
    if (!rv) continue;
    
    const avgDiff = Math.abs(avg - rv[0]);
    const yestDiff = Math.abs(yest - rv[1]);
    const ok = avgDiff <= 0.1 && yestDiff <= 0.1;
    
    const marker = ok ? '✓' : '✗ avg_diff=' + avgDiff.toFixed(2) + ' yest_diff=' + yestDiff.toFixed(2);
    console.log(broker.padEnd(12) + p.name.padEnd(8) + ' avg=' + avg.toFixed(2).padStart(9) + ' yest=' + yest.toFixed(2).padStart(9) + '  ref_avg=' + rv[0].toFixed(2).padStart(9) + ' ref_yest=' + rv[1].toFixed(2).padStart(9) + '  (÷' + activeDays + ') ' + marker);
    if (!ok) mismatches++;
  }
}
console.log('\nRemaining mismatches: ' + mismatches);
