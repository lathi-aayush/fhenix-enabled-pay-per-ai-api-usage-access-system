import mongoose from "mongoose";

export const CREATOR_WEBHOOK_EVENTS = ["api.purchase.completed", "webhook.test"];

const creatorWebhookSchema = new mongoose.Schema(
  {
    creatorWallet: { type: String, required: true, trim: true, index: true },
    url: { type: String, required: true, trim: true },
    /** HMAC signing secret — shown in full only at creation time */
    secret: { type: String, required: true },
    description: { type: String, default: "", trim: true, maxlength: 200 },
    events: {
      type: [String],
      default: ["api.purchase.completed"],
      validate: {
        validator(events) {
          return Array.isArray(events) && events.length > 0 && events.every((e) => CREATOR_WEBHOOK_EVENTS.includes(e) && e !== "webhook.test");
        },
        message: "Invalid webhook events",
      },
    },
    enabled: { type: Boolean, default: true },
    lastDeliveryAt: { type: Date },
    lastDeliveryStatus: { type: String, enum: ["success", "failed", null], default: null },
  },
  { timestamps: true }
);

creatorWebhookSchema.index({ creatorWallet: 1, url: 1 }, { unique: true });

export const CreatorWebhook = mongoose.model("CreatorWebhook", creatorWebhookSchema);
