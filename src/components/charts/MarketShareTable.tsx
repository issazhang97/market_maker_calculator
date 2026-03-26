import { useState } from "react";
import type { MarketShareRow } from "../../types";

interface Props {
  data: MarketShareRow[];
}

type SortKey = "broker" | "currentValue" | "currentShare" | "previousValue" | "previousShare" | "shareChange";

export function MarketShareTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("currentValue");
  const [sortAsc, setSortAsc] = useState(false);

  if (data.length === 0) return null;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return "";
    return sortAsc ? " ↑" : " ↓";
  };

  return (
    <div className="overflow-x-auto">
      <table className="summary-table">
        <thead>
          <tr>
            <th className="th-broker cursor-pointer" onClick={() => handleSort("broker")}>
              券商{sortIndicator("broker")}
            </th>
            <th className="th-etf cursor-pointer" onClick={() => handleSort("currentValue")}>
              本期成交{sortIndicator("currentValue")}
            </th>
            <th className="th-etf cursor-pointer" onClick={() => handleSort("currentShare")}>
              占比{sortIndicator("currentShare")}
            </th>
            <th className="th-sub cursor-pointer" onClick={() => handleSort("previousValue")}>
              上期成交{sortIndicator("previousValue")}
            </th>
            <th className="th-sub cursor-pointer" onClick={() => handleSort("previousShare")}>
              占比{sortIndicator("previousShare")}
            </th>
            <th className="th-total cursor-pointer" onClick={() => handleSort("shareChange")}>
              变化{sortIndicator("shareChange")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.broker} className={i % 2 === 0 ? "row-even" : "row-odd"}>
              <td className="td-broker">{row.broker}</td>
              <td className="td-num">{row.currentValue.toFixed(2)}</td>
              <td className="td-num">{row.currentShare.toFixed(1)}%</td>
              <td className="td-num">{row.previousValue.toFixed(2)}</td>
              <td className="td-num">{row.previousShare.toFixed(1)}%</td>
              <td className="td-num">
                <ShareChangeCell change={row.shareChange} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShareChangeCell({ change }: { change: number }) {
  if (Math.abs(change) < 0.05) {
    return <span className="text-gray-500">—</span>;
  }
  if (change > 0) {
    return <span className="text-green-600">↑+{change.toFixed(1)}%</span>;
  }
  return <span className="text-red-600">↓{change.toFixed(1)}%</span>;
}
