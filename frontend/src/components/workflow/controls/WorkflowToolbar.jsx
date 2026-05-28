import React from "react";

export default function WorkflowToolbar({
  name,
  onNameChange,
  onSave,
  onRun,
  isSaving,
  isRunning,
  lastSavedAt,
  walletBalance,
}) {
  return (
    <div className="bg-white border border-surface-variant rounded-lg px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm mb-3">
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="workflow-field font-headline font-semibold text-sm text-primary border border-surface-variant rounded-md px-3 py-1.5 min-w-[200px] focus:outline-none focus:border-secondary"
        placeholder="Workflow name"
      />
      <span className="text-[10px] text-on-surface-variant">
        {isSaving ? "Saving…" : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : "Unsaved"}
      </span>
      <span className="text-[10px] text-on-surface-variant ml-auto font-mono">
        Burner: {walletBalance != null ? `${Number(walletBalance).toFixed(4)} ALGO` : "—"}
      </span>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="text-xs px-3 py-2 rounded-md border border-surface-variant text-primary font-semibold hover:bg-slate-50 disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning}
        className="text-xs px-4 py-2 rounded-md bg-[#031634] text-white font-bold hover:opacity-90 disabled:opacity-50"
      >
        {isRunning ? "Running…" : "Run workflow"}
      </button>
    </div>
  );
}
