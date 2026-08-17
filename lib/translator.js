"use strict";

/**
 * Multi-language translation module.
 *
 * Supports multiple translation providers:
 * 1. "mymemory"    - MyMemory API (free, no key needed, default)
 * 2. "google-free" - Free Google Translate endpoint (no key, may be blocked in some networks)
 * 3. "deepl"       - DeepL API (requires DEEPL_API_KEY)
 * 4. "google-cloud" - Google Cloud Translation API (requires GOOGLE_CLOUD_API_KEY)
 * 5. "azure"       - Azure Translator (requires AZURE_TRANSLATOR_KEY)
 * 6. "auto"        - Try google-free first, fallback to mymemory
 *
 * The module translates text field values from a form submission
 * into all configured target languages.
 */

const https = require("https");
const http = require("http");
const config = require("./config");

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Make an HTTP/HTTPS GET request and return the response body as a string.
 */
function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      {
        headers: { "User-Agent": DEFAULT_UA, ...(options.headers || {}) },
        timeout: options.timeout || 10000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, body, headers: res.headers })
        );
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
  });
}

function httpPost(url, postData, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === "https:" ? https : http;
    const body = typeof postData === "string" ? postData : JSON.stringify(postData);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": options.contentType || "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": DEFAULT_UA,
        ...(options.headers || {}),
      },
      timeout: options.timeout || 10000,
    };

    const req = client.request(reqOptions, (res) => {
      let respBody = "";
      res.on("data", (chunk) => (respBody += chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode, body: respBody, headers: res.headers })
      );
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.write(body);
    req.end();
  });
}

// ─── Provider: MyMemory ──────────────────────────────────────────

/**
 * Translate text using the MyMemory API (free, no key required).
 * Supports Autodetect for source language.
 * Limit: 5000 words/day for anonymous, 50000 with email.
 */
async function translateMyMemory(text, targetLang, sourceLang) {
  if (!text || !text.trim()) return { translatedText: "", detectedSource: "" };

  const src = sourceLang || "Autodetect";

  // If source language is known and matches target, skip translation
  if (src !== "Autodetect" && src.toLowerCase() === targetLang.toLowerCase()) {
    return { translatedText: text, detectedSource: src };
  }

  const encoded = encodeURIComponent(text);
  let url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${src}|${targetLang}`;
  if (config.myMemoryEmail) {
    url += `&de=${encodeURIComponent(config.myMemoryEmail)}`;
  }

  const resp = await httpGet(url, { timeout: 10000 });
  if (resp.status !== 200) {
    throw new Error(`MyMemory returned ${resp.status}`);
  }

  const data = JSON.parse(resp.body);
  if (parseInt(data.responseStatus, 10) !== 200) {
    const details = data.responseDetails || "Unknown error";
    // If the error is about same languages, return the original text
    if (details.includes("DISTINCT LANGUAGES") || details.includes("SAME LANGUAGE")) {
      return { translatedText: text, detectedSource: src };
    }
    throw new Error(`MyMemory error: ${details}`);
  }

  const translatedText = (data.responseData && data.responseData.translatedText) || "";
  // MyMemory doesn't reliably return detected source, try to extract from matches
  let detectedSource = src;
  if (src === "Autodetect" && data.matches && data.matches[0]) {
    detectedSource = (data.matches[0].source || "").split("-")[0] || "auto";
  }

  return { translatedText, detectedSource: detectedSource.toLowerCase() };
}

// ─── Provider: Google Free ───────────────────────────────────────

/**
 * Translate text using the free Google Translate endpoint.
 * No API key required. Auto-detects source language.
 * May be blocked in some networks.
 */
async function translateGoogleFree(text, targetLang) {
  if (!text || !text.trim()) return { translatedText: "", detectedSource: "" };

  const encoded = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encoded}`;

  const resp = await httpGet(url, { timeout: 8000 });
  if (resp.status !== 200) {
    throw new Error(`Google Translate returned ${resp.status}`);
  }

  const data = JSON.parse(resp.body);
  let translated = "";
  if (Array.isArray(data) && Array.isArray(data[0])) {
    for (const seg of data[0]) {
      if (seg && seg[0]) translated += seg[0];
    }
  }
  const detectedSource = (data[2] || "").toString();

  return { translatedText: translated, detectedSource };
}

