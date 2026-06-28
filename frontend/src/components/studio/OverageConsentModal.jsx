import React, { useState } from "react";
import { Link } from "react-router-dom";
import { RUN_TYPE_LABELS } from "../../constants/studioPlans.js";
import { buildX402PaymentHeader, resolveOveragePayTo } from "../../api/studioOverage.js";
import { connectMetaMask } from "../../wallet/metamask.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function OverageConsentModal({ open, overage, onCancel, onSuccess }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!open || !overage) return null;

  const label = overage.runTypeLabel || RUN_TYPE_LABELS[overage.runType] || overage.runType;
  const amountAlgo = overage.amountAlgo ?? overage.amountMicroAlgos / 1_000_000;

  const handleApprove = async () => {
    setBusy(true);
    setError(null);
    try {
      const payTo = await resolveOveragePayTo();
      if (!payTo) throw new Error("Payment wallet is not configured on the server.");
      const from = user?.walletAddress || (await connectMetaMask());
      if (!from) throw new Error("Link Pera wallet in Profile first.");

      const xPayment = await buildX402PaymentHeader({
        from,
        to: payTo,
        amountMicroAlgos: overage.amountMicroAlgos,
        algodServer,
      });
      await onSuccess(xPayment);
    } catch (e) {
      setError(e?.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Confirm Studio Run</h2>
        <p className="text-sm text-slate-600">
          Sentinel AI Studio operates on a pay-per-call model. This run requires an on-chain ALGO payment.
        </p>
        <div className="rounded-md bg-slate-50 border border-slate-200 p-4 space-y-1">
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="text-2xl font-bold text-[#031634] font-mono">{amountAlgo} ALGO</p>
          <p className="text-xs text-slate-500">
            ≈ ₹{weiToInr(overage.amountMicroAlgos)} · ≈ ${weiToUsd(overage.amountMicroAlgos)}
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleApprove}
            className="flex-1 py-2.5 rounded-md bg-[#031634] text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Signing…" : `Pay ${amountAlgo} ALGO`}
          </button>
        </div>
      </div>
    </div>
  );
}

let overageResolver = null;

export function requestOverageConsent(overage) {
  return new Promise((resolve) => {
    overageResolver = { overage, resolve };
    window.dispatchEvent(new CustomEvent("studioOverageRequired", { detail: overage }));
  });
}

export function resolveOverageConsent(xPayment) {
  overageResolver?.resolve(xPayment);
  overageResolver = null;
}

export function cancelOverageConsent() {
  overageResolver?.resolve(null);
  overageResolver = null;
}

export function StudioOverageProvider({ children, algodServer }) {
  const [state, setState] = useState({ open: false, overage: null });

  React.useEffect(() => {
    const handler = (e) => {
      setState({ open: true, overage: e.detail });
    };
    window.addEventListener("studioOverageRequired", handler);
    return () => window.removeEventListener("studioOverageRequired", handler);
  }, []);

  return (
    <>
      {children}
      <OverageConsentModal
        open={state.open}
        overage={state.overage}
        algodServer={algodServer}
        onCancel={() => {
          cancelOverageConsent();
          setState({ open: false, overage: null });
        }}
        onSuccess={async (xPayment) => {
          resolveOverageConsent(xPayment);
          setState({ open: false, overage: null });
        }}
      />
    </>
  );
}
