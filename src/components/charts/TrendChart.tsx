import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { TrendSeries } from "../../types";

// 10 distinct colors for chart lines/bars
const COLORS = [
  "#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5",
  "#70ad47", "#264478", "#9b59b6", "#e74c3c", "#1abc9c",
];

interface Props {
  data: TrendSeries;
  chartType: "line" | "bar";
}

export function TrendChart({ data, chartType }: Props) {
  const { points, keys } = data;

  // Transform points into Recharts-compatible format: { date, broker1, broker2, ... }
  const chartData = points.map((p) => ({
    date: formatDateLabel(p.date),
    ...p.values,
  }));

  const metricLabel = data.metric === "trading" ? "成交量 (万元)" : "持仓 (万元)";

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis fontSize={12} label={{ value: metricLabel, angle: -90, position: "insideLeft", offset: -5, fontSize: 12 }} />
          <Tooltip formatter={(value) => (value as number).toFixed(2)} />
          <Legend />
          {keys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} label={{ value: metricLabel, angle: -90, position: "insideLeft", offset: -5, fontSize: 12 }} />
        <Tooltip formatter={(value) => (value as number).toFixed(2)} />
        <Legend />
        {keys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function formatDateLabel(date: string): string {
  // "2026-03-17" -> "03-17", "2026-W12" -> "W12", "2026-03" -> "3月"
  if (date.includes("-W")) {
    return date.slice(5); // "W12"
  }
  if (/^\d{4}-\d{2}$/.test(date)) {
    const month = parseInt(date.slice(5), 10);
    return `${month}月`;
  }
  return date.slice(5); // "03-17"
}