// ─── Provider: DeepL ──────────────────────────────────────────────

async function translateDeepL(text, targetLang, apiKey) {
  if (!text || !text.trim()) return { translatedText: "", detectedSource: "" };

  const url = "https://api-free.deepl.com/v2/translate";
  const postData = `auth_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(text)}&target_lang=${targetLang.toUpperCase()}`;

  const resp = await httpPost(url, postData, {
    contentType: "application/x-www-form-urlencoded",
    timeout: 10000,
  });

  if (resp.status !== 200) {
    throw new Error(`DeepL API returned ${resp.status}: ${resp.body}`);
  }

  const data = JSON.parse(resp.body);
  const translation = data.translations && data.translations[0];
  return {
    translatedText: translation ? translation.text : "",
    detectedSource: translation
      ? (translation.detected_source_language || "").toLowerCase()
      : "",
  };
}

// ─── Provider: Google Cloud ───────────────────────────────────────

async function translateGoogleCloud(text, targetLang, apiKey) {
  if (!text || !text.trim()) return { translatedText: "", detectedSource: "" };

  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  const postData = JSON.stringify({ q: text, target: targetLang, format: "text" });

  const resp = await httpPost(url, postData, { timeout: 10000 });
  if (resp.status !== 200) {
    throw new Error(`Google Cloud Translation returned ${resp.status}: ${resp.body}`);
  }

  const data = JSON.parse(resp.body);
  const translation = data.data && data.data.translations && data.data.translations[0];
  return {
    translatedText: translation ? translation.translatedText : "",
    detectedSource: translation ? translation.detectedSourceLanguage : "",
  };
}

// ─── Provider: Azure ──────────────────────────────────────────────

