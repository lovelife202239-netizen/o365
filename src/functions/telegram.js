/**
 * Shared Telegram dispatch helper for AzureAiTMFunction.
 * Reads TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID from env.
 * Falls back to Teams webhook (TEAMS_WEBHOOK_URI) if Telegram is not configured.
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function toPlainText(message) {
  // The callers build messages with HTML-ish tags (<br>, <b>). Telegram's
  // HTML parse mode rejects <br> with 400 (unsupported tag), which silently
  // killed every dispatch. Convert to plain text: no parse_mode, nothing to break.
  return String(message)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?b>/gi, "")
    .replace(/<\/?pre>/gi, "");
}

async function sendTelegram(message, context) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    context?.log?.("Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing)");
    return false;
  }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: toPlainText(message),
        disable_web_page_preview: true,
      }),
    });
    if (resp.ok) {
      context?.log?.("successfully dispatched to Telegram");
      return true;
    }
    const errBody = await resp.text();
    context?.log?.(`Telegram send failed: ${resp.status} ${errBody}`);
    return false;
  } catch (error) {
    context?.log?.(`Telegram send error: ${error.message}`);
    return false;
  }
}

module.exports = { sendTelegram };
