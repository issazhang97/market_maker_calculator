import type { PivotData } from "../types";

interface Props {
  data: PivotData;
}

function formatNum(n: number): string {
  if (n === 0) return "";
  return n.toFixed(2);
}

export function SummaryTable({ data }: Props) {
  const { etfCodes, etfNames, rows, totals, grandTotal, date } = data;

  return (
    <div className="overflow-x-auto">
      <table className="summary-table">
        <thead>
          {/* Row 1: Date + ETF name headers */}
          <tr>
            <th rowSpan={2} className="th-broker">
              {date}
            </th>
            {etfCodes.map((code) => (
              <th key={code} colSpan={2} className="th-etf">
                {etfNames[code] || code}
              </th>
            ))}
            <th colSpan={2} className="th-total">
              合计
            </th>
          </tr>

          {/* Row 2: (万元) label + sub-headers */}
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
