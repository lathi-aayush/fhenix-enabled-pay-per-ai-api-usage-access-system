import { Router } from "express";
import { Transaction } from "../models/Transaction.js";

const router = Router();

// ─── Math helpers ────────────────────────────────────────────────────────────

/**
 * Simple Ordinary Least Squares linear regression.
 * Returns { slope, intercept, r2 } for y = slope*x + intercept
 */
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  points.forEach(({ x, y }) => {
    sumX += x; sumY += y; sumXY += x * y;
    sumX2 += x * x; sumY2 += y * y;
  });

  const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
  const intercept = (sumY - slope * sumX) / n;

  // R² — how well the line fits historical data
  const yMean = sumY / n;
  const ssTot = points.reduce((acc, { y }) => acc + (y - yMean) ** 2, 0);
  const ssRes = points.reduce((acc, { x, y }) => acc + (y - (slope * x + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

/** Weighted moving average — recent periods count more */
function weightedMovingAverage(values, steps) {
  const weights = values.map((_, i) => i + 1); // index 0 = weight 1, last = weight n
  const wSum    = weights.reduce((a, b) => a + b, 0);
  const base    = values.reduce((acc, v, i) => acc + v * weights[i], 0) / wSum;

  // Slight growth factor derived from last-two-period delta
  const last  = values[values.length - 1] ?? base;
  const prev  = values[values.length - 2] ?? last;
  const delta = last - prev;

  return Array.from({ length: steps }, (_, i) =>
    Math.max(0, Math.round(base + delta * (i + 1) * 0.5))
  );
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Groups transactions by calendar month.
 * Returns an array of { label, totalAmount, txCount, startDate } sorted oldest → newest.
 */
async function aggregateByMonth(userWallet, monthsBack = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const match = { createdAt: { $gte: since } };
  if (userWallet) match.userWallet = userWallet;

  const raw = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          year:  { $year:  "$createdAt" },
          month: { $month: "$createdAt" },
        },
        totalAmount: { $sum:   "$amount" },
        txCount:     { $count: {} },
        firstDate:   { $min:   "$createdAt" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun",
                      "Jul","Aug","Sep","Oct","Nov","Dec"];

  return raw.map((doc) => ({
    label:       monthNames[doc._id.month - 1] + " " + doc._id.year,
    totalAmount: doc.totalAmount,
    txCount:     doc.txCount,
    year:        doc._id.year,
    month:       doc._id.month,  // 1-12
  }));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/prediction/usage
 *
 * Query params:
 *   wallet        – filter to a specific userWallet (optional; omit for platform-wide)
 *   historyMonths – how many past months to use as training data (default: 6)
 *   forecastMonths– how many months to predict ahead             (default: 3)
 *   model         – "linear" | "weighted"                        (default: "linear")
 *   algoCostUSD   – cost of 1 ALGO in USD                        (default: 0.15)
 *   usdToInr      – USD→INR conversion rate                      (default: 84)
 */
router.get("/usage", async (req, res) => {
  try {
    const {
      wallet,
      historyMonths  = 6,
      forecastMonths = 3,
      model          = "linear",
      algoCostUSD    = 0.15,
      usdToInr       = 84,
    } = req.query;

    const hMonths = Math.min(Math.max(parseInt(historyMonths), 2), 24);
    const fMonths = Math.min(Math.max(parseInt(forecastMonths), 1), 12);
    const algoUSD = parseFloat(algoCostUSD);
    const inrRate = parseFloat(usdToInr);

    // ── 1. Pull historical data ──────────────────────────────────────────────
    const history = await aggregateByMonth(wallet || null, hMonths);

    if (history.length < 2) {
      return res.status(422).json({
        error: "Not enough transaction history to make a prediction.",
        minimumRequired: 2,
        found: history.length,
      });
    }

    const amounts = history.map((h) => h.totalAmount);

    // ── 2. Run prediction model ──────────────────────────────────────────────
    let predictedAmounts = [];
    let confidence       = 0;

    if (model === "weighted") {
      predictedAmounts = weightedMovingAverage(amounts, fMonths);
      // Confidence heuristic: penalise high variance in history
      const mean     = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / amounts.length;
      const cv       = mean > 0 ? Math.sqrt(variance) / mean : 1;
      confidence     = Math.round(Math.max(50, Math.min(90, (1 - cv) * 100)));
    } else {
      // Default: linear regression
      const points         = amounts.map((y, x) => ({ x, y }));
      const { slope, intercept, r2 } = linearRegression(points);
      predictedAmounts     = Array.from({ length: fMonths }, (_, i) =>
        Math.max(0, Math.round(slope * (amounts.length + i) + intercept))
      );
      confidence           = Math.round(Math.min(95, Math.max(40, r2 * 100)));
    }

    // ── 3. Build forecast month labels ───────────────────────────────────────
    const lastEntry  = history[history.length - 1];
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun",
                        "Jul","Aug","Sep","Oct","Nov","Dec"];

    const forecastPeriods = Array.from({ length: fMonths }, (_, i) => {
      const d = new Date(lastEntry.year, lastEntry.month - 1 + i + 1, 1);
      return {
        label:         monthNames[d.getMonth()] + " " + d.getFullYear(),
        predictedAlgo: predictedAmounts[i],
        predictedUSD:  parseFloat((predictedAmounts[i] * algoUSD).toFixed(4)),
        predictedINR:  parseFloat((predictedAmounts[i] * algoUSD * inrRate).toFixed(2)),
      };
    });

    // ── 4. Wallet top-up recommendation ──────────────────────────────────────
    const next30dAlgo = forecastPeriods[0].predictedAlgo;
    const bufferPct   = 0.15;  // 15% safety buffer
    const topupAlgo   = Math.ceil(next30dAlgo * (1 + bufferPct));
    const topupINR    = parseFloat((topupAlgo * algoUSD * inrRate).toFixed(2));

    // ── 5. Trend summary ─────────────────────────────────────────────────────
    const avgHistory  = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const avgForecast = predictedAmounts.reduce((a, b) => a + b, 0) / predictedAmounts.length;
    const trendPct    = avgHistory > 0
      ? parseFloat((((avgForecast - avgHistory) / avgHistory) * 100).toFixed(1))
      : 0;

    // ── 6. Response ──────────────────────────────────────────────────────────
    res.json({
      model,
      confidence,   // 0-100, how reliable the prediction is
      history: history.map((h) => ({
        label:       h.label,
        totalAlgo:   h.totalAmount,
        txCount:     h.txCount,
        totalINR:    parseFloat((h.totalAmount * algoUSD * inrRate).toFixed(2)),
      })),
      forecast: forecastPeriods,
      recommendation: {
        next30dAlgo,
        topupAlgo,
        topupINR,
        bufferPct: bufferPct * 100,
        message: `Top up ~${topupAlgo} ALGO (₹${topupINR}) to cover the next 30 days with a ${bufferPct * 100}% safety buffer.`,
      },
      summary: {
        avgHistoricalAlgo: parseFloat(avgHistory.toFixed(4)),
        avgForecastAlgo:   parseFloat(avgForecast.toFixed(4)),
        trendDirection:    trendPct > 2 ? "increasing" : trendPct < -2 ? "decreasing" : "stable",
        trendPercent:      trendPct,
      },
    });
  } catch (err) {
    console.error("[prediction/usage]", err);
    res.status(500).json({ error: "Failed to generate prediction.", detail: err.message });
  }
});

/**
 * GET /api/prediction/history
 *
 * Returns raw aggregated monthly history only — useful for charting
 * without triggering the full prediction calculation.
 *
 * Query params:
 *   wallet        – filter to a specific userWallet (optional)
 *   historyMonths – how many past months (default: 12)
 *   algoCostUSD   – cost of 1 ALGO in USD (default: 0.15)
 *   usdToInr      – USD→INR conversion rate (default: 84)
 */
router.get("/history", async (req, res) => {
  try {
    const {
      wallet,
      historyMonths = 12,
      algoCostUSD   = 0.15,
      usdToInr      = 84,
    } = req.query;

    const hMonths = Math.min(Math.max(parseInt(historyMonths), 1), 24);
    const algoUSD = parseFloat(algoCostUSD);
    const inrRate = parseFloat(usdToInr);

    const history = await aggregateByMonth(wallet || null, hMonths);

    const data = history.map((h) => ({
      label:     h.label,
      totalAlgo: h.totalAmount,
      txCount:   h.txCount,
      totalINR:  parseFloat((h.totalAmount * algoUSD * inrRate).toFixed(2)),
    }));

    const totalAlgo = data.reduce((acc, d) => acc + d.totalAlgo, 0);

    res.json({
      periods: data,
      total: {
        algo: parseFloat(totalAlgo.toFixed(4)),
        inr:  parseFloat((totalAlgo * algoUSD * inrRate).toFixed(2)),
        txs:  data.reduce((acc, d) => acc + d.txCount, 0),
      },
    });
  } catch (err) {
    console.error("[prediction/history]", err);
    res.status(500).json({ error: "Failed to fetch history.", detail: err.message });
  }
});

export default router;
