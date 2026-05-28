import { Workflow } from "../models/Workflow.js";
import { estimateRunCost, createPaymentChallenge } from "../services/x402PaymentService.js";

/** Ensures workflow belongs to user and attaches cost estimate. */
export async function attachWorkflowOwner(req, res, next) {
  const workflow = await Workflow.findOne({ _id: req.params.id, userId: req.user.userId });
  if (!workflow) {
    return res.status(404).json({ success: false, error: "Workflow not found" });
  }
  req.workflow = workflow;
  next();
}

/** Optional pre-run balance gate — returns 402 with payment challenge when ?requirePayment=1 */
export async function workflowPaymentGate(req, res, next) {
  const { estimatedCredits } = estimateRunCost(req.workflow);
  req.estimatedCredits = estimatedCredits;
  if (req.body?.paymentProof) {
    req.paymentProof = req.body.paymentProof;
    return next();
  }
  if (req.query.requirePayment === "1" && !req.body?.paymentProof) {
    const challenge = createPaymentChallenge(
      req.user.userId,
      req.workflow._id,
      req.body?.runId || "pending",
      estimatedCredits
    );
    return res.status(402).json({
      success: false,
      error: "Payment required",
      paymentRequired: challenge,
      estimatedCredits,
    });
  }
  next();
}
