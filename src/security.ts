// lib/security.ts
export const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:5173",
  "https://2025-folio-one.vercel.app",
]);

export function checkOriginAllowed(req: any) {
  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";

  const isAllowedOrigin = ALLOWED_ORIGINS.has(origin);

  const isAllowedReferer = [...ALLOWED_ORIGINS].some((allowed) =>
    referer?.startsWith?.(allowed)
  );

  const host = req.headers.host || "";
  const isLocalNoOrigin =
    !origin && (host.startsWith("localhost") || host.startsWith("127.0.0.1"));

  return isAllowedOrigin || isAllowedReferer || isLocalNoOrigin;
}

// ставимо CORS хедери відповідно до whitelist
export function applyCors(res: any, req: any) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
}
