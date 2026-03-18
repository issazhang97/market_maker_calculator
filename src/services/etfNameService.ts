import { ETF_NAME_FALLBACK } from "../constants/etfColumns";

const cache: Record<string, string> = {};

interface EastmoneyResponse {
  Data?: {
    QuotationCodeTable?: {
      Data?: Array<{ Name?: string; Code?: string }>;
    };
  };
}

/**
 * Fetch ETF name from Eastmoney Search API.
 * Results are cached in memory.
 */
export async function fetchETFName(code: string): Promise<string> {
  if (cache[code]) return cache[code];

  try {
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${code}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=5`;
    const resp = await fetch(url);
    const json: EastmoneyResponse = await resp.json();
    const items = json?.Data?.QuotationCodeTable?.Data;
    if (items && items.length > 0) {
      // Try to find exact code match first
      const exact = items.find((item) => item.Code === code);
      const name = exact?.Name || items[0].Name;
      if (name) {
        cache[code] = name;
        return name;
      }
    }
  } catch {
    // API unavailable — use fallback
  }

  const fallback = ETF_NAME_FALLBACK[code] || code;
  cache[code] = fallback;
  return fallback;
}

/**
 * Fetch names for multiple ETF codes concurrently.
 */
export async function fetchETFNames(
  codes: string[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    codes.map(async (code) => {
      results[code] = await fetchETFName(code);
    })
  );
  return results;
}
