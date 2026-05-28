import mongoose from "mongoose";

const agentTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "Writing", index: true },
    description: { type: String, default: "" },
    tags: { type: [String], default: [] },
    nodeStructure: {
      nodes: { type: mongoose.Schema.Types.Mixed, default: [] },
      edges: { type: mongoose.Schema.Types.Mixed, default: [] },
    },
    estimatedCreditsPerRun: { type: Number, default: 0.01 },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    usageCount: { type: Number, default: 0 },
    rating: { type: Number, default: 4.5 },
    reviewCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AgentTemplate = mongoose.model("AgentTemplate", agentTemplateSchema);
