// api/health.ts

import { applyCors, checkOriginAllowed } from "../security";

export default async function handler(req: any, res: any) {
  applyCors(res, req);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!checkOriginAllowed(req)) {
    return res.status(403).json({ error: "forbidden" });
  }

  return res.status(200).json({ ok: true });
}
