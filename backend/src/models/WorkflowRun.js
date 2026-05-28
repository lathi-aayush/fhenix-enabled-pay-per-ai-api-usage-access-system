import mongoose from "mongoose";

const nodeResultSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true },
    status: {
      type: String,
      enum: ["idle", "queued", "running", "completed", "success", "error"],
      default: "queued",
    },
    output: { type: String, default: "" },
    tokensUsed: { type: Number, default: 0 },
    creditsDeducted: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String, default: null },
  },
  { _id: false }
);

const workflowRunSchema = new mongoose.Schema(
  {
    workflowId: { type: mongoose.Schema.Types.ObjectId, ref: "Workflow", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "cancelled"],
      default: "pending",
    },
    nodeResults: { type: [nodeResultSchema], default: [] },
    totalTokensUsed: { type: Number, default: 0 },
    totalCreditsDeducted: { type: Number, default: 0 },
    estimatedCredits: { type: Number, default: 0 },
    logs: { type: [String], default: [] },
    txHash: { type: String, default: null },
    walletAddress: { type: String, default: null },
    runtimeMs: { type: Number, default: 0 },
    triggeredBy: { type: String, default: "manual" },
    idempotencyKey: { type: String, sparse: true, unique: true },
    completedAt: { type: Date, default: null },
    structuredResult: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

workflowRunSchema.index({ workflowId: 1, status: 1 });
workflowRunSchema.index({ userId: 1, createdAt: -1 });

export const WorkflowRun = mongoose.model("WorkflowRun", workflowRunSchema);
