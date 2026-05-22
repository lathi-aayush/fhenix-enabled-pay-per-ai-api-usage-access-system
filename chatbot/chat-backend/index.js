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

// Fix Cross-Origin-Opener-Policy for Firebase Auth popups
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none')
  next()
})

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.ALLOWED_ORIGIN,
  'http://localhost:5555',
  'http://localhost:5173',
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  credentials: true,
}))

app.use(express.json());
app.use(morgan(isProd ? "combined" : "dev"));

// ── MongoDB ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://debjitdebnath2978_db_user:ykniFvrZfRWw4FcC@cluster0.tict9x2.mongodb.net/";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to Chat MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api", chatRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Sentinal Chat API" });
});

// ── Static Frontend ─────────────────────────────────────────────────────────
const distPath = path.join(__dirname, '../chat-front/dist')
app.use(express.static(distPath))

// SPA catch-all — serve index.html for all non-API routes
// This fixes 404 on /login, /dashboard, /settings etc.
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next()
  }
  const indexPath = path.join(__dirname, '../chat-front/dist', 'index.html')
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Failed to serve index.html:', err)
      res.status(500).json({ error: 'Could not load app' })
    }
  })
})

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

