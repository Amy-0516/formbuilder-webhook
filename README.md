# 123formbuilder Webhook + Multi-language Translation

A complete webhook receiver for [123 Form Builder](https://www.123formbuilder.com/) that automatically translates form submissions into multiple languages.

## Features

- **Webhook Receiver** - Handles 123formbuilder's HEAD validation and POST form submissions
- **Multi-language Translation** - Auto-translates form fields into 7+ languages (configurable)
- **Web Dashboard** - View submissions, translations, and manage settings
- **REST API** - Programmatic access to all submissions and translations
- **Multiple Translation Providers** - MyMemory (free), Google Free, DeepL, Google Cloud, Azure
- **Parallel Translation** - All fields and languages translated simultaneously for speed
- **Persistent Storage** - Submissions saved to JSON file

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or with custom settings
PORT=8080 TARGET_LANGS=en,zh,ja,ko npx node server.js
```

The server starts on http://localhost:3000

## Configuring in 123formbuilder

1. Log in to [123formbuilder](https://www.123formbuilder.com/) and open your form
2. Go to **Settings** > **Integrations**
3. Search for **WebHook** and click **Connect**
4. Paste your webhook URL: `http://YOUR-SERVER:3000/webhook`
5. Optionally enable **Use Webhook Mapping** to customize field mapping
6. Save and test by submitting the form

> **Note:** 123formbuilder sends an HTTP HEAD request to validate the URL. The server handles this automatically.

## Exposing to the Internet

123formbuilder needs a publicly accessible URL. Choose one:

### Option 1: localtunnel (quickest, for testing)
```bash
npx localtunnel --port 3000
# Returns: https://your-url.loca.lt
```

### Option 2: ngrok
```bash
ngrok http 3000
# Returns: https://xxxx.ngrok.io
```

### Option 3: Deploy to Render (free tier)
1. Push this project to GitHub
2. Create a new Web Service on [Render](https://render.com)
3. Build command: `npm install`
4. Start command: `node server.js`
5. Set environment variables in Render dashboard

### Option 4: Deploy to Railway
1. Push to GitHub
2. Import on [Railway](https://railway.app)
3. Set PORT env var (Railway provides this)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| HEAD | `/webhook` | 123formbuilder URL validation |
| POST | `/webhook` | Receive form submission |
| POST | `/webhook/:formId` | Form-specific webhook |
| GET | `/api/submissions` | List all submissions |
| GET | `/api/submissions/:id` | Get submission with translations |
| DELETE | `/api/submissions/:id` | Delete a submission |
| POST | `/api/submissions/:id/retranslate` | Re-run translation |
| GET | `/api/config` | Get current configuration |
| PUT | `/api/config/languages` | Update target languages |
| POST | `/api/translate` | Translate arbitrary text |
| GET | `/api/webhook-url` | Get webhook URL info |
| GET | `/api/health` | Health check |

## Configuration

All settings via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `TRANSLATION_PROVIDER` | mymemory | Translation service |
| `TARGET_LANGS` | en,zh,ja,ko,es,fr,de | Target language codes |
| `SOURCE_LANG` | Autodetect | Source language |
| `MYMEMORY_EMAIL` | - | MyMemory email for higher quota |
| `DEEPL_API_KEY` | - | DeepL API key |
| `GOOGLE_CLOUD_API_KEY` | - | Google Cloud Translation key |
| `AZURE_TRANSLATOR_KEY` | - | Azure Translator key |
| `AZURE_REGION` | global | Azure region |
| `MAX_SUBMISSIONS` | 1000 | Max stored submissions |

## Supported Languages

English (en), Chinese (zh), Japanese (ja), Korean (ko), Spanish (es), French (fr), German (de), Portuguese (pt), Italian (it), Russian (ru), Arabic (ar), Hindi (hi), Vietnamese (vi), Thai (th), Dutch (nl), Polish (pl), Turkish (tr), Chinese Traditional (zh-TW)

## Translation Providers

| Provider | API Key | Free Tier | Quality |
|----------|---------|-----------|---------|
| MyMemory | No | 5000 words/day | Good |
| Google Free | No | Unlimited | Good |
| DeepL | Yes | 500k chars/month | Excellent |
| Google Cloud | Yes | Paid | Excellent |
| Azure | Yes | 2M chars/month | Excellent |
| Auto | No | - | Tries Google, falls back to MyMemory |

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Storage:** JSON file (no database needed)
- **Translation:** MyMemory / Google Translate / DeepL / Azure
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
