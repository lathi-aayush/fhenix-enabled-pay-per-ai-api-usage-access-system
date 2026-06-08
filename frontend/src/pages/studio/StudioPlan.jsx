import React from "react";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useWalletAction } from "../../hooks/useWalletAction.js";
import GuestConnectBanner from "../../components/GuestConnectBanner.jsx";
import {
  PLAN_PRICE_ALGO,
  PLAN_PRICES,
  PLAN_CREDITS,
  CREDIT_WEIGHTS,
  OVERAGE_PRICES,
  PAID_TIERS,
  RATE_NOTE,
  algoDisplayToInr,
  algoDisplayToUsd,
  creditExamples,
  upgradeNote,
} from "../../constants/studioPlans.js";
import {
  addressesEqual,
  connectPera,
  reconnectPera,
  signAndSendPayment,
} from "../../wallet/pera.js";
import { usePaymentConfig } from "../../hooks/usePaymentConfig.js";

const EXPLORER_TX_TESTNET = "https://testnet.algoexplorer.io/tx/";

const TIERS = [
  {
    id: "free",
    name: "Free",
    credits: PLAN_CREDITS.free,
    blogs: "3 / month",
    projects: "2",
    publishing: "Drafts only",
    video: false,
    paid: false,
  },
  {
    id: "creator",
    name: "Creator",
    credits: PLAN_CREDITS.creator,
    blogs: "50 / month",
    projects: "10",
    publishing: "Medium + LinkedIn",
    video: false,
    paid: true,
  },
  {
    id: "pro",
    name: "Pro",
    credits: PLAN_CREDITS.pro,
    blogs: "Unlimited",
    projects: "Unlimited",
    publishing: "All platforms",
    video: true,
    paid: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    credits: PLAN_CREDITS.enterprise,
    blogs: "Unlimited",
    projects: "Unlimited",
    publishing: "White-label + SLA",
    video: true,
    paid: true,
  },
];

const STATUS_LABELS = {
  idle: "",
  connecting_wallet: "Connecting Pera Wallet…",
  awaiting_signature: "Approve the payment in Pera Wallet…",
  submitting_tx: "Submitting transaction…",
  confirming: "Waiting for on-chain confirmation…",
  verifying: "Verifying payment with Sentinal…",
  success: "Upgrade complete.",
  error: "",
};

