import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { PivotData, ETFSummaryCell } from "../types";

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

function TooltipCell({ value, tooltip }: { value: string; tooltip?: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const spanRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    if (!tooltip || !spanRef.current) return;
    const rect = spanRef.current.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setShow(true);
  }, [tooltip]);

  const handleLeave = useCallback(() => setShow(false), []);

  // Adjust position if tooltip overflows viewport
  useEffect(() => {
    if (!show || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const rect = el.getBoundingClientRect();
    let { x, y } = pos;

    // Prevent overflow right
    if (rect.right > window.innerWidth - 8) {
      x -= rect.right - window.innerWidth + 8;
    }
    // Prevent overflow left
    if (rect.left < 8) {
      x += 8 - rect.left;
    }
    // If overflows top, show below instead
    if (rect.top < 8) {
      const spanRect = spanRef.current?.getBoundingClientRect();
      if (spanRect) y = spanRect.bottom + 6 + rect.height;
    }

    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [show, pos]);

  if (!tooltip) return <>{value}</>;

  return (
    <>
      <span
        ref={spanRef}
        className="cell-has-tooltip"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {value}
      </span>
      {show && createPortal(
        <div
          ref={tooltipRef}
          className="cell-tooltip"
          style={{ left: pos.x, top: pos.y }}
        >
          {tooltip}
        </div>,
        document.body,
      )}
    </>
  );
}
