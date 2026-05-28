import mongoose from "mongoose";

const toneEnum = ["professional", "casual", "educational", "technical", "storytelling", "persuasive"];
const statusEnum = ["draft", "scheduled", "publishing", "published", "failed"];

const blogPostSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "" },
    content: { type: String, default: "" },
    keywords: [{ type: String }],
    tone: { type: String, enum: toneEnum, default: "professional" },
    targetAudience: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    seoScore: { type: Number, min: 0, max: 100, default: 0 },
    readingTime: { type: Number, default: 0 },
    hashtags: [{ type: String }],
    metaDescription: { type: String, default: "" },
    titleSuggestions: [{ type: String }],
    socialSnippets: {
      linkedin: { type: String, default: "" },
      twitter: { type: String, default: "" },
    },
    status: { type: String, enum: statusEnum, default: "draft", index: true },
    scheduledFor: { type: Date },
    /** Platforms to publish to when scheduledFor fires */
    scheduledPlatforms: [{ type: String }],
    publishedPlatforms: [
      {
        platform: String,
        url: String,
        publishedAt: Date,
      },
    ],
    publishError: { type: String },
  },
  { timestamps: true }
);

export const BlogPost = mongoose.model("BlogPost", blogPostSchema);
