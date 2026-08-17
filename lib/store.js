"use strict";

/**
 * Simple JSON file-based storage for webhook submissions.
 * Keeps the most recent N submissions to prevent unbounded growth.
 */

const fs = require("fs");
const path = require("path");
const config = require("./config");

const DATA_DIR = path.dirname(path.resolve(config.dataFile));
const DATA_FILE = path.resolve(config.dataFile);

// Ensure data directory exists
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  // ignore
}

let submissions = [];
let nextId = 1;

/**
 * Load existing submissions from disk.
 */
function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    submissions = Array.isArray(data.submissions) ? data.submissions : [];
    nextId = data.nextId || submissions.length + 1;
    console.log(`[store] Loaded ${submissions.length} submissions from disk`);
  } catch (e) {
    submissions = [];
    nextId = 1;
  }
}

/**
 * Persist submissions to disk.
 */
function save() {
  try {
    const data = { submissions, nextId };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[store] Failed to save:", e.message);
  }
}

/**
 * Add a new submission.
 * @param {Object} rawPayload - The raw webhook payload from 123formbuilder
 * @returns {Object} The stored submission record
 */
function addSubmission(rawPayload) {
  const record = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    rawPayload,
    parsedFields: extractFields(rawPayload),
    translations: null, // will be populated by translator
    translationStatus: "pending", // pending | translating | done | error
    translationError: null,
  };

  submissions.unshift(record);

  // Trim old records
  if (submissions.length > config.maxSubmissions) {
    submissions = submissions.slice(0, config.maxSubmissions);
  }

  save();
  return record;
}

/**
 * Extract individual fields from a 123formbuilder webhook payload.
 * The payload format varies; we try to normalize it.
 */
function extractFields(payload) {
  const fields = {};

  if (!payload || typeof payload !== "object") {
    return fields;
  }

  // 123formbuilder sends data in various formats:
  // 1. Flat key-value: { field_name: value, ... }
  // 2. Nested with form_data: { form_data: { field: value } }
  // 3. Array of field objects: [{ name, value }, ...]

  if (Array.isArray(payload)) {
    // Format 3: array of { name/label, value }
    for (const item of payload) {
      if (item && typeof item === "object") {
        const key = item.name || item.label || item.field || item.key || "field";
        const val = item.value !== undefined ? item.value : "";
        fields[String(key)] = String(val);
      }
    }
    return fields;
  }

  // If there's a nested data container, use it
  let dataSource = payload;
  if (payload.form_data && typeof payload.form_data === "object") {
    dataSource = payload.form_data;
  } else if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    dataSource = payload.data;
  } else if (payload.fields && typeof payload.fields === "object") {
    dataSource = payload.fields;
  }

  // Flatten the data source
  for (const [key, val] of Object.entries(dataSource)) {
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      fields[key] = String(val);
    } else if (val !== null && typeof val === "object" && val.value !== undefined) {
      fields[key] = String(val.value);
    } else if (val !== null && typeof val === "object" && val.label !== undefined) {
      fields[key] = String(val.label);
    }
  }

  // Also capture metadata
  if (payload.form_id) fields.__form_id = String(payload.form_id);
  if (payload.submission_id) fields.__submission_id = String(payload.submission_id);
  if (payload.form_name) fields.__form_name = String(payload.form_name);

  return fields;
}

/**
 * Update a submission's translations.
 */
function updateTranslation(id, translations, status, error) {
  const record = submissions.find((s) => s.id === id);
  if (!record) return null;

  record.translations = translations;
  record.translationStatus = status;
  record.translationError = error || null;
  save();
  return record;
}

/**
 * Get a single submission by ID.
 */
function getById(id) {
  return submissions.find((s) => s.id === parseInt(id, 10)) || null;
}

/**
 * Get all submissions (most recent first).
 */
function getAll(limit) {
  const lim = limit || submissions.length;
  return submissions.slice(0, lim);
}

/**
 * Delete a submission by ID.
 */
function removeById(id) {
  const idx = submissions.findIndex((s) => s.id === parseInt(id, 10));
  if (idx === -1) return false;
  submissions.splice(idx, 1);
  save();
  return true;
}

/**
 * Clear all submissions.
 */
function clearAll() {
  submissions = [];
  nextId = 1;
  save();
}

// Load on startup
load();

module.exports = {
  addSubmission,
  updateTranslation,
  getById,
  getAll,
  removeById,
  clearAll,
};
