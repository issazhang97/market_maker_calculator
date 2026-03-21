interface Props {
  dates: string[];
  selectedDate: string | null;
  onChange: (date: string | null) => void;
}

export function DateSelector({ dates, selectedDate, onChange }: Props) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">计算日期:</label>
      <select
        value={selectedDate ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="">最新日期 (自动)</option>
        {dates.map((date) => (
          <option key={date} value={date}>
            {date}
          </option>
        ))}
      </select>
    </div>
  );
}
