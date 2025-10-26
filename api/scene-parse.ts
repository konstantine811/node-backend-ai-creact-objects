// ↑ я зараз поясню цей файл нижче
// і dotenv НЕ треба тут у Vercel середовищі, Vercel сам закидає env у process.env

import { buildPrompt } from "../src/config/prompt-create-objects";
import { applyCors, checkOriginAllowed } from "../src/security";
import { toObjectsForFrontend } from "../src/utils/handle-pattern-json-objects";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

export default async function handler(req: any, res: any) {
  // 1. CORS headers for every request
  applyCors(res, req);

  // 2. Handle preflight OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 3. Only allow POST (твій бек каже POST)
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 4. Origin/runtime check
  if (!checkOriginAllowed(req)) {
    return res.status(403).json({ error: "forbidden" });
  }

  try {
    const userText: string = req.body?.text ?? "";

    const apiKeyRaw = process.env.ANTHROPIC_API_KEY || "";
    const apiKey = apiKeyRaw.trim();
    if (!apiKey || !/^[\x00-\x7F]+$/.test(apiKey)) {
      console.error("❌ invalid key");
      return res.status(200).json({ objects: [] });
    }

    const prompt = buildPrompt(userText);

    const claudeResp = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!claudeResp.ok) {
      console.error(
        "Claude API error",
        claudeResp.status,
        await claudeResp.text()
      );
      return res.status(200).json({ objects: [] });
    }

    const claudeJson: any = await claudeResp.json();
    const assistantText = claudeJson?.content?.[0]?.text ?? "";

    let parsed: any;
    try {
      parsed = JSON.parse(assistantText);
    } catch (err) {
      console.error("❌ JSON.parse fail. assistantText was:", assistantText);
      return res.status(200).json({ objects: [] });
    }

    const objectsForFront = toObjectsForFrontend(parsed);
    return res.status(200).json({ objects: objectsForFront });
  } catch (err) {
    console.error("server crash in /api/scene-parse", err);
    return res.status(200).json({ objects: [] });
  }
}
