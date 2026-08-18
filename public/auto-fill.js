/**
 * INIU 123formbuilder 翻译自动填充工具 v4
 * 自包含：用 fetch() 加载翻译数据（CORS 已开放），加载顺序确定，不会出现竞态。
 * 启动后立即显示面板，确保用户能看到反馈。
 */
(function () {
  'use strict';

  var BASE = 'https://formbuilder-webhook.onrender.com';
  var TRANSLATIONS_URL = BASE + '/translations.js?v=4';

  var LANG_NAMES = {
    de: '德语 German', it: '意大利语 Italian', es: '西班牙语 Spanish',
    fr: '法语 French', pl: '波兰语 Polish', nl: '荷兰语 Dutch',
    ga: '爱尔兰语 Irish', ja: '日语 Japanese', ar: '阿拉伯语 Arabic',
    pt: '葡萄牙语 Portuguese'
  };

  function log(msg, color) {
    try { console.log('%c[INIU翻译] ' + msg, 'color:' + (color || '#333')); } catch (e) {}
  }

  // ====== 面板 ======
  function showPanel(title, contentHtml, bgColor) {
    removePanel();
    var panel = document.createElement('div');
    panel.id = 'iniu-trans-panel';
    panel.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;padding:18px 22px;'
      + 'border-radius:12px;color:#fff;font-size:14px;'
      + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;'
      + 'box-shadow:0 8px 32px rgba(0,0,0,0.3);max-width:460px;line-height:1.6;'
      + 'background:' + (bgColor || '#2c3e50') + ';';
    panel.innerHTML = '<strong style="font-size:16px;display:block;margin-bottom:8px;">' + title + '</strong>'
      + '<div style="font-size:13px;">' + contentHtml + '</div>'
      + '<button onclick="document.getElementById(\'iniu-trans-panel\').remove()" '
      + 'style="position:absolute;top:8px;right:12px;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;opacity:0.7;line-height:1;">&times;</button>';
    (document.body || document.documentElement).appendChild(panel);
  }

  function removePanel() {
    var p = document.getElementById('iniu-trans-panel');
    if (p) p.parentNode.removeChild(p);
  }

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').replace(/[‘’']/g, "'").replace(/[“”]/g, '"').trim();
  }

  // ====== 扫描所有翻译输入框 ======
  function findAllInputs() {
    var results = [];
    var allInputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea, [contenteditable="true"]');

    for (var i = 0; i < allInputs.length; i++) {
      var inp = allInputs[i];
      if (!document.body.contains(inp)) continue;
      if (inp.readOnly || inp.disabled) continue;
      if (inp.type === 'hidden' || inp.type === 'submit' || inp.type === 'button') continue;
      if (inp.placeholder && /search|suche|buscar|recherche|ricerca|zoek/i.test(inp.placeholder)) continue;

      var original = findOriginalText(inp);
      if (original) {
        results.push({ input: inp, original: original });
      }
    }
    return results;
  }

  function findOriginalText(inp) {
    // 1) 行结构
    var row = inp.closest('tr, .row, [class*="row"], .field-row, .translation-row, li, .form-group, .input-group');
    if (row) {
      var children = row.children;
      for (var c = 0; c < children.length; c++) {
        var child = children[c];
        if (child.querySelectorAll && child.querySelectorAll('input, textarea, select').length > 0) continue;
        var text = (child.textContent || '').trim();
        if (text && text.length > 1) return text;
      }
    }
    // 2) 前面的兄弟
    var prev = inp.previousElementSibling;
    var count = 0;
    while (prev && count < 10) {
      if (prev.tagName !== 'INPUT' && prev.tagName !== 'TEXTAREA' && prev.tagName !== 'SELECT') {
        var t = (prev.textContent || '').trim();
        if (t && t.length > 1 && t.length < 2000) return t;
      }
      prev = prev.previousElementSibling;
      count++;
    }
    // 3) 父元素里的非输入框兄弟
    var parent = inp.parentElement;
    if (parent) {
      var siblings = parent.children;
      for (var s = 0; s < siblings.length; s++) {
        var sib = siblings[s];
        if (sib === inp) continue;
        if (sib.tagName === 'INPUT' || sib.tagName === 'TEXTAREA' || sib.tagName === 'SELECT') continue;
        var st = (sib.textContent || '').trim();
        if (st && st.length > 1 && st.length < 2000) return st;
      }
    }
    // 4) 表格同行第一个 td
    var td = inp.closest('td');
    if (td) {
      var tr = td.closest('tr');
      if (tr) {
        var firstTd = tr.querySelector('td:first-child');
        if (firstTd && firstTd !== td && firstTd.querySelectorAll('input, textarea').length === 0) {
          var ft = (firstTd.textContent || '').trim();
          if (ft && ft.length > 1) return ft;
        }
      }
    }
    // 5) class 包含 default/original/source/label
    var container = inp.closest('div, td, li, .form-group');
    if (container) {
      var labelEl = container.querySelector('[class*="default"], [class*="original"], [class*="source"], [class*="label"]');
      if (labelEl && labelEl !== inp) {
        var lt = (labelEl.textContent || '').trim();
        if (lt && lt.length > 1) return lt;
      }
    }
    // 6) label / aria-label
    if (inp.labels && inp.labels.length > 0) return inp.labels[0].textContent.trim();
    if (inp.getAttribute('aria-label')) return inp.getAttribute('aria-label').trim();
    return null;
  }

  // ====== 填充翻译 ======
  function fillTranslations(langCode, inputItems) {
    var translations = window.__INIU_TRANSLATIONS__ && window.__INIU_TRANSLATIONS__[langCode];
    if (!translations) {
      log('未找到 ' + langCode + ' 的翻译数据', '#e74c3c');
      return { filled: 0, skipped: inputItems.length };
    }

    var filled = 0, skipped = 0;

    for (var i = 0; i < inputItems.length; i++) {
      var original = normalizeText(inputItems[i].original);
      var translation = translations[original];

      if (!translation) {
        for (var key in translations) {
          if (normalizeText(key) === original) { translation = translations[key]; break; }
        }
      }
      if (!translation) {
        for (var k in translations) {
          var nk = normalizeText(k);
          if (original.length > 3 && nk.length > 3 && (original.indexOf(nk) >= 0 || nk.indexOf(original) >= 0)) {
            translation = translations[k]; break;
          }
        }
      }

      if (translation) {
        var inp = inputItems[i].input;
        try {
          if (inp.tagName === 'TEXTAREA' || inp.tagName === 'INPUT') {
            var proto = inp.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
            var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
            setter.call(inp, translation);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (inp.getAttribute('contenteditable') === 'true') {
            inp.textContent = translation;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            inp.value = translation;
          }
          filled++;
        } catch (e) {
          skipped++;
        }
      } else {
        skipped++;
        if (skipped <= 8) log('未匹配: "' + original.substring(0, 60) + '"', '#e67e22');
      }
    }
    return { filled: filled, skipped: skipped };
  }

  // ====== 语言选择器（覆盖层） ======
  function createLanguageSelector() {
    var overlay = document.createElement('div');
    overlay.id = 'iniu-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);'
      + 'z-index:2147483646;display:flex;align-items:center;justify-content:center;';

    var html = '<div style="background:#fff;border-radius:14px;padding:26px;max-width:460px;width:92%;'
      + 'box-shadow:0 10px 40px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#2c3e50;">';
    html += '<h3 style="margin:0 0 6px;font-size:19px;">🌐 选择要填入的语言</h3>';
    html += '<p style="margin:0 0 18px;color:#666;font-size:13px;">请点击你当前正在编辑的语言：</p>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';

    var langs = [
      ['de', '德语 German'], ['it', '意大利语 Italian'], ['es', '西班牙语 Spanish'],
      ['fr', '法语 French'], ['pl', '波兰语 Polish'], ['nl', '荷兰语 Dutch'],
      ['ga', '爱尔兰语 Irish'], ['ja', '日语 Japanese'], ['ar', '阿拉伯语 Arabic'],
      ['pt', '葡萄牙语 Portuguese']
    ];

    for (var l = 0; l < langs.length; l++) {
      html += '<button data-lang="' + langs[l][0] + '" '
        + 'style="padding:11px 14px;background:#3498db;color:#fff;border:none;border-radius:8px;'
        + 'cursor:pointer;font-size:14px;flex:1;min-width:130px;font-weight:500;">' + langs[l][1] + '</button>';
    }

    html += '</div>';
    html += '<button id="iniu-cancel" style="margin-top:18px;padding:9px 16px;background:#eee;'
      + 'border:none;border-radius:8px;cursor:pointer;font-size:14px;width:100%;color:#555;">取消</button>';
    html += '</div>';

    overlay.innerHTML = html;
    (document.body || document.documentElement).appendChild(overlay);

    var buttons = overlay.querySelectorAll('button[data-lang]');
    for (var b = 0; b < buttons.length; b++) {
      (function (btn) {
        btn.onclick = function () {
          overlay.parentNode.removeChild(overlay);
          executeFill(btn.getAttribute('data-lang'));
        };
      })(buttons[b]);
    }
    overlay.querySelector('#iniu-cancel').onclick = function () { overlay.parentNode.removeChild(overlay); };
    overlay.onclick = function (e) { if (e.target === overlay) overlay.parentNode.removeChild(overlay); };
  }

  // ====== 执行填充 ======
  function executeFill(langCode) {
    log('开始填充: ' + langCode, '#2c3e50');
    var inputItems = findAllInputs();
    log('扫描到 ' + inputItems.length + ' 个翻译输入框', '#666');

    if (inputItems.length === 0) {
      showPanel('⚠️ 未找到翻译输入框',
        '请确认：<br>1. 已点击语言的 ✏️ Customize 打开翻译编辑弹窗<br>'
        + '2. 弹窗中的翻译输入框已加载完成<br><br>'
        + '<b>如果弹窗已打开仍无输入框</b>，请按 F12 打开控制台，输入并回车：<br>'
        + '<code style="background:rgba(0,0,0,0.2);padding:2px 6px;border-radius:4px;">document.querySelectorAll("input,textarea").length</code>'
        + '<br>把结果截图发给我。',
        '#e74c3c');
      return;
    }

    var result = fillTranslations(langCode, inputItems);
    var msg = '✅ 已填入 <b>' + result.filled + '</b> 条翻译';
    if (result.skipped > 0) msg += '，<b>' + result.skipped + '</b> 条未匹配';
    msg += '<br><br><b>⚠️ 请务必点击弹窗中的 Save 按钮保存！</b>';
    showPanel('✅ 翻译填充完成', msg, result.filled > 0 ? '#27ae60' : '#e67e22');
  }

  // ====== 启动主流程 ======
  log('工具 v4 启动', '#2c3e50');
  showPanel('⏳ 正在加载翻译数据…', '请稍候，正在从服务器读取翻译对照表。', '#2c3e50');

  function loadDataAndShowSelector() {
    // 如果已有数据（例如页面之前加载过），直接用
    if (window.__INIU_TRANSLATIONS__) {
      showPanel('✅ 翻译数据已就绪', '共 ' + Object.keys(window.__INIU_TRANSLATIONS__).length + ' 种语言。', '#27ae60');
      setTimeout(createLanguageSelector, 150);
      return;
    }

    fetch(TRANSLATIONS_URL + '&_=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        // 安全执行：把 window.__INIU_TRANSLATIONS__ 提取出来
        try {
          (0, eval)(text);
        } catch (e) {
          log('eval 失败: ' + e.message, '#e74c3c');
        }
        if (!window.__INIU_TRANSLATIONS__) throw new Error('数据解析失败');
        showPanel('✅ 翻译数据已就绪', '共 ' + Object.keys(window.__INIU_TRANSLATIONS__).length + ' 种语言。', '#27ae60');
        setTimeout(createLanguageSelector, 150);
      })
      .catch(function (err) {
        log('加载失败: ' + err.message, '#e74c3c');
        showPanel('❌ 数据加载失败',
          '错误：' + err.message + '<br><br>'
          + '可能原因：<br>1. Render 服务器冷启动（等 30 秒后重试）<br>'
          + '2. 网络问题<br><br><b>建议：</b>刷新页面后重新运行脚本。',
          '#e74c3c');
      });
  }

  loadDataAndShowSelector();
})();
