export type ViewType = "daily" | "yearly" | "custom";

interface Props {
  currentView: ViewType;
  onChange: (view: ViewType) => void;
}

export function ViewSwitcher({ currentView, onChange }: Props) {
  return (
    <div className="view-switcher">
      <button
        className={`view-tab ${currentView === "daily" ? "view-tab-active" : ""}`}
        onClick={() => onChange("daily")}
      >
        每日成交汇总
      </button>
      <button
        className={`view-tab ${currentView === "yearly" ? "view-tab-active" : ""}`}
        onClick={() => onChange("yearly")}
      >
        年度日均成交与持仓
      </button>
      <button
        className={`view-tab ${currentView === "custom" ? "view-tab-active" : ""}`}
        onClick={() => onChange("custom")}
      >
        自定义分析
      </button>
    </div>
  );
}
