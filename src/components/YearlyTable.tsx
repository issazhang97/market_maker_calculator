import type { YearlyPivotData } from "../types";
import { TooltipCell } from "./TooltipCell";

interface Props {
  data: YearlyPivotData;
}

function formatNum(n: number): string {
  if (n === 0) return "";
  return n.toFixed(2);
}

export function YearlyTable({ data }: Props) {
  const { year, brokers, rows, brokerTotals, grandTotalTrading, grandTotalHolding } = data;

  return (
    <div className="overflow-x-auto">
      <table className="summary-table">
        <thead>
          {/* Row 1: Year + broker names (each spans 2 cols) + 合计 */}
          <tr>
            <th className="th-broker" colSpan={2}>
              {year}年
            </th>
            {brokers.map((broker) => (
              <th key={broker} colSpan={2} className="th-etf">
                {broker}
              </th>
            ))}
            <th colSpan={2} className="th-total">
              合计
            </th>
          </tr>

          {/* Row 2: 名称 | 代码 | sub-headers per broker | sub-headers for total */}
          <tr>
            <th className="th-sub">名称</th>
            <th className="th-sub">代码</th>
            {brokers.map((broker) => (
              <BrokerSubHeaders key={broker} />
            ))}
            <th className="th-sub">年均单边日均成交</th>
            <th className="th-sub">年均持仓</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => (
            <tr key={row.productCode} className={i % 2 === 0 ? "row-even" : "row-odd"}>
              <td className="td-broker">{row.productName}</td>
              <td className="td-broker" style={{ textAlign: "center" }}>{row.productCode}</td>
              {brokers.map((broker) => {
                const cell = row.cells[broker] || { avgDailyTrading: 0, avgDailyHolding: 0 };
                return (
                  <YearlyCellPair key={broker} trading={cell.avgDailyTrading} holding={cell.avgDailyHolding} />
                );
              })}
              <td className="td-num td-total-col">
                <TooltipCell value={formatNum(row.totalTrading)} />
              </td>
              <td className="td-num td-total-col">
                <TooltipCell value={formatNum(row.totalHolding)} />
              </td>
            </tr>
          ))}

          {/* Totals row */}
          <tr className="row-totals">
            <td className="td-broker font-bold" colSpan={2}>合计</td>
            {brokers.map((broker) => {
              const cell = brokerTotals[broker] || { avgDailyTrading: 0, avgDailyHolding: 0 };
              return (
                <YearlyCellPair key={broker} trading={cell.avgDailyTrading} holding={cell.avgDailyHolding} />
              );
            })}
            <td className="td-num td-total-col">
              <TooltipCell value={formatNum(grandTotalTrading)} />
            </td>
            <td className="td-num td-total-col">
              <TooltipCell value={formatNum(grandTotalHolding)} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BrokerSubHeaders() {
  return (
    <>
      <th className="th-sub">日均成交</th>
      <th className="th-sub">日均持仓</th>
    </>
  );
}

function YearlyCellPair({ trading, holding }: { trading: number; holding: number }) {
  return (
    <>
      <td className="td-num">
        <TooltipCell value={formatNum(trading)} />
      </td>
      <td className="td-num">
        <TooltipCell value={formatNum(holding)} />
      </td>
    </>
  );
}
