"use strict";

/**
 * 123formbuilder Webhook Receiver Server
 *
 * Features:
 * - Handles HTTP HEAD requests (123formbuilder URL validation)
 * - Receives POST form submission data
 * - Auto-translates translatable fields into multiple languages
 * - Serves a web dashboard for viewing submissions and translations
 * - REST API for programmatic access
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const config = require("./lib/config");
const store = require("./lib/store");
const translator = require("./lib/translator");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// Serve static dashboard files
app.use(express.static(path.join(__dirname, "public")));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Webhook Endpoints ────────────────────────────────────────────

/**
 * HEAD /webhook
 * 123formbuilder sends an HTTP HEAD request to validate the webhook URL.
 * We just need to respond with 200 OK.
 */
app.head("/webhook", (req, res) => {
  console.log("[webhook] HEAD validation request received");
  res.status(200).end();
});

/**
 * Also support HEAD on /webhook/ and /webhook/:formId
 */
app.head("/webhook/", (req, res) => res.status(200).end());
app.head("/webhook/:formId", (req, res) => {
  console.log(`[webhook] HEAD validation for form ${req.params.formId}`);
  res.status(200).end();
});

/**
 * GET /webhook
 * Some systems also validate with GET. Return 200.
 */
app.get("/webhook", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "123formbuilder webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /webhook
 * Main webhook receiver. 123formbuilder sends form submission data here.
 * The payload can be JSON, form-encoded, or raw data.
 */
app.post("/webhook", async (req, res) => {
  console.log("[webhook] POST received");
  console.log("[webhook] Content-Type:", req.get("Content-Type"));
  console.log("[webhook] Body type:", typeof req.body);

  // Always respond 200 immediately to acknowledge receipt
  // (123formbuilder may retry if it doesn't get a 200)
  res.status(200).json({ status: "received", message: "Submission accepted" });

  // Process the submission asynchronously
  try {
    let payload = req.body;

    // Parse raw body if needed
    if (typeof payload === "string" || Buffer.isBuffer(payload)) {
      const rawStr = Buffer.isBuffer(payload) ? payload.toString("utf-8") : payload;
      // Try JSON first
      try {
        payload = JSON.parse(rawStr);
      } catch {
        // Try URL-encoded
        try {
          const params = new URLSearchParams(rawStr);
          payload = {};
          for (const [k, v] of params.entries()) {
            payload[k] = v;
          }
        } catch {
          // Store as raw text
          payload = { _raw: rawStr };
        }
      }
    }

    // If body is empty, check query params (some webhook configs send data in query string)
    if (!payload || (typeof payload === "object" && Object.keys(payload).length === 0)) {
      payload = { ...req.query };
    }

    console.log("[webhook] Parsed payload keys:", Object.keys(payload || {}));

    // Store the submission
    const record = store.addSubmission(payload);
    console.log(`[webhook] Stored submission #${record.id}`);

    // Trigger translation asynchronously
    processTranslation(record.id);
  } catch (err) {
    console.error("[webhook] Error processing submission:", err);
  }
});

/**
 * POST /webhook/:formId
 * Form-specific webhook endpoint (optional, for routing by form ID).
 */
app.post("/webhook/:formId", async (req, res) => {
  const formId = req.params.formId;
  console.log(`[webhook] POST received for form ${formId}`);

  res.status(200).json({ status: "received", formId, message: "Submission accepted" });

  try {
    let payload = req.body;
    if (typeof payload === "string" || Buffer.isBuffer(payload)) {
      const rawStr = Buffer.isBuffer(payload) ? payload.toString("utf-8") : payload;
      try {
        payload = JSON.parse(rawStr);
      } catch {
        try {
          const params = new URLSearchParams(rawStr);
          payload = {};
          for (const [k, v] of params.entries()) {
            payload[k] = v;
          }
        } catch {
          payload = { _raw: rawStr };
        }
      }
    }

    if (!payload || (typeof payload === "object" && Object.keys(payload).length === 0)) {
      payload = { ...req.query };
    }

    payload.__form_id = formId;

    const record = store.addSubmission(payload);
    console.log(`[webhook] Stored submission #${record.id} for form ${formId}`);
    processTranslation(record.id);
  } catch (err) {
    console.error("[webhook] Error processing submission:", err);
  }
});

// ─── Translation Processing ───────────────────────────────────────

/**
 * Process translation for a stored submission.
 * Runs asynchronously; updates the record when done.
 */
async function processTranslation(id) {
  const record = store.getById(id);
  if (!record) return;

  store.updateTranslation(id, null, "translating", null);
  console.log(`[translation] Started for submission #${id}`);

  try {
    const result = await translator.translateSubmission(
      record.parsedFields,
      config.targetLanguages
    );

    store.updateTranslation(id, result, "done", null);
    console.log(
      `[translation] Completed for submission #${id} - ${Object.keys(result.translations).length} fields translated`
    );
  } catch (err) {
    store.updateTranslation(id, null, "error", err.message);
    console.error(`[translation] Failed for submission #${id}:`, err.message);
  }
}

// ─── REST API ─────────────────────────────────────────────────────

/**
 * GET /api/submissions
 * List all submissions (most recent first).
 */
app.get("/api/submissions", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const submissions = store.getAll(limit).map((s) => ({
    id: s.id,
    timestamp: s.timestamp,
    fieldCount: Object.keys(s.parsedFields).length,
    translationStatus: s.translationStatus,
    sourceLang: s.translations ? s.translations.sourceLang : null,
    fields: s.parsedFields,
  }));
  res.json({ submissions, total: submissions.length });
});

