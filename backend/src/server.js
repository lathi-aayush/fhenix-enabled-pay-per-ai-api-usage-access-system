// Trigger reload to restart backend - port 5000
import "./loadEnv.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import "express-async-errors";
import cors from "cors";
import helmet from "helmet";
import { connectDb } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import servicesRoutes from "./routes/services.js";
import paymentRoutes from "./routes/payment.js";
import accessRoutes from "./routes/access.js";
import creatorRoutes from "./routes/creator.js";
import useRoutes from "./routes/use.js";
import predictionRoutes from "./routes/prediction.js";
import userRoutes from "./routes/user.js";
import contractRoutes from "./routes/contract.js";
import walletRoutes from "./routes/wallet.js";
import profileRoutes from "./routes/profile.js";
import devRoutes from "./routes/dev.js";
import studioRoutes from "./routes/studio.routes.js";
import x402Routes from "./routes/x402.js";
import reviewsRoutes from "./routes/reviews.js";
import proxyRoutes from "./routes/proxy.js";
import gatewayRoutes from "./routes/gateway.js";
import { initRedisAvailability } from "./queues/publishingQueue.js";
import { startPublishingWorker } from "./workers/publishingWorker.js";
import { startGatewayWorker } from "./workers/gatewayWorker.js";
import { startGatewayScheduler } from "./services/gatewayScheduler.js";
import { startScheduledPublishScheduler } from "./services/scheduledPublishScheduler.js";
import { loadClipCraftConfig } from "./studio/clipcraft/config/loadConfig.js";
import { getClipCraftRuntime } from "./studio/clipcraft/production/ClipCraftRuntime.js";
import { registerClipCraftGracefulShutdown } from "./studio/clipcraft/production/gracefulShutdown.js";
import { buildCorsOrigins, isCorsOriginAllowed } from "./config/corsOrigins.js";
import { getPublicReceiverWallet } from "./config/paymentConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const allowedOrigins = buildCorsOrigins();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Firebase Google Sign-In popup requires unsafe-none or false so the
  // popup can call window.opener to deliver the OAuth token back to the app.
  // Helmet's default "same-origin" silently blocks this and causes COOP errors.
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
}));
app.use(
  cors({
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked origin: ${origin}`));
      }
    },
    credentials: true,
    exposedHeaders: ["Payment-Required", "X-Payment-Response"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Payment",
      "x-payment",
      "X-Payment-Response",
    ],
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/public/network", (_req, res) => {
  res.json({
    algodServer:
      process.env.ALGOD_SERVER ||
      process.env.ALGORAND_NODE ||
      "https://testnet-api.algonode.cloud",
    network: process.env.ALGO_NETWORK?.trim() || "testnet",
    receiverWallet: getPublicReceiverWallet(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/creator", creatorRoutes);
app.use("/api/use", useRoutes);
app.use("/api/prediction", predictionRoutes);
app.use("/api/user", userRoutes);
app.use("/api/contract", contractRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/dev", devRoutes);
app.use("/api/studio", studioRoutes);
app.use("/api/x402", x402Routes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/gateway", gatewayRoutes);
app.use("/proxy/:slug", proxyRoutes);

app.get("/x402-test", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "frontend", "x402-test.html"));
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const pipelineOutputDir = path.join(__dirname, "..", "outputs", "pipeline");
app.use("/outputs/pipeline", express.static(pipelineOutputDir));
const workflowOutputDir = path.join(__dirname, "..", "outputs", "workflow");
app.use("/outputs/workflow", express.static(workflowOutputDir));

if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "..", "..", "frontend", "dist");
  const indexHtml = path.join(dist, "index.html");

  if (!fs.existsSync(indexHtml)) {
    console.warn(
      "[server] frontend/dist/index.html missing — running API-only. " +
        "On Render, set buildCommand to `npm run build` from the repo root (not backend/)."
    );
    app.get("/", (_req, res) => {
      res.status(200).json({
        ok: true,
        message: "Sentinel API. Frontend bundle not built on this service.",
        health: "/api/health",
      });
    });
  } else {
    /** Hashed Vite assets — long cache; missing files must not fall through to SPA HTML. */
    const isStaticAsset = (p) =>
      /\.(js|mjs|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot)$/i.test(p);

    app.use(
      express.static(dist, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.replace(/\\/g, "/").endsWith("/index.html")) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      })
    );

    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      if (isStaticAsset(req.path)) {
        return res.status(404).type("text/plain").send("Asset not found");
      }
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(indexHtml, (err) => {
        if (err) {
          if (err.code === "ENOENT") {
            return res.status(503).json({ error: "Frontend bundle unavailable" });
          }
          return next(err);
        }
      });
    });
  }
}

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.name === "CastError") {
    return res.status(400).json({ error: "Invalid id" });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({
    error: "Internal server error",
    detail: process.env.NODE_ENV === "development" ? err?.message : undefined,
  });
});

const port = Number(process.env.PORT) || 5000;

connectDb()
  .then(async () => {
    await initRedisAvailability();
    try {
      startPublishingWorker();
    } catch (e) {
      console.warn("[publishingWorker] failed to start:", e.message);
    }
    try {
      startGatewayWorker();
    } catch (e) {
      console.warn("[gatewayWorker] failed to start:", e.message);
    }
    try {
      startGatewayScheduler();
    } catch (e) {
      console.warn("[gatewayScheduler] failed to start:", e.message);
    }
    try {
      startScheduledPublishScheduler();
    } catch (e) {
      console.warn("[scheduler] failed to start:", e.message);
    }
    let clipcraftRuntime = null;
    try {
      const cc = loadClipCraftConfig();
      if (cc.enabled) {
        clipcraftRuntime = getClipCraftRuntime();
        clipcraftRuntime.start();
        console.log("[clipcraft] runtime started (provider:", cc.providerMode + ")");
      }
    } catch (e) {
      console.warn("[clipcraft] runtime skip:", e.message);
    }

    const server = app.listen(port, () => {
      console.log(`API listening on ${port}`);
    });

    registerClipCraftGracefulShutdown(server, clipcraftRuntime, {
      timeoutMs: Number(process.env.CLIPCRAFT_SHUTDOWN_TIMEOUT_MS) || 30_000,
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `Port ${port} is already in use. Close the other app using it or set PORT in backend/.env (e.g. PORT=5001) and match your Vite proxy target.`
        );
      } else {
        console.error(err);
      }
      process.exit(1);
    });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

// Trigger nodemon reload for PORT change
