// src/index.ts
import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import sceneParseRouter from "../api/scene-parse";
dotenv.config(); // читає .env

const app = express();

const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:5173",
  "https://2025-folio-one.vercel.app",
]);

// CORS guard (браузерний рівень)
function corsGuard(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin || "";

  if (ALLOWED_ORIGINS.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  }

  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "POST,GET,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
}

// runtime захист під /api/scene-parse
function originEnforce(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";

  const isAllowedOrigin = ALLOWED_ORIGINS.has(origin);

  const isAllowedReferer = [...ALLOWED_ORIGINS].some((allowed) =>
    referer?.startsWith?.(allowed)
  );

  const isLocalNoOrigin =
    !origin &&
    (req.hostname === "localhost" ||
      req.hostname === "127.0.0.1" ||
      req.ip === "127.0.0.1" ||
      req.ip === "::1");

  if (isAllowedOrigin || isAllowedReferer || isLocalNoOrigin) {
    return next();
  }

  console.warn("❌ blocked request", {
    ip: req.ip,
    host: req.hostname,
    origin,
    referer,
    path: req.path,
  });

  return res.status(403).json({ error: "forbidden" });
}

// 1. JSON парсер
app.use(express.json());

// 2. CORS
app.use(corsGuard);

// 3. основний API-роут
app.use("/api/scene-parse", originEnforce, sceneParseRouter);

// 4. healthcheck/debug
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`scene-parser server listening on http://localhost:${PORT}`);
});
