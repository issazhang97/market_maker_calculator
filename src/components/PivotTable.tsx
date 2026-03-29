import type { GenericPivotData, PivotCell } from "../types";
import { TooltipCell } from "./TooltipCell";

interface Props {
  data: GenericPivotData;
}

function formatNum(n: number): string {
  if (n === 0) return "";
  return n.toFixed(2);
}

function CellPair({ cell }: { cell: PivotCell }) {
  return (
    <>
      <td className="td-num">
        <TooltipCell value={formatNum(cell.avgDailyTrading)} tooltip={cell.tradingTooltip} />
      </td>
      <td className="td-num">
        <TooltipCell value={formatNum(cell.avgDailyHolding)} tooltip={cell.holdingTooltip} />
      </td>
    </>
  );
}

export function PivotTable({ data }: Props) {
  const { title, query, rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal } = data;
  const isProductRow = query.rowDim === "product";
  const rowLabelColSpan = isProductRow ? 2 : 1;

  if (rowKeys.length === 0 || colKeys.length === 0) {
    return <div className="mt-4 text-gray-500">暂无数据</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="summary-table">
        <thead>
          {/* Header row 1: title + col labels (each span 2) + 合计 */}
          <tr>
            <th className="th-broker" colSpan={rowLabelColSpan}>
              {title}
            </th>
            {colKeys.map((col) => (
              <th key={col.key} colSpan={2} className="th-etf">
                {col.label}
              </th>
            ))}
            <th colSpan={2} className="th-total">
              合计
            </th>
          </tr>

          {/* Header row 2: sub-headers */}
          <tr>
            {isProductRow ? (
              <>
                <th className="th-sub">名称</th>
                <th className="th-sub">代码</th>
              </>
            ) : (
              <th className="th-sub">
                {query.rowDim === "broker" ? "券商" : query.rowDim === "quarter" ? "季度" : "月份"}
              </th>
            )}
            {colKeys.map((col) => (
              <SubHeaders key={col.key} />
            ))}
            <th className="th-sub">日均成交</th>
            <th className="th-sub">日均持仓</th>
          </tr>
        </thead>

        <tbody>
          {rowKeys.map((row, i) => (
            <tr key={row.key} className={i % 2 === 0 ? "row-even" : "row-odd"}>
              {isProductRow ? (
                <>
                  <td className="td-broker">{row.label}</td>
                  <td className="td-broker" style={{ textAlign: "center" }}>{row.key}</td>
                </>
              ) : (
                <td className="td-broker">{row.label}</td>
              )}
              {colKeys.map((col) => (
                <CellPair key={col.key} cell={cells[row.key][col.key]} />
              ))}
              <td className="td-num td-total-col">
                <TooltipCell value={formatNum(rowTotals[row.key].avgDailyTrading)} />
              </td>
              <td className="td-num td-total-col">
                <TooltipCell value={formatNum(rowTotals[row.key].avgDailyHolding)} />
              </td>
            </tr>
          ))}

          {/* Totals row */}
          <tr className="row-totals">
            <td className="td-broker font-bold" colSpan={rowLabelColSpan}>合计</td>
            {colKeys.map((col) => (
              <CellPair key={col.key} cell={colTotals[col.key]} />
            ))}
            <td className="td-num td-total-col">
              <TooltipCell value={formatNum(grandTotal.avgDailyTrading)} />
            </td>
            <td className="td-num td-total-col">
              <TooltipCell value={formatNum(grandTotal.avgDailyHolding)} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SubHeaders() {
  return (
    <>
      <th className="th-sub">日均成交</th>
      <th className="th-sub">日均持仓</th>
    </>
  );
}
