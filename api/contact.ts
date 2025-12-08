import nodemailer from "nodemailer";

import { applyCors, checkOriginAllowed } from "../src/security";

export default async function handler(req: any, res: any) {
  applyCors(res, req);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!checkOriginAllowed(req)) {
    return res.status(403).json({ error: "forbidden" });
  }

  // фронт може надіслати:
  // 1) {name,email,message}
  // 2) {text:"{...json...}"} (старий фронт)
  // 3) чистий рядок body (якщо щось пішло не так з headers)
  let name: unknown;
  let email: unknown;
  let message: unknown;

  const body = req.body;

  // варіант 1: звичайний об'єкт
  if (body && typeof body === "object") {
    const {
      name: n,
      email: e,
      message: m,
      text,
    } = (body as Record<string, any>) || {};
    name = n;
    email = e;
    message = m;

    // варіант 2: обгорнутий у text
    if ((!name || !email || !message) && typeof text === "string") {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          name = name || parsed.name;
          email = email || parsed.email;
          message = message || parsed.message;
        }
      } catch (_err) {
        // ignore, перевірка нижче впаде на валідації
      }
    }
  }

  // варіант 3: body як рядок JSON
  if ((!name || !email || !message) && typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object") {
        name = name || parsed.name;
        email = email || parsed.email;
        message = message || parsed.message;
      }
    } catch (_err) {
      // ignore
    }
  }

  const nameSafe = typeof name === "string" ? name.trim() : "";
  const emailSafe = typeof email === "string" ? email.trim() : "";
  const messageSafe = typeof message === "string" ? message.trim() : "";

  if (!nameSafe || !emailSafe || !messageSafe) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to = process.env.CONTACT_EMAIL;

    if (!host || !user || !pass || !to) {
      return res.status(500).json({ error: "Mail config missing" });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Portfolio Contact" <${user}>`,
      to,
      subject: "Нове повідомлення з портфоліо",
      text: `Ім'я: ${nameSafe}\nEmail: ${emailSafe}\n\n${messageSafe}`,
    });

    // Telegram - опціонально, не падаємо якщо не працює
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      try {
        const text =
          `✉️ Нове повідомлення з сайту\n` +
          `Ім'я: ${nameSafe}\nEmail: ${emailSafe}\n\n${messageSafe}`;

        // chat_id може бути рядком або числом
        const chatIdNum =
          typeof chatId === "string" && /^-?\d+$/.test(chatId)
            ? chatId.includes("-")
              ? chatId
              : Number(chatId)
            : chatId;

        const tgResp = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatIdNum, text }),
          }
        );

        if (!tgResp.ok) {
          const tgText = await tgResp.text();
          console.error("Telegram send failed", tgResp.status, tgText);
        }
      } catch (tgErr) {
        // Telegram помилка не має падати весь handler
        console.error("Telegram error (non-fatal):", tgErr);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("contact handler failed", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
