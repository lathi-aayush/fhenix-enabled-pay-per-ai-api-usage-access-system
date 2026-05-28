import { useEffect, useRef } from "react";
import { useWorkflow } from "../context/WorkflowContext.jsx";

export function useWorkflowPersistence() {
  const { workflowId, name, nodes, edges, saveWorkflow } = useWorkflow();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!workflowId) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveWorkflow().catch(console.error);
    }, 1500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [workflowId, name, nodes, edges, saveWorkflow]);
}
