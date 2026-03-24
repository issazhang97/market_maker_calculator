/**
 * Static mapping of ETF code -> Chinese display name.
 * Names sourced from Tencent stock API (qt.gtimg.cn), with fund company
 * suffixes removed for cleaner display.
 *
 * The yearly aggregator auto-discovers all ETF codes from data and uses
 * this mapping for display names. Unknown codes fall back to the raw code.
 */
export const ETF_NAME_MAP: Record<string, string> = {
  // 平安基金做市品种
  "512930": "AI人工智能ETF",
  "159152": "港股通科技ETF",
  "159233": "自由现金流ETF",
  "159322": "黄金股ETF",
  "561600": "消费电子ETF",
  "561660": "通用航空ETF",
  "159143": "港股通央企红利ETF",
  "159718": "港股医药ETF",
  "159593": "中证A50ETF",
  "510590": "中证500ETF",
  "510390": "沪深300ETF",
  "159967": "创业板成长ETF",
  "515700": "新能源车ETF",
  "159596": "A50ETF",
  "159812": "黄金ETF",
  "516820": "医疗创新ETF",
  "159961": "深100ETF",
  "159964": "创业板ETF",
  "561680": "A500红利低波ETF",
  "589150": "科创50ETF",
  "516760": "养殖ETF",
  "561880": "XDA100ETF",
  "159215": "A500ETF",
  "159306": "汽车零部件ETF",
  "159521": "国证2000ETF",
  "159556": "中证2000增强ETF",
  "159651": "国开债ETF",
  "159719": "国企ETF",
  "159793": "线上消费ETF",
  "159832": "平安金ETF",
  "159960": "恒生中国企业ETF",
  "180201": "广州广河REIT",
  "508036": "宁波交投REIT",
  "511020": "国债ETF",
  "511030": "公司债ETF",
  "511700": "货币ETF",
  "512360": "MSCIA股ETF",
  "512390": "中国低波ETF",
  "512970": "大湾区ETF",
  "516180": "光伏ETF",
  "516890": "新材料ETF",
  "530280": "上证180ETF",
};

/**
 * Get ETF display name by code. Falls back to the code itself if not found.
 */
export function getEtfName(code: string): string {
  return ETF_NAME_MAP[code] ?? code;
}
