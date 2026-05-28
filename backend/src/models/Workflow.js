import mongoose from "mongoose";
import { applySoftDelete } from "./softDelete.js";

const positionSchema = new mongoose.Schema(
  { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
  { _id: false }
);

const nodeDataSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" },
    inputType: { type: String },
    value: { type: String, default: "" },
    model: { type: String },
    systemPrompt: { type: String, default: "" },
    temperature: { type: Number, default: 0.7 },
    maxTokens: { type: Number, default: 1024 },
    estimatedCredits: { type: Number, default: 0 },
    conditionType: { type: String },
    conditionExpression: { type: String, default: "" },
    delayMs: { type: Number, default: 0 },
    outputType: { type: String },
    destination: { type: String, default: "" },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false, strict: false }
);

const workflowNodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["input", "ai", "logic", "output", "blog"], required: true },
    position: { type: positionSchema, default: () => ({ x: 0, y: 0 }) },
    data: { type: nodeDataSchema, default: () => ({}) },
  },
  { _id: false }
);

const workflowEdgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    sourceHandle: { type: String },
    targetHandle: { type: String },
    animated: { type: Boolean, default: true },
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, default: "Untitled Workflow" },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    nodes: { type: [workflowNodeSchema], default: [] },
    edges: { type: [workflowEdgeSchema], default: [] },
    version: { type: Number, default: 1 },
    isTemplate: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

workflowSchema.index({ userId: 1, status: 1 });
workflowSchema.index({ userId: 1, createdAt: -1 });
applySoftDelete(workflowSchema);

export const Workflow = mongoose.model("Workflow", workflowSchema);
