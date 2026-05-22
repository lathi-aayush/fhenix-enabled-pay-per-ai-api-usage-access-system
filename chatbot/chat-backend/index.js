import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import chatRoutes from "./routes.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === "production";

// ── CORS ─────────────────────────────────────────────────────────────────────
// In production the frontend is served from the same origin so CORS only needs
// to allow the main Sentinel marketplace backend to call this service.
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,          // main marketplace (set in Render)
  process.env.RENDER_EXTERNAL_URL,      // this service's own Render URL
  "http://localhost:5173",
  "http://localhost:5555",
  "http://localhost:4000",
].filter(Boolean);

app.use(
  cors({
    origin: isProd
      ? (origin, cb) => {
          // Same-origin requests (no Origin header) are always ok
          if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
          cb(new Error(`CORS: ${origin} not allowed`));
        }
      : "*",
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan(isProd ? "combined" : "dev"));

// ── MongoDB ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://debjitdebnath2978_db_user:ykniFvrZfRWw4FcC@cluster0.tict9x2.mongodb.net/";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to Chat MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api", chatRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Sentinal Chat API" });
});

// ── Static Frontend (production only) ────────────────────────────────────────
if (isProd) {
  const dist = path.join(__dirname, "..", "chat-front", "dist");
  app.use(express.static(dist, { index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path.join(dist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal server error",
    detail: isProd ? undefined : err?.message,
  });
});

app.listen(PORT, () => {
  console.log(`Chat Backend running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});

