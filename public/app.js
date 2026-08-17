"use strict";

/**
 * Dashboard frontend logic.
 * Handles tab switching, loading submissions, displaying translations,
 * language configuration, and translation testing.
 */

const API_BASE = "/api";

// ─── State ───────────────────────────────────────────────
let currentConfig = null;
let allLanguages = [];
let selectedSubmissionId = null;
let refreshTimer = null;

// ─── Init ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  loadConfig();
  loadWebhookUrl();
  loadSubmissions();
  loadHealth();

  // Auto-refresh submissions every 10 seconds
  refreshTimer = setInterval(() => {
    loadSubmissions(true);
    loadHealth();
  }, 10000);
});

// ─── Tabs ─────────────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

// ─── API helpers ──────────────────────────────────────────
async function apiGet(path) {
  const resp = await fetch(`${API_BASE}${path}`);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

async function apiPost(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

async function apiPut(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

async function apiDelete(path) {
  const resp = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

// ─── Health ────────────────────────────────────────────────
async function loadHealth() {
  try {
    const data = await apiGet("/health");
    document.getElementById("health-status").textContent = "\u25cf Online";
    document.getElementById("health-status").className = "status-badge status-ok";
    document.getElementById("submission-count").textContent = `${data.submissionCount} submissions`;
  } catch {
    document.getElementById("health-status").textContent = "\u25cf Offline";
    document.getElementById("health-status").className = "status-badge";
  }
}

// ─── Webhook URL ──────────────────────────────────────────
async function loadWebhookUrl() {
  try {
    const data = await apiGet("/webhook-url");
    document.getElementById("webhook-url").value = data.webhookUrl;
    document.getElementById("form-webhook-url").value = data.formSpecificUrl;
  } catch (e) {
    console.error("Failed to load webhook URL:", e);
  }
}

// ─── Config ───────────────────────────────────────────────
async function loadConfig() {
  try {
    const data = await apiGet("/config");
    currentConfig = data;
    allLanguages = data.availableLanguages;

    // Overview tab
    document.getElementById("config-provider").textContent = data.translationProvider;
    document.getElementById("stat-langs").textContent = data.targetLanguages.length;

    const langChips = document.getElementById("config-langs");
    langChips.innerHTML = "";
    data.targetLanguages.forEach((lang) => {
      const chip = document.createElement("span");
      chip.className = "lang-chip";
      chip.textContent = `${lang.code} - ${lang.name}`;
      langChips.appendChild(chip);
    });

    // Config tab
    document.getElementById("current-provider").textContent = data.translationProvider;
    renderLangCheckboxes(data);
  } catch (e) {
    console.error("Failed to load config:", e);
  }
}

function renderLangCheckboxes(data) {
  const container = document.getElementById("lang-checkboxes");
  container.innerHTML = "";
  const selectedCodes = data.targetLanguages.map((l) => l.code);

  allLanguages.forEach((lang) => {
    const label = document.createElement("label");
    label.className = "lang-checkbox";
    if (selectedCodes.includes(lang.code)) label.classList.add("checked");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = lang.code;
    checkbox.checked = selectedCodes.includes(lang.code);
    checkbox.addEventListener("change", () => {
      label.classList.toggle("checked", checkbox.checked);
    });

    label.appendChild(checkbox);
    label.append(` ${lang.name} `);

    const code = document.createElement("span");
    code.className = "lang-code";
    code.textContent = `(${lang.code})`;
    label.appendChild(code);

    container.appendChild(label);
  });
}

async function saveLanguages() {
  const checkboxes = document.querySelectorAll("#lang-checkboxes input:checked");
  const langs = Array.from(checkboxes).map((cb) => cb.value);
  if (langs.length === 0) {
    alert("Please select at least one language");
    return;
  }
  try {
    await apiPut("/config/languages", { languages: langs });
    await loadConfig();
    alert("Languages saved successfully");
  } catch (e) {
    alert("Failed to save: " + e.message);
  }
}

// ─── Submissions ──────────────────────────────────────────
async function loadSubmissions(silent) {
  try {
    const data = await apiGet("/submissions?limit=50");
    document.getElementById("stat-total").textContent = data.total;

    const list = document.getElementById("submission-list");
    if (data.submissions.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">\u{1F4ED}</span>
          <p>No submissions yet</p>
          <p class="empty-hint">Submit a form in 123formbuilder to see data here</p>
        </div>`;
      return;
    }

    let translatedCount = 0;
    list.innerHTML = "";
    data.submissions.forEach((s) => {
      if (s.translationStatus === "done") translatedCount++;
      const item = document.createElement("div");
      item.className = "submission-item";
      if (s.id === selectedSubmissionId) item.classList.add("active");
      item.onclick = () => selectSubmission(s.id);

      const fieldPreview = Object.entries(s.fields || {})
        .filter(([k]) => !k.startsWith("__"))
        .slice(0, 2)
        .map(([k, v]) => v)
        .join(", ");

      const statusBadge = getStatusBadge(s.translationStatus);

      item.innerHTML = `
        <div class="submission-item-header">
          <span class="submission-item-id">#${s.id}</span>
          <span class="submission-item-time">${formatTime(s.timestamp)}</span>
        </div>
        <div class="submission-item-fields">${escapeHtml(fieldPreview) || "No fields"}</div>
        <div class="submission-item-status">${statusBadge}</div>
      `;
      list.appendChild(item);
    });

    document.getElementById("stat-translated").textContent = translatedCount;

    // If a submission is selected, refresh its detail
    if (selectedSubmissionId) {
      loadSubmissionDetail(selectedSubmissionId, silent);
    }
  } catch (e) {
    console.error("Failed to load submissions:", e);
  }
}

function getStatusBadge(status) {
  switch (status) {
    case "done":
      return '<span class="badge badge-green">Translated</span>';
    case "translating":
      return '<span class="badge badge-orange">Translating...</span>';
    case "error":
      return '<span class="badge badge-red">Error</span>';
    default:
      return '<span class="badge">Pending</span>';
  }
}

async function selectSubmission(id) {
  selectedSubmissionId = id;
  // Update active state in list
  document.querySelectorAll(".submission-item").forEach((el) => el.classList.remove("active"));
  loadSubmissionDetail(id);
}

async function loadSubmissionDetail(id, silent) {
  try {
    const data = await apiGet(`/submissions/${id}`);
    const panel = document.getElementById("submission-detail");

    // Build original fields section
    const originalFields = Object.entries(data.parsedFields || {})
      .filter(([k]) => !k.startsWith("__"))
      .map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`)
      .join("");

    // Build translations section
    let translationsHtml = "";
    if (data.translationStatus === "translating") {
      translationsHtml = `<div class="translation-loading"><span class="spinner"></span> Translating...</div>`;
    } else if (data.translationStatus === "error") {
      translationsHtml = `<div class="translation-error">Error: ${escapeHtml(data.translationError || "Unknown")}</div>`;
    } else if (data.translations && data.translations.translations) {
      translationsHtml = Object.entries(data.translations.translations)
        .map(([field, langResults]) => {
          const langsHtml = Object.entries(langResults)
            .map(([lang, result]) => {
              const langName = currentConfig
                ? (currentConfig.availableLanguages.find((l) => l.code === lang) || {}).name || lang
                : lang;
              if (result.success === false) {
                return `<div class="translation-lang-item">
                  <div class="translation-lang-label">${lang} - ${escapeHtml(langName)}</div>
                  <div class="translation-error">Error: ${escapeHtml(result.error || "")}</div>
                </div>`;
              }
              return `<div class="translation-lang-item">
                <div class="translation-lang-label">${lang} - ${escapeHtml(langName)}</div>
                <div class="translation-lang-text">${escapeHtml(result.text || "")}</div>
              </div>`;
            })
            .join("");
          return `<div class="translation-field">
            <div class="translation-field-label">${escapeHtml(field)}</div>
            <div class="translation-original">${escapeHtml(data.parsedFields[field] || "")}</div>
            <div class="translation-langs">${langsHtml}</div>
          </div>`;
        })
        .join("");
    } else {
      translationsHtml = '<div class="empty-state"><p>Translation pending...</p></div>';
    }

    // Build metadata
    const metaParts = [];
    if (data.translations && data.translations.sourceLang) {
      metaParts.push(`Source: ${data.translations.sourceLang}`);
    }
    if (data.translations && data.translations.provider) {
      metaParts.push(`Provider: ${data.translations.provider}`);
    }
    if (data.translations && data.translations.translatedAt) {
      metaParts.push(`Translated: ${formatTime(data.translations.translatedAt)}`);
    }

    panel.innerHTML = `
      <div class="detail-header">
        <h3>Submission #${data.id}</h3>
        <div class="detail-meta">
          <span>Received: ${formatTime(data.timestamp)}</span>
          ${metaParts.map((m) => `<span>${escapeHtml(m)}</span>`).join("")}
        </div>
      </div>
      <div class="detail-section">
        <h4>Original Fields</h4>
        <table class="field-table">
          <thead><tr><th>Field</th><th>Value</th></tr></thead>
          <tbody>${originalFields || '<tr><td colspan="2">No fields</td></tr>'}</tbody>
        </table>
      </div>
      <div class="detail-section">
        <h4>Translations ${getStatusBadge(data.translationStatus)}</h4>
        <div class="translation-fields">${translationsHtml}</div>
      </div>
      <div style="padding: 8px 0;">
        <button class="btn btn-sm" onclick="retranslate(${data.id})">Re-translate</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSubmission(${data.id})">Delete</button>
      </div>
    `;
  } catch (e) {
    console.error("Failed to load submission detail:", e);
    document.getElementById("submission-detail").innerHTML = `<div class="empty-state"><p>Error loading submission: ${escapeHtml(e.message)}</p></div>`;
  }
}

async function retranslate(id) {
  try {
    await apiPost(`/submissions/${id}/retranslate`, {});
    alert("Translation re-triggered");
    loadSubmissionDetail(id);
    setTimeout(() => loadSubmissions(true), 2000);
  } catch (e) {
    alert("Failed: " + e.message);
  }
}

async function deleteSubmission(id) {
  if (!confirm(`Delete submission #${id}?`)) return;
  try {
    await apiDelete(`/submissions/${id}`);
    selectedSubmissionId = null;
    document.getElementById("submission-detail").innerHTML = '<div class="empty-state"><p>Submission deleted</p></div>';
    loadSubmissions(true);
  } catch (e) {
    alert("Failed: " + e.message);
  }
}

async function clearAll() {
  if (!confirm("Delete ALL submissions? This cannot be undone.")) return;
  try {
    await apiDelete("/submissions");
    selectedSubmissionId = null;
    document.getElementById("submission-detail").innerHTML = '<div class="empty-state"><p>All submissions cleared</p></div>';
    loadSubmissions(true);
  } catch (e) {
    alert("Failed: " + e.message);
  }
}

// ─── Translation Tester ───────────────────────────────────
async function testTranslation() {
  const text = document.getElementById("test-text").value.trim();
  if (!text) {
    alert("Please enter text to translate");
    return;
  }
  const resultDiv = document.getElementById("test-result");
  resultDiv.innerHTML = '<div class="translation-loading"><span class="spinner"></span> Translating...</div>';
  try {
    const data = await apiPost("/translate", { text });
    let html = "";
    for (const [lang, result] of Object.entries(data.translations)) {
      const langName = currentConfig
        ? (currentConfig.availableLanguages.find((l) => l.code === lang) || {}).name || lang
        : lang;
      if (result.success === false) {
        html += `<div class="test-result-item">
          <div class="test-result-lang">${lang} - ${escapeHtml(langName)}</div>
          <div class="translation-error">Error: ${escapeHtml(result.error || "")}</div>
        </div>`;
      } else {
        html += `<div class="test-result-item">
          <div class="test-result-lang">${lang} - ${escapeHtml(langName)}</div>
          <div class="test-result-text">${escapeHtml(result.text || "")}</div>
        </div>`;
      }
    }
    resultDiv.innerHTML = html;
  } catch (e) {
    resultDiv.innerHTML = `<div class="translation-error">Error: ${escapeHtml(e.message)}</div>`;
  }
}

// ─── Utilities ─────────────────────────────────────────────
function copyToClip(elementId) {
  const input = document.getElementById(elementId);
  input.select();
  input.setSelectionRange(0, 99999);
  try {
    navigator.clipboard.writeText(input.value);
    const btn = input.nextElementSibling;
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = orig), 1500);
  } catch {
    document.execCommand("copy");
  }
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
