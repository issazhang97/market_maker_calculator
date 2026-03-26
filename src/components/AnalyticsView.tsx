import type {
  TrendSeries,
  RankingEntry,
  MarketShareRow,
  AnalyticsQuery,
} from "../types";
import { ChartControls } from "./charts/ChartControls";
import { TrendChart } from "./charts/TrendChart";
import { RankingChart } from "./charts/RankingChart";
import { MarketShareTable } from "./charts/MarketShareTable";

interface Props {
  query: AnalyticsQuery;
  onQueryChange: (query: AnalyticsQuery) => void;
  trendSeries: TrendSeries | null;
  rankings: RankingEntry[];
  marketShare: MarketShareRow[];
  availableYears: string[];
  availableBrokers: string[];
  availableProducts: { code: string; name: string }[];
}

export function AnalyticsView({
  query,
  onQueryChange,
  trendSeries,
  rankings,
  marketShare,
  availableYears,
  availableBrokers,
  availableProducts,
}: Props) {
  return (
    <div className="mt-6">
      <ChartControls
        query={query}
        onChange={onQueryChange}
        availableYears={availableYears}
        availableBrokers={availableBrokers}
        availableProducts={availableProducts}
      />

      {trendSeries && trendSeries.points.length > 0 && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            {query.metric === "trading" ? "成交量趋势" : "持仓趋势"} (单位: 万元)
          </h2>
          <TrendChart data={trendSeries} chartType={query.chartType} />
        </div>
      )}

      {rankings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            券商排名
          </h2>
          <RankingChart data={rankings} metric={query.metric} />
        </div>
      )}

      {marketShare.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            市场份额变化
          </h2>
          <MarketShareTable data={marketShare} />
        </div>
      )}
    </div>
  );
}
