import React, { memo, useCallback } from "react";
import { Position } from "@xyflow/react";
import NodeShell from "./NodeShell.jsx";
import { useWorkflow } from "../../../context/WorkflowContext.jsx";

export const AGENTIC_NODE_META = {
  agenticText: {
    label: "Agentic · Text",
    subtitle: "Gemini script / research",
    icon: "article",
    model: "gemini-2.5-flash",
    credits: 0.008,
  },
  agenticImage: {
    label: "Agentic · Image",
    subtitle: "Imagen / Gemini keyframes",
    icon: "image",
    model: "Imagen · Gemini",
    credits: 0.018,
  },
  agenticVideo: {
    label: "Agentic · Video",
    subtitle: "Veo 2 (Vertex)",
    icon: "movie",
    model: "veo-2",
    credits: 0.05,
  },
  agenticAudio: {
    label: "Agentic · Audio",
    subtitle: "Gemini TTS voiceover",
    icon: "mic",
    model: "gemini-tts",
    credits: 0.01,
  },
  agenticCode: {
    label: "Agentic · Code",
    subtitle: "Gemma Python sandbox",
    icon: "code",
    model: "gemma-3-27b",
    credits: 0.006,
  },
};

function AgenticAgentNode({ id, data, selected, type }) {
  const meta = AGENTIC_NODE_META[type] || AGENTIC_NODE_META.agenticText;
  const { nodes, setNodes } = useWorkflow();

  const update = useCallback(
    (patch) => {
      setNodes(nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [id, nodes, setNodes]
  );

  return (
    <NodeShell
      id={id}
      selected={selected}
      data={{ ...data, label: data?.label || meta.label }}
      inputPosition={Position.Top}
      outputs={[{ id: "out", position: Position.Bottom }]}
    >
      <p className="text-[10px] text-on-surface-variant">{meta.subtitle}</p>
      <p className="text-[10px] font-mono text-secondary mt-0.5">{meta.model}</p>
      {type === "agenticImage" && (
        <select
          className="nodrag nopan workflow-field mt-1 w-full text-[11px] border border-surface-variant rounded-md px-2 py-1 bg-white text-primary"
          value={data?.imageCount ?? 3}
          onChange={(e) => update({ imageCount: Number(e.target.value) })}
          onClick={(e) => e.stopPropagation()}
        >
          <option value={1}>1 image</option>
          <option value={2}>2 images</option>
          <option value={3}>3 keyframes</option>
        </select>
      )}
      <p className="text-[10px] text-secondary font-mono mt-1">
        ~{(data?.estimatedCredits ?? meta.credits).toFixed(4)} ETH est.
      </p>
    </NodeShell>
  );
}

export default memo(AgenticAgentNode);
