import type { PivotData, ETFSummaryCell } from "../types";
import { TooltipCell } from "./TooltipCell";

interface Props {
  data: PivotData;
}

function formatNum(n: number): string {
  if (n === 0) return "";
  return n.toFixed(2);
}

export function SummaryTable({ data }: Props) {
  const { products, rows, totals, grandTotal, date } = data;

  return (
    <div className="overflow-x-auto">
      <table className="summary-table">
        <thead>
          {/* Row 1: Date + product name headers */}
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

          {/* Row 2: (万元) label + sub-headers */}
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
                return (
                  <CellPair key={name} cell={cell} />
                );
              })}
              <CellPair cell={row.total} isTotal />
            </tr>
          ))}

          {/* Totals row */}
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
}: {
  cell: ETFSummaryCell;
  isTotal?: boolean;
}) {
  const cls = isTotal ? "td-num td-total-col" : "td-num";
  return (
    <>
      <td className={cls}>
        <TooltipCell value={formatNum(cell.past5DaysAvg)} tooltip={cell.avgTooltip} />
      </td>
      <td className={cls}>
        <TooltipCell value={formatNum(cell.yesterday)} tooltip={cell.yestTooltip} />
      </td>
    </>
  );
}