/**
 * GET /api/submissions/:id
 * Get a single submission with full translation data.
 */
app.get("/api/submissions/:id", (req, res) => {
  const record = store.getById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: "Submission not found" });
  }
  res.json(record);
});

/**
 * DELETE /api/submissions/:id
 * Delete a submission.
 */
app.delete("/api/submissions/:id", (req, res) => {
  const ok = store.removeById(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Submission not found" });
  }
  res.json({ status: "ok", message: "Submission deleted" });
});

/**
 * DELETE /api/submissions
 * Clear all submissions.
 */
app.delete("/api/submissions", (req, res) => {
  store.clearAll();
  res.json({ status: "ok", message: "All submissions cleared" });
});

/**
 * POST /api/submissions/:id/retranslate
 * Re-run translation for a specific submission.
 */
app.post("/api/submissions/:id/retranslate", async (req, res) => {
  const record = store.getById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: "Submission not found" });
  }
  processTranslation(record.id);
  res.json({ status: "ok", message: "Translation re-triggered" });
});

/**
 * GET /api/config
 * Get current configuration (languages, provider, etc.).
 */
app.get("/api/config", (req, res) => {
  res.json({
    targetLanguages: config.targetLanguages.map((code) => ({
      code,
      name: config.getLangName(code),
    })),
    translationProvider: config.translationProvider,
    availableLanguages: Object.entries(config.langNames).map(([code, name]) => ({
      code,
      name,
    })),
  });
});

/**
 * PUT /api/config/languages
 * Update target languages at runtime.
 */
app.put("/api/config/languages", (req, res) => {
  const { languages } = req.body;
  if (!Array.isArray(languages) || languages.length === 0) {
    return res.status(400).json({ error: "languages must be a non-empty array" });
  }
  config.setTargetLanguages(languages);
  res.json({
    status: "ok",
    targetLanguages: config.targetLanguages.map((code) => ({
      code,
      name: config.getLangName(code),
    })),
  });
});

/**
 * POST /api/translate
 * Manual translation endpoint - translate arbitrary text.
 */
app.post("/api/translate", async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }
  try {
    const langs = targetLang ? [targetLang] : config.targetLanguages;
    const result = await translator.translateText(text, langs);
    res.json({ original: text, translations: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/webhook-url
 * Returns the webhook URL information for configuration in 123formbuilder.
 */
app.get("/api/webhook-url", (req, res) => {
  // Construct the webhook URL based on the request
  const protocol = req.protocol;
  const host = req.get("host");
  const baseUrl = `${protocol}://${host}`;

  res.json({
    webhookUrl: `${baseUrl}/webhook`,
    formSpecificUrl: `${baseUrl}/webhook/{formId}`,
    dashboardUrl: baseUrl,
    instructions: {
      step1: "Log in to your 123formbuilder account",
      step2: "Open your form and go to Settings > Integrations",
      step3: "Find 'WebHook' and click Connect",
      step4: `Paste this URL in the Script URL field: ${baseUrl}/webhook`,
      step5: "Optionally enable 'Use Webhook Mapping' and customize field mapping",
      step6: "Save and test by submitting the form",
    },
  });
});

/**
 * GET /api/health
 * Health check endpoint.
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    submissionCount: store.getAll().length,
  });
});

// ─── Fallback & Error Handling ────────────────────────────────────

// Catch-all for undefined routes (but not static files)
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/webhook")) {
    return res.sendFile(path.join(__dirname, "public", "index.html"));
  }
  next();
});

app.use((err, req, res, next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// ─── Start Server ─────────────────────────────────────────────────

const PORT = config.port;

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     123formbuilder Webhook + Translation Server           ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║  Dashboard:    http://localhost:${PORT}                       ║`);
  console.log(`║  Webhook URL:  http://localhost:${PORT}/webhook                ║`);
  console.log(`║  API base:     http://localhost:${PORT}/api                   ║`);
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log(`║  Translation:  ${config.translationProvider}`);
  console.log(`║  Target langs: ${config.targetLanguages.join(", ")}${" ".repeat(Math.max(0, 20 - config.targetLanguages.join(", ").length))}║`);
  console.log(`║  Provider:     ${config.translationProvider}${" ".repeat(Math.max(0, 29 - config.translationProvider.length))}║`);
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Configure this URL in 123formbuilder:");
  console.log(`  -> http://localhost:${PORT}/webhook`);
  console.log("");
  console.log("For public access, use a tunnel (ngrok / localtunnel / cloudflare):");
  console.log(`  npx localtunnel --port ${PORT}`);
  console.log("");
});