async function translateAzure(text, targetLang, apiKey, region) {
  if (!text || !text.trim()) return { translatedText: "", detectedSource: "" };

  const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLang}`;
  const postData = JSON.stringify([{ Text: text }]);

  const resp = await httpPost(url, postData, {
    contentType: "application/json; charset=UTF-8",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Ocp-Apim-Subscription-Region": region,
    },
    timeout: 10000,
  });

  if (resp.status !== 200) {
    throw new Error(`Azure Translator returned ${resp.status}: ${resp.body}`);
  }

  const data = JSON.parse(resp.body);
  const translation = data[0] && data[0].translations && data[0].translations[0];
  const detectedSource =
    data[0] && data[0].detectedLanguage ? data[0].detectedLanguage.language : "";
  return {
    translatedText: translation ? translation.text : "",
    detectedSource: detectedSource.toLowerCase(),
  };
}

// ─── Provider dispatcher ──────────────────────────────────────────

/**
 * Translate a single text into a single target language using the configured provider.
 */
async function translateSingle(text, targetLang, provider, sourceLang) {
  switch (provider) {
    case "mymemory":
      return await translateMyMemory(text, targetLang, sourceLang);
    case "google-free":
      return await translateGoogleFree(text, targetLang);
    case "deepl":
      return await translateDeepL(text, targetLang, config.deeplApiKey);
    case "google-cloud":
      return await translateGoogleCloud(text, targetLang, config.googleCloudApiKey);
    case "azure":
      return await translateAzure(text, targetLang, config.azureApiKey, config.azureRegion);
    case "auto":
      // Try google-free first, fallback to mymemory
      try {
        return await translateGoogleFree(text, targetLang);
      } catch (googleErr) {
        console.log(`[translator] Google-free failed, falling back to MyMemory: ${googleErr.message}`);
        return await translateMyMemory(text, targetLang, sourceLang);
      }
    default:
      return await translateMyMemory(text, targetLang, sourceLang);
  }
}

// ─── Main Translation Functions ───────────────────────────────────

/**
 * Translate a single text string into all target languages (in parallel).
 */
async function translateText(text, targetLangs) {
  const results = {};
  const provider = config.translationProvider;
  const sourceLang = config.sourceLang || "Autodetect";
  const langs = targetLangs || config.targetLanguages;

  // Translate into all target languages in parallel for speed
  const promises = langs.map(async (lang) => {
    try {
      const result = await translateSingle(text, lang, provider, sourceLang);
      return {
        lang,
        data: {
          text: result.translatedText,
          detectedSource: result.detectedSource,
          success: true,
        },
      };
    } catch (err) {
      console.error(`[translator] Failed to translate to ${lang}:`, err.message);
      return {
        lang,
        data: {
          text: "",
          detectedSource: "",
          success: false,
          error: err.message,
        },
      };
    }
  });

  const settled = await Promise.all(promises);
  for (const { lang, data } of settled) {
    results[lang] = data;
  }

  return results;
}

/**
 * Translate all translatable fields in a parsed submission.
 * Skips metadata fields (prefixed with __) and empty values.
 * Translates all fields and languages in parallel for maximum speed.
 *
 * @param {Object} parsedFields - The parsed form fields
 * @param {string[]} targetLangs - Target language codes
 * @returns {Object} { original, translations, sourceLang, targetLangs, provider, translatedAt }
 */
async function translateSubmission(parsedFields, targetLangs) {
  const langs = targetLangs || config.targetLanguages;
  const translations = {};
  let detectedSourceLang = "";

  // Collect all translatable fields
  const translatableFields = [];
  for (const [fieldKey, fieldValue] of Object.entries(parsedFields)) {
    if (fieldKey.startsWith("__")) continue;
    if (!fieldValue || !fieldValue.trim()) continue;
    if (/^\d+$/.test(fieldValue)) continue;
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(fieldValue)) continue;
    if (/^https?:\/\/.+/.test(fieldValue)) continue;
    translatableFields.push({ key: fieldKey, value: fieldValue });
  }

  console.log(
    `[translator] Translating ${translatableFields.length} fields into ${langs.length} languages (${translatableFields.length * langs.length} requests)`
  );

  // Translate all fields × all languages in parallel
  const allPromises = [];
  for (const { key, value } of translatableFields) {
    for (const lang of langs) {
      allPromises.push(
        translateSingle(value, lang, config.translationProvider, config.sourceLang || "Autodetect")
          .then((result) => ({
            fieldKey: key,
            lang,
            data: {
              text: result.translatedText,
              detectedSource: result.detectedSource,
              success: true,
            },
          }))
          .catch((err) => ({
            fieldKey: key,
            lang,
            data: {
              text: "",
              detectedSource: "",
              success: false,
              error: err.message,
            },
          }))
      );
    }
  }

  const settled = await Promise.all(allPromises);

  // Group results by field
  for (const { fieldKey, lang, data } of settled) {
    if (!translations[fieldKey]) translations[fieldKey] = {};
    translations[fieldKey][lang] = data;

    // Capture detected source language from first successful translation
    if (!detectedSourceLang && data.success && data.detectedSource) {
      detectedSourceLang = data.detectedSource;
    }
  }

  return {
    original: parsedFields,
    translations,
    sourceLang: detectedSourceLang || config.sourceLang || "auto",
    targetLangs: langs,
    provider: config.translationProvider,
    translatedAt: new Date().toISOString(),
  };
}

module.exports = {
  translateText,
  translateSubmission,
  translateSingle,
  translateMyMemory,
  translateGoogleFree,
  translateDeepL,
  translateGoogleCloud,
  translateAzure,
};
