"use strict";

/**
 * Configuration manager for the webhook server.
 * Reads from environment variables with sensible defaults.
 */

const DEFAULT_TARGET_LANGS = ["en", "zh", "ja", "ko", "es", "fr", "de"];

const LANG_NAMES = {
  en: "English",
  zh: "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  vi: "Vietnamese",
  th: "Thai",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
};

function parseLangs(str) {
  if (!str) return DEFAULT_TARGET_LANGS;
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  targetLanguages: parseLangs(process.env.TARGET_LANGS),
  // Translation provider: "mymemory" (default), "google-free", "auto", "deepl", "google-cloud", "azure"
  translationProvider: process.env.TRANSLATION_PROVIDER || "mymemory",
  // Source language for translation (default: Autodetect)
  sourceLang: process.env.SOURCE_LANG || "Autodetect",
  // API keys for paid providers (optional)
  deeplApiKey: process.env.DEEPL_API_KEY || "",
  googleCloudApiKey: process.env.GOOGLE_CLOUD_API_KEY || "",
  azureApiKey: process.env.AZURE_TRANSLATOR_KEY || "",
  azureRegion: process.env.AZURE_REGION || "global",
  // MyMemory email for higher quota (optional)
  myMemoryEmail: process.env.MYMEMORY_EMAIL || "",
  // Webhook secret for signature verification (optional)
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  // Data file path
  dataFile: process.env.DATA_FILE || "./data/submissions.json",
  // Max submissions to keep in memory/file
  maxSubmissions: parseInt(process.env.MAX_SUBMISSIONS, 10) || 1000,
};

config.langNames = LANG_NAMES;

/**
 * Get a human-readable language name.
 */
config.getLangName = function (code) {
  return LANG_NAMES[code] || code;
};

/**
 * Update target languages at runtime.
 */
config.setTargetLanguages = function (langs) {
  if (Array.isArray(langs) && langs.length > 0) {
    config.targetLanguages = langs;
    return true;
  }
  return false;
};

module.exports = config;
