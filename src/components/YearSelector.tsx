interface Props {
  years: string[];
  selectedYear: string | null;
  onChange: (year: string | null) => void;
}

export function YearSelector({ years, selectedYear, onChange }: Props) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">统计年度:</label>
      <select
        value={selectedYear ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="">最新年度 (自动)</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}
