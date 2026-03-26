import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { RankingEntry } from "../../types";

// Gradient from blue (top rank) to light gray (bottom rank)
function getRankColor(rank: number, total: number): string {
  const ratio = (rank - 1) / Math.max(total - 1, 1);
  // Interpolate from #4472c4 (blue) to #d0d0d0 (light gray)
  const r = Math.round(68 + ratio * (208 - 68));
  const g = Math.round(114 + ratio * (208 - 114));
  const b = Math.round(196 + ratio * (208 - 196));
  return `rgb(${r}, ${g}, ${b})`;
}

interface Props {
  data: RankingEntry[];
  metric: "trading" | "holding";
}

export function RankingChart({ data, metric }: Props) {
  if (data.length === 0) return null;

  const metricLabel = metric === "trading" ? "成交量 (万元)" : "持仓 (万元)";

  // Recharts horizontal bar: use layout="vertical"
  const chartData = data.map((entry) => ({
    broker: entry.broker,
    value: entry.value,
    share: entry.share,
    rank: entry.rank,
  }));

  const barHeight = 32;
  const chartHeight = Math.max(chartData.length * barHeight + 60, 200);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" fontSize={12} label={{ value: metricLabel, position: "insideBottom", offset: -2, fontSize: 12 }} />
        <YAxis type="category" dataKey="broker" fontSize={12} width={100} />
        <Tooltip
          formatter={(value, _name, props: any) => [
            `${(value as number).toFixed(2)} (${props.payload.share.toFixed(1)}%)`,
            metricLabel,
          ]}
        />
        <Bar dataKey="value" label={{ position: "right", fontSize: 11, formatter: (v: any) => (v as number).toFixed(0) }}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={getRankColor(entry.rank, chartData.length)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