export default function StudioPlan() {
  const { user, isAuthenticated } = useAuth();
  const { runWithWallet } = useWalletAction();
  const queryClient = useQueryClient();
  const { algodServer, receiverWallet, loading: paymentConfigLoading } = usePaymentConfig();
  const [payStatus, setPayStatus] = useState("idle");
  const [activeTier, setActiveTier] = useState(null);
  const [lastTxId, setLastTxId] = useState(null);
  const [payError, setPayError] = useState(null);

  const { data: usage, refetch: refetchUsage } = useQuery({
    queryKey: ["studio-usage"],
    queryFn: async () => (await api.get("/api/studio/usage")).data,
    enabled: Boolean(user),
  });

  const current = usage?.tier || "free";
  const limit = usage?.monthlyBlogLimit;
  const used = usage?.monthlyBlogsUsed ?? 0;
  const credits = usage?.studioCredits ?? 0;
  const creditPool = usage?.studioCreditPool ?? PLAN_CREDITS.free;
  const examples = creditExamples(PLAN_CREDITS.creator);

  const payUpgrade = useCallback(
    async (targetTier) => {
      if (!PAID_TIERS.includes(targetTier)) return;
      if (!receiverWallet) {
        toast.error("Payment wallet is not configured on the server.");
        return;
      }
      if (!user?.id) {
        toast.error("Sign in to upgrade.");
        return;
      }
      if (!user?.walletAddress) {
        toast.error("Link your Pera wallet in Profile before paying.");
        return;
      }

      setActiveTier(targetTier);
      setPayError(null);
      setLastTxId(null);
      let submittedTxId = null;

      try {
        setPayStatus("connecting_wallet");
        let from = await reconnectPera();
        if (!from) {
          from = await connectPera();
        }
        const linked = user.walletAddress;
        if (!(await addressesEqual(from, linked))) {
          throw new Error(
            `Payment must be sent from your linked wallet (${linked.slice(0, 6)}…${linked.slice(-4)}). Connect that account in Pera or update your linked wallet in Profile.`
          );
        }

        const amountMicroAlgos = PLAN_PRICES[targetTier];
        const noteStr = upgradeNote(targetTier, user.id);

        setPayStatus("awaiting_signature");
        const { txId } = await signAndSendPayment({
          from,
          to: receiverWallet,
          amountMicroAlgos,
          noteStr,
          algodServer,
          confirmRounds: 4,
        });
        submittedTxId = txId;
        setLastTxId(txId);
        setPayStatus("verifying");
        const { data } = await api.post("/api/studio/subscription/upgrade", {
          txId,
          tier: targetTier,
        });

        setPayStatus("success");
        toast.success(`Upgraded to ${data.tier} plan`);
        await refetchUsage();
        queryClient.invalidateQueries({ queryKey: ["studio-usage"] });
      } catch (e) {
        const msg = e?.response?.data?.error || e?.message || "Upgrade failed";
        setPayError(msg);
        setPayStatus("error");
        if (submittedTxId) setLastTxId(submittedTxId);
        toast.error(msg);
      } finally {
        setActiveTier(null);
      }
    },
    [receiverWallet, user, algodServer, queryClient, refetchUsage]
  );

  const busy = payStatus !== "idle" && payStatus !== "success" && payStatus !== "error";

  return (
    <div className="pt-6 w-full">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-semibold text-primary">Plan &amp; upgrade</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Pay with ALGO on TestNet via Pera Wallet. Your tier is applied after the backend verifies your on-chain payment.
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Current plan: <span className="font-semibold text-slate-800 capitalize">{current}</span>
          {limit != null && <> · {used} of {limit} blogs</>}
          <> · {credits} of {creditPool} Studio Credits</>
        </p>
        {!isAuthenticated && (
          <GuestConnectBanner message="Connect Pera Wallet to view usage and upgrade your Studio plan." className="mt-4" />
        )}
        {isAuthenticated && !user?.walletAddress && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2 mt-3">
            Link your Pera wallet from the profile menu before upgrading.
          </p>
        )}
        {!receiverWallet && !paymentConfigLoading && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2 mt-3">
            Payment wallet is not configured. Set{" "}
            <code className="bg-red-100 px-1 rounded">RECEIVER_WALLET</code> in backend/.env (or on Render) and
            restart the API server.
          </p>
        )}
      </div>

      {(limit != null && used >= limit) && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Blog limit reached on the {current} plan. Upgrade to continue with the Blogging Agent.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {TIERS.map((t) => {
          const isCurrent = t.id === current;
          const isPaid = t.paid && PAID_TIERS.includes(t.id);
          const algoPrice = PLAN_PRICE_ALGO[t.id];
          const isThisPaying = activeTier === t.id && busy;

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              whileHover={{ y: -4 }}
              className={`relative rounded-md border p-5 bg-white flex flex-col min-h-[420px] h-full ${
                isCurrent ? "border-[#031634] ring-1 ring-[#031634]/20" : "border-surface-variant"
              }`}
            >
              {isCurrent && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  Current
                </span>
              )}
              <h2 className="font-semibold text-primary text-lg capitalize">{t.name}</h2>
              {isPaid && (
                <div className="mt-1">
                  <p className="text-lg font-bold font-mono text-[#031634]">{algoPrice} ALGO / month</p>
                  <p className="text-[11px] text-slate-500">
                    ≈ ₹{algoDisplayToInr(algoPrice)}/mo · ≈ ${algoDisplayToUsd(algoPrice)}/mo
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-600 mt-2" title="Weighted credits — heavier runs cost more">
                {t.credits} Studio Credits / month
              </p>
              <ul className="mt-3 space-y-2 text-xs text-on-surface-variant flex-1">
                <li>
                  <span className="font-medium text-slate-700">Blogs:</span> {t.blogs}
                </li>
                <li>
                  <span className="font-medium text-slate-700">Projects:</span> {t.projects}
                </li>
                <li className="flex items-center gap-1">
                  <span className="font-medium text-slate-700">Video (Veo):</span>
                  {t.video ? "Included" : <><span className="material-symbols-outlined text-[14px]">lock</span> Pro+</>}
                </li>
                <li>
                  <span className="font-medium text-slate-700">Publishing:</span> {t.publishing}
                </li>
              </ul>
              {isPaid && (
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={isCurrent || busy || !receiverWallet || !user?.walletAddress}
                    onClick={() => runWithWallet(() => payUpgrade(t.id))}
                    className="w-full py-2.5 rounded-md bg-[#031634] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    {isCurrent ? "Current plan" : isThisPaying ? "Processing…" : `Pay ${algoPrice} ALGO`}
                  </button>
                  {isThisPaying && payStatus !== "idle" && (
                    <p className="text-[11px] text-slate-600 mt-2">{STATUS_LABELS[payStatus]}</p>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {(payStatus === "error" || payStatus === "success") && (
        <div
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${
            payStatus === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {payStatus === "success" && <p>{STATUS_LABELS.success}</p>}
          {payStatus === "error" && payError && <p>{payError}</p>}
          {lastTxId && (
            <p className="mt-2 text-xs">
              Transaction:{" "}
              <a
                href={`${EXPLORER_TX_TESTNET}${lastTxId}`}
                target="_blank"
                rel="noreferrer"
                className="text-secondary underline font-mono break-all"
              >
                {lastTxId}
              </a>
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-500 mb-6">{RATE_NOTE}</p>

      <section className="bg-white border border-surface-variant rounded-md p-6 mb-6">
        <h2 className="font-semibold text-primary text-sm mb-3">Studio Credits</h2>
        <p className="text-sm text-slate-600 mb-4">
          Credits are weighted by run type. Text runs cost less; full video+audio runs cost more.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 text-xs mb-4">
          {Object.entries(CREDIT_WEIGHTS).map(([key, w]) => (
            <div key={key} className="flex justify-between border border-slate-100 rounded px-3 py-2">
              <span className="text-slate-700">{key.replace(/_/g, " ")}</span>
              <span className="font-mono font-semibold">{w} cr</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600">
          <strong>120 credits (Creator)</strong> ≈ {examples.textRuns} text runs OR {examples.imageRuns}{" "}
          image workflows OR {examples.fullRuns} full video runs.
        </p>
        <h3 className="font-semibold text-primary text-sm mt-4 mb-2">Pay-as-you-go overage (ALGO)</h3>
        <ul className="text-xs text-slate-600 space-y-1">
          <li>Text / prompt: {(OVERAGE_PRICES.lite / 1e6).toFixed(1)} ALGO</li>
          <li>Blog overage: {(OVERAGE_PRICES.blog / 1e6).toFixed(1)} ALGO</li>
          <li>Creative / image: {(OVERAGE_PRICES.creative / 1e6).toFixed(1)} ALGO</li>
          <li>Agentic medium: {(OVERAGE_PRICES.agentic_med / 1e6).toFixed(1)} ALGO</li>
          <li>Full video+audio: {(OVERAGE_PRICES.agentic_full / 1e6).toFixed(1)} ALGO</li>
        </ul>
      </section>

      <section className="bg-white border border-surface-variant rounded-md p-6">
        <h2 className="font-semibold text-primary text-sm mb-2">How it works</h2>
        <ol className="text-sm text-on-surface-variant list-decimal list-inside space-y-1">
          <li>Link the same Pera address you will pay from (Profile menu).</li>
          <li>Click Pay X ALGO on Creator, Pro, or Enterprise.</li>
          <li>Sign the payment in Pera; we verify amount, receiver, and note on-chain.</li>
          <li>Your subscription renews for 30 days; Studio Credits and blog quotas reset.</li>
        </ol>
        <Link
          to="/dashboard/home"
          className="inline-block mt-4 text-sm text-secondary hover:underline"
        >
          Back to Marketplace
        </Link>
      </section>
    </div>
  );
}
