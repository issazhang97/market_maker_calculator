import type { PivotData, ETFSummaryCell, AnomalyFlags } from "../types";
import { PRODUCT_MAPPINGS, getCodesForBroker } from "../constants/etfColumns";
import { TooltipCell } from "./TooltipCell";

interface Props {
  data: PivotData;
  anomalyFlags?: AnomalyFlags;
}

function formatNum(n: number): string {
  if (n === 0) return "";
  return n.toFixed(2);
}

function formatAnomaly(mean: number, stddev: number): string {
  const lower = Math.max(0, mean - 2 * stddev);
  const upper = mean + 2 * stddev;
  return `20日均值: ${mean.toFixed(2)}万\n范围: ${lower.toFixed(2)} - ${upper.toFixed(2)}万`;
}

export function SummaryTable({ data, anomalyFlags }: Props) {
  const { products, rows, totals, grandTotal, date } = data;

  function getAnomalyForCell(broker: string, productName: string) {
    if (!anomalyFlags?.[broker]) return undefined;
    const product = PRODUCT_MAPPINGS.find((p) => p.name === productName);
    if (!product) return undefined;
    const codes = getCodesForBroker(product, broker);
    for (const code of codes) {
      const flag = anomalyFlags[broker]?.[code];
      if (flag) return flag;
    }
    return undefined;
  }

  return (
    <div className="overflow-x-auto">
      <table className="summary-table">
        <thead>
          <tr>
            <th className="th-broker">
              {date}
            </th>
            {products.map((name) => (
              <th key={name} colSpan={2} className="th-etf">
                {name}
              </th>
            ))}
            <th colSpan={2} className="th-total">
              合计
            </th>
          </tr>
          <tr>
            <th className="th-broker">(万元)</th>
            {products.map((name) => (
              <SubHeaders key={name} />
            ))}
            <SubHeaders />
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => (
            <tr key={row.broker} className={i % 2 === 0 ? "row-even" : "row-odd"}>
              <td className="td-broker">{row.broker}</td>
              {products.map((name) => {
                const cell = row.cells[name] || { past5DaysAvg: 0, yesterday: 0 };
                const anomaly = getAnomalyForCell(row.broker, name);
                return (
                  <CellPair key={name} cell={cell} anomaly={anomaly} />
                );
              })}
              <CellPair cell={row.total} isTotal />
            </tr>
          ))}

          <tr className="row-totals">
            <td className="td-broker font-bold">合计</td>
            {products.map((name) => {
              const cell = totals[name] || { past5DaysAvg: 0, yesterday: 0 };
              return (
                <CellPair key={name} cell={cell} />
              );
            })}
            <CellPair cell={grandTotal} isTotal />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SubHeaders() {
  return (
    <>
      <th className="th-sub">过去5日平均成交</th>
      <th className="th-sub">昨日成交</th>
    </>
  );
}

function CellPair({
  cell,
  isTotal = false,
  anomaly,
}: {
  cell: ETFSummaryCell;
  isTotal?: boolean;
  anomaly?: { type: "spike" | "drop"; value: number; mean: number; stddev: number };
}) {
  const cls = isTotal ? "td-num td-total-col" : "td-num";
  const anomalyCls = anomaly
    ? anomaly.type === "spike"
      ? "anomaly-spike"
      : "anomaly-drop"
    : "";
  const anomalyTooltip = anomaly
    ? `异常: 当日成交 ${anomaly.value.toFixed(2)}万\n${formatAnomaly(anomaly.mean, anomaly.stddev)}`
    : undefined;

  return (
    <>
      <td className={cls}>
        <TooltipCell value={formatNum(cell.past5DaysAvg)} tooltip={cell.avgTooltip} />
      </td>
      <td className={`${cls} ${anomalyCls}`}>
        <TooltipCell
          value={
            formatNum(cell.yesterday) +
            (anomaly ? (anomaly.type === "spike" ? " ▲" : " ▼") : "")
          }
          tooltip={anomalyTooltip || cell.yestTooltip}
        />
      </td>
    </>
  );
}

