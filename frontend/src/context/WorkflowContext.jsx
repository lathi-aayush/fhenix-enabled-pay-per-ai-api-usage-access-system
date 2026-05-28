import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { WORKFLOW_API } from "../api/workflowApi.js";

const WorkflowContext = createContext(null);

export function WorkflowProvider({ children }) {
  const [workflowId, setWorkflowId] = useState(null);
  const [name, setName] = useState("Untitled Workflow");
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const saveWorkflow = useCallback(async () => {
    if (!workflowId) return null;
    setIsSaving(true);
    try {
      const cleanNodes = nodes.map(({ id, type, position, data: d }) => ({
        id,
        type,
        position,
        data: d,
      }));
      const cleanEdges = edges.map(({ id, source, target, sourceHandle, targetHandle, animated }) => ({
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
        animated: animated !== false,
      }));
      const { data } = await api.put(WORKFLOW_API.one(workflowId), {
        name,
        nodes: cleanNodes,
        edges: cleanEdges,
      });
      if (data?.success) {
        setLastSavedAt(new Date());
        return data.data;
      }
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, name, nodes, edges]);

  const loadWorkflow = useCallback(async (id) => {
    const { data } = await api.get(WORKFLOW_API.one(id));
    if (!data?.success) throw new Error(data?.error || "Failed to load workflow");
    const w = data.data;
    setWorkflowId(w._id);
    setName(w.name);
    setNodes(
      (w.nodes || []).map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }))
    );
    setEdges(
      (w.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: "animated",
        animated: e.animated !== false,
      }))
    );
    return w;
  }, []);

  const duplicateWorkflow = useCallback(async (id) => {
    const { data } = await api.post(WORKFLOW_API.duplicate(id));
    if (!data?.success) throw new Error(data?.error || "Duplicate failed");
    return data.data;
  }, []);

  const value = useMemo(
    () => ({
      workflowId,
      name,
      nodes,
      edges,
      isSaving,
      lastSavedAt,
      setWorkflowId,
      setName,
      setNodes,
      setEdges,
      saveWorkflow,
      loadWorkflow,
      duplicateWorkflow,
    }),
    [
      workflowId,
      name,
      nodes,
      edges,
      isSaving,
      lastSavedAt,
      saveWorkflow,
      loadWorkflow,
      duplicateWorkflow,
    ]
  );

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error("useWorkflow must be used within WorkflowProvider");
  return ctx;
}
