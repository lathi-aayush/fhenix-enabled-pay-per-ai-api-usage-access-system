import React, { createContext, useContext, useMemo, useState } from "react";

const NodeExecutionContext = createContext(null);

export function NodeExecutionProvider({ children }) {
  const [nodeStatuses, setNodeStatuses] = useState({});
  const [runId, setRunId] = useState(null);

  const value = useMemo(
    () => ({
      runId,
      nodeStatuses,
      setRunId,
      setNodeStatuses,
      executionState: { runId, nodeStatuses },
    }),
    [runId, nodeStatuses]
  );

  return <NodeExecutionContext.Provider value={value}>{children}</NodeExecutionContext.Provider>;
}

export function useNodeExecution() {
  const ctx = useContext(NodeExecutionContext);
  if (!ctx) throw new Error("useNodeExecution must be used within NodeExecutionProvider");
  return ctx;
}
