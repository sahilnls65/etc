require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const config = require("./config");
const connectDB = require("./db");
const authRoutes = require("./routes/auth");
const punchRoutes = require("./routes/punches");
const { startCron } = require("./services/cron");

const app = express();

// Trust proxy (behind Nginx/PM2)
app.set("trust proxy", 1);

// --- Security ---
app.use(helmet());
app.use(
  cors({
    origin: ["https://employee-time-calculator.netlify.app", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// Rate limit: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again later" },
});

// Stricter rate limit for login: 10 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, try again later" },
});

// --- Routes ---
app.use("/api/auth", loginLimiter, authRoutes);
app.use("/api/punches", apiLimiter, punchRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --- Serve frontend in production (if dist exists) ---
const fs = require("fs");
const distPath = path.join(__dirname, "../dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// --- Start ---
async function start() {
  await connectDB();
  startCron();

  app.listen(config.port, () => {
    console.log(`[Server] Running on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error("[Server] Failed to start:", err.message);
  process.exit(1);
});
