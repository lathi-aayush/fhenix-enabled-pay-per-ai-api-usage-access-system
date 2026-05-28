import React, { useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import InputNode from "./nodes/InputNode.jsx";
import AINode from "./nodes/AINode.jsx";
import LogicNode from "./nodes/LogicNode.jsx";
import OutputNode from "./nodes/OutputNode.jsx";
import BlogNode from "./nodes/BlogNode.jsx";
import AnimatedEdge from "./edges/AnimatedEdge.jsx";

const nodeTypes = { input: InputNode, ai: AINode, logic: LogicNode, output: OutputNode, blog: BlogNode };
const edgeTypes = { animated: AnimatedEdge };

export const NODE_DEFAULTS = {
  input: { label: "User Input", inputType: "youtube", value: "", config: {} },
  ai: {
    label: "AI Agent",
    model: "llama-3.3-70b-versatile",
    systemPrompt:
      "You are a content researcher. Produce publish-ready notes: facts, outline with H2s, SEO keywords, and audience hook. Use structured markdown sections.",
    outputFormat: "summary",
    temperature: 0.7,
    maxTokens: 1024,
    estimatedCredits: 0.002,
    config: {},
  },
  logic: { label: "Logic", conditionType: "if/else", conditionExpression: "", delayMs: 500, config: {} },
  output: { label: "Output", outputType: "structured", outputFormat: "summary", destination: "", config: {} },
  blog: {
    label: "Blog Agent",
    projectId: "",
    tone: "professional",
    wordCount: 1000,
    publishMode: "publish",
    platforms: ["devto"],
    scheduledFor: "",
    targetAudience: "",
    keywords: [],
    config: {},
  },
};

function FlowCanvas({
  nodes,
  edges,
  setNodes,
  setEdges,
  executionState,
  selectedNodeId,
  onNodeClick,
  onNodeRemoved,
}) {
  const { screenToFlowPosition } = useReactFlow();

  const onNodesChange = useCallback(
    (changes) => {
      const removedIds = changes.filter((c) => c.type === "remove").map((c) => c.id);
      setNodes((nds) => applyNodeChanges(changes, nds));
      if (removedIds.length) {
        setEdges((eds) =>
          eds.filter((e) => !removedIds.includes(e.source) && !removedIds.includes(e.target))
        );
        if (removedIds.includes(selectedNodeId)) onNodeRemoved?.();
      }
    },
    [setNodes, setEdges, selectedNodeId, onNodeRemoved]
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onConnect = useCallback(
    (connection) => {
      setEdges((eds) => {
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);
        if (
          sourceNode?.type === "output" ||
          sourceNode?.type === "blog" ||
          targetNode?.type === "input"
        ) {
          return eds;
        }
        return addEdge(
          {
            ...connection,
            id: `edge_${crypto.randomUUID()}`,
            type: "animated",
            animated: true,
          },
          eds
        );
      });
    },
    [nodes, setEdges]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData("application/reactflow");
      if (!nodeType || !NODE_DEFAULTS[nodeType]) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode = {
        id: `node_${crypto.randomUUID()}`,
        type: nodeType,
        position,
        data: { ...NODE_DEFAULTS[nodeType] },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  return (
    <div className="relative h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes.map((n) => ({
          ...n,
          selected: n.id === selectedNodeId,
          deletable: true,
        }))}
        edges={edges.map((e) => ({
          ...e,
          deletable: true,
          type: e.type || "animated",
          data: { executing: executionState?.nodeStatuses?.[e.target] === "running" },
        }))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick?.(node)}
        onPaneClick={() => onNodeRemoved?.()}
        nodesDeletable
        edgesDeletable
        deleteKeyCode={["Delete", "Backspace"]}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.3}
        maxZoom={1.5}
        fitView={nodes.length > 0}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-50"
      >
        <Background variant="dots" gap={16} size={1} color="#cbd5e1" />
        <MiniMap
          nodeColor="#031634"
          maskColor="rgba(249,249,249,0.85)"
          className="!bg-white !border-surface-variant"
        />
        <Controls showInteractive={false} className="!bg-white !border-surface-variant !shadow-sm" />
      </ReactFlow>
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center max-w-sm px-6">
            <span className="material-symbols-outlined text-4xl text-slate-300">account_tree</span>
            <p className="text-sm font-semibold text-slate-600 mt-2">Empty canvas</p>
            <p className="text-xs text-slate-500 mt-1">
              Drag nodes from the left panel, or click a node type to add one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowCanvas(props) {
  return (
    <div className="workflow-canvas h-[calc(100vh-12rem)] min-h-[480px] w-full rounded-lg border border-surface-variant overflow-hidden bg-white shadow-sm">
      <ReactFlowProvider>
        <FlowCanvas {...props} />
      </ReactFlowProvider>
    </div>
  );
}
