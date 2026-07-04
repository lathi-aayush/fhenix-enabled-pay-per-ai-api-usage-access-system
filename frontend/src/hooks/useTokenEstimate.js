import { useMemo } from "react";

/**
 * Live ETH estimate: (chars/4) * 1.5 est. tokens, * pricePerThousand/1000, floored at minimumChargeEth.
 */
export function useTokenEstimate(text, pricePerThousandTokens, minimumChargeEth) {
  return useMemo(() => {
    const chars = (text ?? "").length;
    const estTokens = (chars / 4) * 1.5;
    const ppt = Number(pricePerThousandTokens);
    const minC = Number(minimumChargeEth);
    let raw = Number.isFinite(ppt) ? (estTokens / 1000) * ppt : 0;
    let minApplies = false;
    if (Number.isFinite(minC) && minC > 0 && raw < minC) {
      raw = minC;
      minApplies = true;
    }
    const estimatedEth = Math.round(raw * 1e6) / 1e6;
    return { estimatedEth, minApplies, estTokensRounded: Math.round(estTokens) };
  }, [text, pricePerThousandTokens, minimumChargeEth]);
}
