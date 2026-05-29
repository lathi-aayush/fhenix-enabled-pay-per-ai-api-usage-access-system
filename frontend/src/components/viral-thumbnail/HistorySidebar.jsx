import React from "react";

export default function HistorySidebar({ history, onSelect, onClear }) {
  if (!history.length) {
    return (
      <div className="rounded-md border border-surface-variant bg-white p-3">
        <p className="text-[11px] text-on-surface-variant">Recent generations appear here (saved locally).</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-surface-variant bg-white p-3 max-h-[280px] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-primary">Recent</span>
        <button type="button" onClick={onClear} className="text-[10px] text-slate-500 hover:underline">
          Clear
        </button>
      </div>
      <ul className="space-y-2">
        {history.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="w-full text-left px-2 py-2 rounded-md border border-slate-100 hover:bg-slate-50 transition-colors"
            >
              <p className="text-[11px] font-semibold text-primary line-clamp-2">{item.title}</p>
              <p className="text-[10px] text-slate-500">{new Date(item.savedAt).toLocaleString()}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
