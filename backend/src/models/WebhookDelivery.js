import mongoose from "mongoose";

const webhookDeliverySchema = new mongoose.Schema(
  {
    webhookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorWebhook",
      required: true,
      index: true,
    },
    creatorWallet: { type: String, required: true, index: true },
    event: { type: String, required: true },
    url: { type: String, required: true },
    success: { type: Boolean, required: true },
    httpStatus: { type: Number },
    errorMessage: { type: String },
    attemptCount: { type: Number, default: 1 },
    payloadId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

webhookDeliverySchema.index({ creatorWallet: 1, createdAt: -1 });

export const WebhookDelivery = mongoose.model("WebhookDelivery", webhookDeliverySchema);
