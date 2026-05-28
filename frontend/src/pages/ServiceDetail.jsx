import React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getPublicApiBase } from "../utils/apiBase.js";
import UserLiveWalletBar, { shortenWallet } from "../components/UserLiveWalletBar.jsx";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import {
  addressesEqual,
  connectPera,
  normalizeAccountAddress,
  reconnectPera,
  signAndSendPayment,
} from "../wallet/pera.js";
import { chargeForTokens, wordsToApproxTokens } from "../utils/tokenPricing.js";
import { useTokenEstimate } from "../hooks/useTokenEstimate.js";
import { getBurnerWallet } from "../wallet/burner.js";

const EXPLORER_TX = "https://testnet.algoexplorer.io/tx/";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ServiceDetail() {
  const { id } = useParams();
  const { user, logout, burnerReady } = useAuth();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [algodServer, setAlgodServer] = useState("https://testnet-api.algonode.cloud");
  const [prompt, setPrompt] = useState("");
  const [invokeBusy, setInvokeBusy] = useState(false);
  const [costAck, setCostAck] = useState(false);
  /** @type {null | 'quoting' | 'sign' | 'confirming_chain' | 'release' | 'done' | 'error'} */
  const [payStage, setPayStage] = useState(null);
  const [payError, setPayError] = useState(null);
  const [lastTxId, setLastTxId] = useState(null);
  const [aiPreview, setAiPreview] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [quotedCharge, setQuotedCharge] = useState(null);

  const apiBase = getPublicApiBase();

  const ppt = Number(service?.pricePerThousandTokens);
  const minC = Number(service?.minimumChargeAlgo);

  const promptWordCount = useMemo(() => {
    const w = prompt.trim().split(/\s+/).filter(Boolean).length;
    return w;
  }, [prompt]);

  const localInputTokenEstimate = useMemo(() => wordsToApproxTokens(promptWordCount), [promptWordCount]);

  const localEstimateAlgo = useMemo(() => {
    if (!service || !Number.isFinite(ppt) || !Number.isFinite(minC)) return null;
    if (localInputTokenEstimate <= 0) return null;
    return chargeForTokens(localInputTokenEstimate, ppt, minC);
  }, [service, ppt, minC, localInputTokenEstimate]);

  const { estimatedAlgo, minApplies } = useTokenEstimate(prompt, ppt, minC);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: svc }, { data: net }] = await Promise.all([
          api.get(`/api/services/${id}`),
          api.get("/api/public/network").catch(() => ({})),
        ]);
        if (!cancelled) {
          setService(svc);
          if (net?.algodServer) setAlgodServer(net.algodServer);
        }
      } catch {
        toast.error("Service not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function generateKey() {
    if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
      toast.error("Invalid service");
      return;
    }
    setGenerating(true);
    try {
      const { data } = await api.post("/api/access/generate", { serviceId: id });
      if (data?.key) {
        setApiKey(data.key);
        setShowKeyModal(true);
        toast.success("Proxy key ready");
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || "Could not generate key");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyKey() {
    if (!apiKey) return;
    navigator.clipboard
      .writeText(apiKey)
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Copy failed"));
  }

  function handleCopySnippet() {
    if (!apiKey) return;
    const snippet = `# 1) Quote (no txId) — returns paymentRef + chargeAlgo
curl -sS "${apiBase}/api/use" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"Hello"}'

# 2) Pay that exact ALGO to developerWallet with paymentRef in note, then complete:
curl -sS "${apiBase}/api/use" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"txId":"<YOUR_TX_ID>","paymentRef":"<UUID_FROM_QUOTE>"}'`;
    navigator.clipboard.writeText(snippet).then(() => toast.success("cURL copied"));
  }

  async function runPaidInvoke() {
    if (!apiKey || !service || !prompt.trim()) {
      toast.error("Enter a prompt and ensure you have a proxy key");
      return;
    }
    if (!costAck) {
      toast.error("Confirm you understand pricing to continue");
      return;
    }
    const sessionWallet = normalizeAccountAddress(user?.walletAddress);
    if (!sessionWallet) {
      toast.error("Session missing wallet");
      return;
    }
    const to = normalizeAccountAddress(service.creatorWallet);
    if (!to) {
      toast.error("Invalid developer wallet on this service");
      return;
    }

    setInvokeBusy(true);
    setPayError(null);
    setAiPreview(null);
    setLastTxId(null);
    setLastReceipt(null);
    setQuotedCharge(null);
    setPayStage("quoting");

    try {
      const { data: quote } = await api.post(
        "/api/use",
        { prompt: prompt.trim() },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      if (!quote?.awaitingPayment || !quote.paymentRef) {
        throw new Error("Unexpected quote response from server");
      }

      const micro = Number(quote.expectedMicroAlgos);
      const charge = Number(quote.chargeAlgo);
      if (!Number.isFinite(micro) || micro <= 0) {
        throw new Error("Invalid charge from server");
      }

      setQuotedCharge(charge);
      setPayStage("sign");

      if (!burnerReady) {
        throw new Error("Burner wallet is still loading. Wait a moment and try again.");
      }
      const burnerWallet = getBurnerWallet();
      const algosdk = (await import("algosdk")).default;
      const algod = new algosdk.Algodv2("", algodServer.trim(), "");
      let burnerBalanceInfo;
      try {
        burnerBalanceInfo = await algod.accountInformation(burnerWallet.addr).do();
      } catch (e) {
        throw new Error("Burner wallet has zero balance. Please click 'Manage' > 'Fund' in the top bar.");
      }

      const params = await algod.getTransactionParams().do();
      const txFee = Number(params.fee) || 1000;
      
      if (Number(burnerBalanceInfo.amount) < micro + txFee) {
        throw new Error(`Burner wallet does not have enough funds for this request. Required: ${(micro + txFee) / 1000000} ALGO. Please click 'Manage' > 'Fund' in the top bar.`);
      }

      const note = new TextEncoder().encode(quote.paymentRef);
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: burnerWallet.addr,
        receiver: to,
        amount: Math.round(micro),
        note,
        suggestedParams: params,
      });

      const signedTxn = txn.signTxn(burnerWallet.sk);
      const submitted = await algod.sendRawTransaction(signedTxn).do();
      const txId = submitted?.txid ?? submitted?.txId;
      if (!txId) {
        throw new Error("Network did not return a transaction id after submit.");
      }
      await algosdk.waitForConfirmation(algod, txId, 4);

      setLastTxId(txId);
      setPayStage("confirming_chain");
      await sleep(3000);

      setPayStage("release");
      const { data: final } = await api.post(
        "/api/use",
        { txId, paymentRef: quote.paymentRef },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      const receipt = final?.sentinelReceipt;
      const { sentinelReceipt: _sr, ...aiShape } = final || {};
      const text =
        aiShape?.choices?.[0]?.message?.content ??
        aiShape?.message?.content ??
        JSON.stringify(aiShape);
      setAiPreview(typeof text === "string" ? text : String(text));
      setLastReceipt(receipt || null);
      setPayStage("done");
      toast.success("AI response ready");
    } catch (e) {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || e?.message || "Request failed";
      setPayError(msg);
      setPayStage("error");
      toast.error(typeof msg === "string" ? msg : "Request failed");
    } finally {
      setInvokeBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-6 bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant animate-pulse">Loading service…</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen pt-24 px-6 bg-surface flex flex-col items-center justify-center gap-4">
        <p className="text-on-surface-variant">Service not found.</p>
        <Link to="/dashboard/browse" className="text-sm text-secondary hover:underline">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  const canProxy = service.providerConfigured === true;
  const devShort = shortenWallet(service.creatorWallet);

  return (
    <div className="font-body text-on-surface max-w-3xl mx-auto">
      <div className="flex justify-end items-center gap-4 mb-4">
        <Link to="/dashboard/browse" className="text-sm text-secondary hover:underline shrink-0">
          ← Marketplace
        </Link>
        {user?.walletAddress && <UserLiveWalletBar walletAddress={user.walletAddress} />}
        <ProfileDropdown />
      </div>

      <div className="pb-12">
        <h1 className="font-headline text-3xl font-semibold text-primary">{service.title}</h1>
        <p className="mt-4 text-on-surface-variant leading-relaxed">{service.description}</p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="px-3 py-1 rounded-md bg-white border border-surface-variant">
            Provider: <strong>{service.aiProvider ?? "—"}</strong>
          </span>
          <span className="px-3 py-1 rounded-md bg-white border border-surface-variant font-mono text-xs">
            {service.modelName || "—"}
          </span>
          <span className="px-3 py-1 rounded-md bg-white border border-surface-variant">
            Calls: <strong>{service.totalUses ?? 0}</strong>
          </span>
        </div>

        <div className="mt-8 p-6 bg-white border border-surface-variant rounded-md editorial-shadow space-y-6">
          <div>
            <p className="text-sm text-on-surface-variant">Pay per token (input + output), with a minimum per call</p>
            <p className="font-mono text-lg font-semibold text-secondary mt-1">
              {Number.isFinite(ppt) ? ppt.toFixed(6) : "—"} ALGO / 1k tokens
            </p>
            <p className="text-xs text-on-surface-variant mt-1 font-mono">
              Min per paid call: {Number.isFinite(minC) ? `${minC.toFixed(6)} ALGO` : "—"} · Paid to {devShort}
            </p>
          </div>

          {!canProxy && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              This listing is not wired to a live model yet. Ask the creator to republish with a provider key.
            </p>
          )}

          <div className="border-t border-surface-variant pt-6">
            <p className="text-sm text-on-surface-variant mb-3">
              Generate a <code className="font-mono text-xs">sk-sentinel-…</code> key. Each call: Sentinel runs the model
              first, returns the exact ALGO charge, you pay on-chain, then Sentinel releases the answer.
            </p>
            <button
              type="button"
              disabled={generating || !canProxy}
              onClick={generateKey}
              className="w-full sm:w-auto bg-primary text-white px-8 py-3 rounded-md font-medium hover:opacity-90 disabled:opacity-50"
            >
              {generating ? "Working…" : "Get proxy API key"}
            </button>
          </div>

          {apiKey && canProxy && (
            <div className="border-t border-surface-variant pt-6 space-y-4">
              <h2 className="font-semibold text-primary">Try a call (TestNet)</h2>
              <label className="block text-sm text-on-surface-variant">Prompt</label>
              <textarea
                className="w-full border border-outline-variant rounded-md px-3 py-2 text-sm min-h-[100px]"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask something…"
              />
              {Number.isFinite(ppt) && Number.isFinite(minC) && (
                <p className="text-xs text-on-surface-variant mt-2">
                  Estimated cost{" "}
                  <span className="font-mono font-semibold text-secondary">{estimatedAlgo.toFixed(6)} ALGO</span>
                  {minApplies && (
                    <span className="block mt-1 text-amber-800">
                      Minimum charge applies (your estimate is below the per-call floor).
                    </span>
                  )}
                </p>
              )}
              {localEstimateAlgo != null && promptWordCount > 0 && (
                <p className="text-xs text-on-surface-variant bg-surface-container-low/50 border border-outline-variant/50 rounded-md px-3 py-2 mt-2">
                  Rough pre-flight: ~{localInputTokenEstimate} tokens from your prompt (~{promptWordCount} words × 4/3) → at
                  least <span className="font-mono text-secondary font-semibold">{localEstimateAlgo.toFixed(6)} ALGO</span>{" "}
                  (min floor; final bill includes the assistant reply).
                </p>
              )}
              <label className="flex items-start gap-2 text-sm text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={costAck}
                  onChange={(e) => setCostAck(e.target.checked)}
                />
                <span>
                  I understand the final charge is based on actual tokens used (prompt + response) and may differ from the
                  estimate above.
                </span>
              </label>
              <button
                type="button"
                disabled={invokeBusy || !prompt.trim() || !costAck}
                onClick={runPaidInvoke}
                className="bg-secondary text-on-secondary px-6 py-2.5 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {invokeBusy ? "Working…" : "Run AI, then pay exact ALGO"}
              </button>
            </div>
          )}
        </div>

        {aiPreview && payStage === "done" && lastTxId && (
          <div className="mt-8 p-6 bg-white border border-surface-variant rounded-md space-y-3">
            <h3 className="font-semibold text-primary">Receipt</h3>
            {lastReceipt && (
              <ul className="text-sm text-on-surface-variant space-y-1 font-mono">
                <li>
                  Paid{" "}
                  <span className="font-semibold text-secondary">
                    {Number(lastReceipt.chargeAlgo).toFixed(6)} ALGO
                  </span>
                </li>
                <li>
                  Tokens: {lastReceipt.promptTokens} in + {lastReceipt.completionTokens} out ={" "}
                  {lastReceipt.totalTokens} total
                </li>
                <li>Rate snapshot: {Number(lastReceipt.pricePerThousandTokens).toFixed(6)} ALGO / 1k tokens</li>
              </ul>
            )}
            <p className="text-sm">
              To <span className="font-mono">{devShort}</span>
            </p>
            <a
              href={`${EXPLORER_TX}${lastTxId}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-secondary underline font-mono break-all"
            >
              View transaction on AlgoExplorer
            </a>
            <div className="border-t border-surface-variant pt-4 mt-4">
              <p className="text-xs text-on-surface-variant uppercase mb-2">AI response</p>
              <pre className="text-sm whitespace-pre-wrap bg-surface-container-low p-4 rounded-md border border-outline-variant max-h-80 overflow-y-auto">
                {aiPreview}
              </pre>
            </div>
          </div>
        )}
      </div>

      {(payStage === "quoting" ||
        payStage === "sign" ||
        payStage === "confirming_chain" ||
        payStage === "release") && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white max-w-md w-full rounded-lg border border-surface-variant p-8 shadow-xl">
            <h3 className="font-headline text-lg font-semibold text-primary mb-6">Pay per token</h3>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3 items-start">
                <span className="material-symbols-outlined text-secondary shrink-0">
                  {payStage === "quoting" ? "progress_activity" : "check_circle"}
                </span>
                <div>
                  <p className="font-medium">Run AI &amp; get quote</p>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    Sentinel counts tokens from the provider response to set your exact charge.
                  </p>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <span className="material-symbols-outlined text-secondary shrink-0">
                  {payStage === "sign"
                    ? "progress_activity"
                    : payStage === "quoting"
                      ? "radio_button_unchecked"
                      : "check_circle"}
                </span>
                <div>
                  <p className="font-medium">Pay in Pera Wallet</p>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    {quotedCharge != null
                      ? `Approve ${quotedCharge.toFixed(6)} ALGO to ${devShort}`
                      : "Exact ALGO shown after quote"}
                  </p>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <span className="material-symbols-outlined text-secondary shrink-0">
                  {payStage === "confirming_chain" ? "progress_activity" : "radio_button_unchecked"}
                </span>
                <div>
                  <p className="font-medium">Confirming on Algorand</p>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    Payment broadcast—please do not close this window.
                  </p>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <span className="material-symbols-outlined text-secondary shrink-0">
                  {payStage === "release" ? "progress_activity" : "radio_button_unchecked"}
                </span>
                <div>
                  <p className="font-medium">Release response</p>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    Verifying your payment and returning the cached AI output.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      )}

      {showKeyModal && apiKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-md border border-surface-variant p-8 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-headline text-xl font-semibold text-primary">Your proxy key</h2>
            <p className="text-sm text-on-surface-variant mt-2">
              Call <code className="font-mono text-xs">POST /api/use</code> without <code className="font-mono text-xs">txId</code>{" "}
              to run the model and receive <code className="font-mono text-xs">paymentRef</code> + exact{" "}
              <code className="font-mono text-xs">chargeAlgo</code>. Pay that amount with <code className="font-mono text-xs">paymentRef</code>{" "}
              in the note, then POST again with <code className="font-mono text-xs">txId</code> +{" "}
              <code className="font-mono text-xs">paymentRef</code> to unlock the response.
            </p>
            <div className="mt-4 p-4 bg-surface-container rounded-md font-mono text-xs break-all border border-outline-variant select-all">
              {apiKey}
            </div>
            <p className="text-xs text-on-surface-variant mt-4">Endpoint</p>
            <div className="mt-1 p-3 bg-surface-container rounded-md font-mono text-[11px] break-all border border-outline-variant">
              {apiBase}/api/use
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopyKey}
                className="bg-secondary text-on-secondary px-4 py-2 rounded-md text-sm"
              >
                Copy key
              </button>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="border border-outline-variant px-4 py-2 rounded-md text-sm"
              >
                Copy cURL
              </button>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-sm text-on-surface-variant underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {payStage === "error" && payError && (
        <div className="fixed bottom-6 left-6 right-6 max-w-lg mx-auto z-50 bg-red-50 border border-red-200 text-red-900 text-sm px-4 py-3 rounded-md shadow-lg">
          {payError}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => {
              setPayStage(null);
              setPayError(null);
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
