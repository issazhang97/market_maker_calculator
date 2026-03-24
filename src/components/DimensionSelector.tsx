import { useState, useRef, useEffect, useCallback } from "react";
import type { PivotDimension, PivotQuery } from "../types";

const DIM_OPTIONS: { value: PivotDimension; label: string }[] = [
  { value: "product", label: "产品" },
  { value: "broker", label: "券商" },
  { value: "quarter", label: "季度" },
  { value: "month", label: "月份" },
];

interface Props {
  query: PivotQuery;
  onChange: (query: PivotQuery) => void;
  availableYears: string[];
  availableBrokers: string[];
  availableProducts: { code: string; name: string }[];
}

export function DimensionSelector({
  query,
  onChange,
  availableYears,
  availableBrokers,
  availableProducts,
}: Props) {
  const handleYearChange = (year: string) => {
    onChange({ ...query, filters: { ...query.filters, year, brokers: undefined, products: undefined } });
  };

  const handleRowDimChange = (dim: PivotDimension) => {
    if (dim === query.colDim) {
      // Swap
      onChange({ ...query, rowDim: dim, colDim: query.rowDim });
    } else {
      onChange({ ...query, rowDim: dim });
    }
  };

  const handleColDimChange = (dim: PivotDimension) => {
    if (dim === query.rowDim) {
      // Swap
      onChange({ ...query, colDim: dim, rowDim: query.colDim });
    } else {
      onChange({ ...query, colDim: dim });
    }
  };

  const handleBrokersChange = (brokers: string[]) => {
    onChange({
      ...query,
      filters: {
        ...query.filters,
        brokers: brokers.length === 0 || brokers.length === availableBrokers.length
          ? undefined
          : brokers,
      },
    });
  };

  const handleProductsChange = (products: string[]) => {
    onChange({
      ...query,
      filters: {
        ...query.filters,
        products: products.length === 0 || products.length === availableProducts.length
          ? undefined
          : products,
      },
    });
  };

  return (
    <div className="dim-selector">
      <div className="dim-selector-row">
        <label className="dim-label">
          统计年度:
          <select
            className="dim-select"
            value={query.filters.year}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </label>

        <label className="dim-label">
          行维度:
          <select
            className="dim-select"
            value={query.rowDim}
            onChange={(e) => handleRowDimChange(e.target.value as PivotDimension)}
          >
            {DIM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="dim-label">
          列维度:
          <select
            className="dim-select"
            value={query.colDim}
            onChange={(e) => handleColDimChange(e.target.value as PivotDimension)}
          >
            {DIM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="dim-selector-row">
        <MultiSelectDropdown
          label="筛选券商"
          allItems={availableBrokers.map((b) => ({ value: b, label: b }))}
          selected={query.filters.brokers ?? []}
          onChange={handleBrokersChange}
        />
        <MultiSelectDropdown
          label="筛选产品"
          allItems={availableProducts.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` }))}
          selected={query.filters.products ?? []}
          onChange={handleProductsChange}
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
      // Switching from "all" to specific: select all except the toggled one
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
