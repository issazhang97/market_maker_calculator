import type { PivotData } from "../types";

interface Props {
  data: PivotData;
}

function formatNum(n: number): string {
  return Math.round(n).toLocaleString("zh-CN");
}

export function SummaryTable({ data }: Props) {
  const { etfCodes, etfNames, rows, totals, grandTotal, date } = data;

  return (
    <div className="overflow-x-auto">
      <table className="summary-table">
        {/* Title */}
        <caption className="summary-caption">
          做市成交汇总 {date}
        </caption>

        <thead>
          {/* Row 1: ETF code + name headers */}
          <tr>
            <th rowSpan={2} className="th-broker">
              券商名称
            </th>
            {etfCodes.map((code) => (
              <th key={code} colSpan={2} className="th-etf">
                {code} {etfNames[code] || code}
              </th>
            ))}
            <th colSpan={2} className="th-total">
              合计
            </th>
          </tr>

          {/* Row 2: Sub-headers */}
          <tr>
            {etfCodes.map((code) => (
              <SubHeaders key={code} />
            ))}
            <SubHeaders />
          </tr>
        </thead>

        <tbody>
          {rows.map((row, i) => (
            <tr key={row.broker} className={i % 2 === 0 ? "row-even" : "row-odd"}>
              <td className="td-broker">{row.broker}</td>
              {etfCodes.map((code) => {
                const cell = row.cells[code] || { past5DaysAvg: 0, yesterday: 0 };
                return (
                  <CellPair
                    key={code}
                    avg={cell.past5DaysAvg}
                    yesterday={cell.yesterday}
                  />
                );
              })}
              <CellPair avg={row.total.past5DaysAvg} yesterday={row.total.yesterday} isTotal />
            </tr>
          ))}

          {/* Totals row */}
          <tr className="row-totals">
            <td className="td-broker font-bold">合计</td>
            {etfCodes.map((code) => {
              const cell = totals[code] || { past5DaysAvg: 0, yesterday: 0 };
              return (
                <CellPair
                  key={code}
                  avg={cell.past5DaysAvg}
                  yesterday={cell.yesterday}
                />
              );
            })}
            <CellPair
              avg={grandTotal.past5DaysAvg}
              yesterday={grandTotal.yesterday}
              isTotal
            />
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
  avg,
  yesterday,
  isTotal = false,
}: {
  avg: number;
  yesterday: number;
  isTotal?: boolean;
}) {
  const cls = isTotal ? "td-num td-total-col" : "td-num";
  return (
    <>
      <td className={cls}>{formatNum(avg)}</td>
      <td className={cls}>{formatNum(yesterday)}</td>
    </>
  );
}
