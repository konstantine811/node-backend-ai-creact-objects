import express from "express";
import { buildPrompt } from "../config/prompt-create-objects";
import { toObjectsForFrontend } from "../utils/handle-pattern-json-objects";

const router = express.Router();

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

router.post("/", async (req, res) => {
  try {
    const userText: string = req.body?.text ?? "";
    console.log(">>> USER TEXT:", userText);

    const rawKey = process.env.ANTHROPIC_API_KEY || "";
    const apiKey = rawKey.trim();
    if (!apiKey || !/^[\x00-\x7F]+$/.test(apiKey)) {
      console.error("❌ invalid key");
      return res.status(200).json({ objects: [] });
    }

    const prompt = buildPrompt(userText);
    console.log(">>> PROMPT:\n", prompt);

    const claudeResponse = await fetch(CLAUDE_API_URL, {
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

    console.log(">>> CLAUDE STATUS:", claudeResponse.status);

    const claudeJson: any = await claudeResponse.json();
    console.log(">>> RAW CLAUDE JSON:", claudeJson);

    const assistantText = claudeJson?.content?.[0]?.text ?? "";
    console.log(">>> ASSISTANT TEXT:", assistantText);

    let parsed: any;
    try {
      parsed = JSON.parse(assistantText);
    } catch (err) {
      console.error("❌ JSON.parse fail. assistantText was:", assistantText);
      return res.status(200).json({ objects: [] });
    }

    console.log(">>> PARSED JSON:", parsed);

    const objectsForFront = toObjectsForFrontend(parsed);
    console.log(">>> OBJECTS FOR FRONT:", objectsForFront);

    return res.status(200).json({ objects: objectsForFront });
  } catch (err) {
    console.error("server crash in /api/scene-parse", err);
    return res.status(200).json({ objects: [] });
  }
});

export default router;
