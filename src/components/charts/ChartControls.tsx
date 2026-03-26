import { useState, useRef, useEffect, useCallback } from "react";
import type { AnalyticsQuery } from "../../types";

interface Props {
  query: AnalyticsQuery;
  onChange: (query: AnalyticsQuery) => void;
  availableYears: string[];
  availableBrokers: string[];
  availableProducts: { code: string; name: string }[];
}

export function ChartControls({
  query,
  onChange,
  availableYears,
  availableBrokers,
  availableProducts,
}: Props) {
  return (
    <div className="dim-selector">
      <div className="dim-selector-row">
        <label className="dim-label">
          年度:
          <select
            className="dim-select"
            value={query.year}
            onChange={(e) => onChange({ ...query, year: e.target.value, selectedBrokers: [], selectedProducts: [] })}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </label>

        <label className="dim-label">
          指标:
          <select
            className="dim-select"
            value={query.metric}
            onChange={(e) => onChange({ ...query, metric: e.target.value as "trading" | "holding" })}
          >
            <option value="trading">成交量</option>
            <option value="holding">持仓</option>
          </select>
        </label>

        <label className="dim-label">
          粒度:
          <select
            className="dim-select"
            value={query.granularity}
            onChange={(e) => onChange({ ...query, granularity: e.target.value as "daily" | "weekly" | "monthly" })}
          >
            <option value="daily">日</option>
            <option value="weekly">周</option>
            <option value="monthly">月</option>
          </select>
        </label>

        <label className="dim-label">
          图表:
          <select
            className="dim-select"
            value={query.chartType}
            onChange={(e) => onChange({ ...query, chartType: e.target.value as "line" | "bar" })}
          >
            <option value="line">折线图</option>
            <option value="bar">柱状图</option>
          </select>
        </label>
      </div>

      <div className="dim-selector-row">
        <MultiSelectDropdown
          label="筛选券商"
          allItems={availableBrokers.map((b) => ({ value: b, label: b }))}
          selected={query.selectedBrokers}
          onChange={(brokers) => onChange({ ...query, selectedBrokers: brokers })}
        />
        <MultiSelectDropdown
          label="筛选产品"
          allItems={availableProducts.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` }))}
          selected={query.selectedProducts}
          onChange={(products) => onChange({ ...query, selectedProducts: products })}
        />
      </div>
    </div>
  );
}

interface MultiSelectProps {
  label: string;
  allItems: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function MultiSelectDropdown({ label, allItems, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isAllSelected = selected.length === 0;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  const toggleItem = (value: string) => {
    if (isAllSelected) {
      onChange(allItems.filter((i) => i.value !== value).map((i) => i.value));
    } else if (selected.includes(value)) {
      const next = selected.filter((v) => v !== value);
      onChange(next);
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  const displayText = isAllSelected
    ? "全部"
    : selected.length === 1
      ? allItems.find((i) => i.value === selected[0])?.label ?? selected[0]
      : `已选${selected.length}项`;

  return (
    <div className="dim-label multi-select-wrapper" ref={ref}>
      {label}:
      <button className="dim-select multi-select-btn" onClick={() => setOpen(!open)}>
        {displayText}
        <span className="multi-select-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="multi-select-dropdown">
          <label className="multi-select-item">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={selectAll}
            />
            全部
          </label>
          {allItems.map((item) => (
            <label key={item.value} className="multi-select-item">
              <input
                type="checkbox"
                checked={isAllSelected || selected.includes(item.value)}
                onChange={() => toggleItem(item.value)}
              />
              {item.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
