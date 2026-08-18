/**
 * 123formbuilder Translation Auto-Filler v2
 * 强化版 — 带详细日志 + 全页扫描 + 多重匹配策略
 */
(function() {
  'use strict';

  var LANG_MAP = {
    'german': 'de', 'deutsch': 'de',
    'italian': 'it', 'italiano': 'it',
    'spanish': 'es', 'español': 'es', 'espanol': 'es',
    'french': 'fr', 'français': 'fr', 'francais': 'fr',
    'polish': 'pl', 'polski': 'pl',
    'dutch': 'nl', 'nederlands': 'nl',
    'irish': 'ga', 'gaeilge': 'ga',
    'japanese': 'ja', '日本語': 'ja',
    'arabic': 'ar', 'العربية': 'ar',
    'portuguese': 'pt', 'português': 'pt', 'portugues': 'pt'
  };

  var LANG_NAMES = {
    'de': '德语 German', 'it': '意大利语 Italian', 'es': '西班牙语 Spanish',
    'fr': '法语 French', 'pl': '波兰语 Polish', 'nl': '荷兰语 Dutch',
    'ga': '爱尔兰语 Irish', 'ja': '日语 Japanese', 'ar': '阿拉伯语 Arabic',
    'pt': '葡萄牙语 Portuguese'
  };

  var log = [];
  function addLog(msg, color) {
    log.push(msg);
    console.log('%c[INIU翻译] ' + msg, 'color:' + (color || '#333'));
  }

  // 浮动状态面板
  function showPanel(title, content, bgColor) {
    removePanel();
    var panel = document.createElement('div');
    panel.id = 'iniu-trans-panel';
    panel.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999999;padding:16px 20px;border-radius:10px;'
      + 'color:#fff;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;'
      + 'box-shadow:0 6px 24px rgba(0,0,0,0.25);max-width:420px;line-height:1.6;'
      + 'background:' + (bgColor || '#2c3e50') + ';';
    panel.innerHTML = '<strong style="font-size:16px;">' + title + '</strong>'
      + '<div style="margin-top:8px;font-size:13px;">' + content + '</div>'
      + '<button id="iniu-close-panel" style="position:absolute;top:8px;right:12px;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;opacity:0.7;">&times;</button>';
    document.body.appendChild(panel);
    document.getElementById('iniu-close-panel').onclick = removePanel;
  }

  function removePanel() {
    var p = document.getElementById('iniu-trans-panel');
    if (p) p.remove();
  }

  function normalizeText(text) {
    return text.replace(/\s+/g, ' ').replace(/[‘’'']/g, "'").replace(/[""]/g, '"').trim();
  }

  // ====== 全页扫描：找到所有可能的翻译输入框 ======
  function findAllInputs() {
    addLog('🔍 开始全页扫描...', '#3498db');
    var results = [];
    var allInputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea, [contenteditable="true"]');

    addLog('  找到 ' + allInputs.length + ' 个输入元素', '#666');

    for (var i = 0; i < allInputs.length; i++) {
      var inp = allInputs[i];

      // 跳过隐藏元素（但保留在 lightbox 中可能被隐藏的）
      var rect = inp.getBoundingClientRect();
      var isVisible = rect.width > 0 && rect.height > 0;
      var isInDOM = document.body.contains(inp);

      if (!isInDOM) continue;
      if (inp.readOnly || inp.disabled) continue;
      // 跳过搜索框
      if (inp.placeholder && /search|suche|buscar|recherche|ricerca|zoek/i.test(inp.placeholder)) continue;
      if (inp.type === 'hidden' || inp.type === 'submit' || inp.type === 'button') continue;

      // 尝试找到关联的原始文本
      var original = findOriginalText(inp);

      if (original) {
        results.push({ input: inp, original: original });
        addLog('  [' + (results.length) + '] 原文: "' + original.substring(0, 50) + (original.length > 50 ? '...' : '') + '"', '#27ae60');
      } else if (isVisible) {
        // 可见但找不到原文，记录下来
        addLog('  [跳过] 可见输入框未找到原文: tag=' + inp.tagName + ' id=' + (inp.id || '无') + ' class=' + (inp.className || '无'), '#e67e22');
      }
    }

    addLog('📊 扫描结果: 共发现 ' + results.length + ' 个翻译输入框', '#2c3e50');
    return results;
  }

  // ====== 查找与输入框关联的原始英文文本 ======
  function findOriginalText(inp) {
    // 策略1: 查找最近的包含文本的 td/div，且该容器不在另一个输入框内
    // 向上遍历，找包含"原文→翻译"这种结构的行
    var row = inp.closest('tr, .row, [class*="row"], .field-row, .translation-row, li, .form-group, .input-group');
    if (row) {
      // 在 row 中找第一个包含文本但不是输入框的元素
      var children = row.children;
      for (var c = 0; c < children.length; c++) {
        var child = children[c];
        var childInputs = child.querySelectorAll('input, textarea, select');
        if (childInputs.length > 0) continue; // 跳过包含输入框的单元格
        var text = (child.textContent || '').trim();
        if (text && text.length > 1) {
          return text;
        }
      }
    }

    // 策略2: 查找前面的兄弟元素（非输入框）
    var prev = inp.previousElementSibling;
    var count = 0;
    while (prev && count < 10) {
      if (prev.tagName !== 'INPUT' && prev.tagName !== 'TEXTAREA' && prev.tagName !== 'SELECT') {
        var t = (prev.textContent || '').trim();
        if (t && t.length > 1 && t.length < 500) {
          return t;
        }
      }
      prev = prev.previousElementSibling;
      count++;
    }

    // 策略3: 同一父元素中，找第一个非输入框的文本节点
    var parent = inp.parentElement;
    if (parent) {
      var siblings = parent.children;
      for (var s = 0; s < siblings.length; s++) {
        var sib = siblings[s];
        if (sib === inp) continue;
        if (sib.tagName === 'INPUT' || sib.tagName === 'TEXTAREA' || sib.tagName === 'SELECT') continue;
        var st = (sib.textContent || '').trim();
        if (st && st.length > 1 && st.length < 500) {
          return st;
        }
      }
    }

    // 策略4: 向上找到 table，找同行的第一个 td
    var td = inp.closest('td');
    if (td) {
      var tr = td.closest('tr');
      if (tr) {
        var firstTd = tr.querySelector('td:first-child');
        if (firstTd && firstTd !== td) {
          var firstTdInputs = firstTd.querySelectorAll('input, textarea');
          if (firstTdInputs.length === 0) {
            var text = (firstTd.textContent || '').trim();
            if (text && text.length > 1) return text;
          }
        }
      }
    }

    // 策略5: 查找同一容器中 class 包含 "default", "original", "source", "label" 的元素
    var container = inp.closest('div, td, li, .form-group');
    if (container) {
      var labelEl = container.querySelector('[class*="default"], [class*="original"], [class*="source"], [class*="label"], [data-role="default"], [data-role="original"]');
      if (labelEl && labelEl !== inp) {
        var labelText = (labelEl.textContent || '').trim();
        if (labelText && labelText.length > 1) return labelText;
      }
    }

    // 策略6: 查找 input 的 label 或 aria-label
    if (inp.labels && inp.labels.length > 0) {
      return inp.labels[0].textContent.trim();
    }
    if (inp.getAttribute('aria-label')) {
      return inp.getAttribute('aria-label').trim();
    }

    return null;
  }

  // ====== 检测语言 ======
  function detectLanguage() {
    addLog('🔍 检测当前编辑语言...', '#3498db');

    // 检查页面所有可见文本
    var allText = (document.body.innerText || '').toLowerCase();
    addLog('  页面文本长度: ' + allText.length + ' 字符', '#666');

    // 检查 URL
    var url = window.location.href.toLowerCase();
    addLog('  URL: ' + url, '#666');

    // 检查 modal/lightbox/dialog 标题
    var dialogs = document.querySelectorAll('[role="dialog"], .modal, .lightbox, .dialog, [class*="modal"], [class*="lightbox"], [class*="dialog"], [class*="popup"], [class*="overlay"]');
    var dialogText = '';
    for (var d = 0; d < dialogs.length; d++) {
      dialogText += ' ' + (dialogs[d].textContent || '').toLowerCase();
    }

    var searchText = allText + ' ' + url + ' ' + dialogText;

    for (var name in LANG_MAP) {
      if (searchText.indexOf(name) >= 0) {
        addLog('  ✅ 检测到语言: ' + name + ' → ' + LANG_MAP[name], '#27ae60');
        return LANG_MAP[name];
      }
    }

    addLog('  ⚠️ 无法自动检测语言', '#e67e22');
    return null;
  }

  // ====== 匹配并填入翻译 ======
  function fillTranslations(langCode, inputItems) {
    var translations = window.__INIU_TRANSLATIONS__[langCode];
    if (!translations) {
      addLog('❌ 未找到 ' + langCode + ' 的翻译数据', '#e74c3c');
      return { filled: 0, skipped: 0 };
    }

    addLog('📝 开始匹配翻译 (语言: ' + langCode + ', 翻译条目: ' + Object.keys(translations).length + ')', '#3498db');

    var filled = 0, skipped = 0;

    for (var i = 0; i < inputItems.length; i++) {
      var item = inputItems[i];
      var original = normalizeText(item.original);
      var translation = translations[original];

      // 精确匹配失败，尝试 normalize 后匹配
      if (!translation) {
        for (var key in translations) {
          if (normalizeText(key) === original) {
            translation = translations[key];
            break;
          }
        }
      }

      // 仍然失败，尝试包含匹配
      if (!translation) {
        for (var k in translations) {
          if (original.indexOf(normalizeText(k)) >= 0 || normalizeText(k).indexOf(original) >= 0) {
            if (original.length > 3 && normalizeText(k).length > 3) {
              translation = translations[k];
              break;
            }
          }
        }
      }

      if (translation) {
        var inp = item.input;
        if (inp.tagName === 'TEXTAREA' || inp.tagName === 'INPUT') {
          var setter = inp.tagName === 'INPUT'
            ? Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
            : Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          setter.call(inp, translation);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          // 同时触发 React 合成事件
          var nativeInputEvent = new Event('input', { bubbles: true });
          Object.defineProperty(nativeInputEvent, 'target', { writable: false, value: inp });
          inp.dispatchEvent(nativeInputEvent);
        } else if (inp.getAttribute('contenteditable') === 'true') {
          inp.textContent = translation;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        }
        filled++;
      } else {
        skipped++;
        if (skipped <= 5) {
          addLog('  [未匹配] 原文: "' + original.substring(0, 60) + '"', '#e67e22');
        }
      }
    }

    return { filled: filled, skipped: skipped };
  }

  // ====== 语言选择器 ======
  function createLanguageSelector() {
    removePanel();
    var overlay = document.createElement('div');
    overlay.id = 'iniu-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999998;display:flex;align-items:center;justify-content:center;';

    var html = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:440px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,sans-serif;">';
    html += '<h3 style="margin:0 0 6px;font-size:18px;">🌐 选择要填入的语言</h3>';
    html += '<p style="margin:0 0 16px;color:#666;font-size:13px;">请点击当前正在编辑的语言：</p>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';

    var langs = [
      { code: 'de', name: '德语 German' },
      { code: 'it', name: '意大利语 Italian' },
      { code: 'es', name: '西班牙语 Spanish' },
      { code: 'fr', name: '法语 French' },
      { code: 'pl', name: '波兰语 Polish' },
      { code: 'nl', name: '荷兰语 Dutch' },
      { code: 'ga', name: '爱尔兰语 Irish' },
      { code: 'ja', name: '日语 Japanese' },
      { code: 'ar', name: '阿拉伯语 Arabic' },
      { code: 'pt', name: '葡萄牙语 Portuguese' }
    ];

    for (var l = 0; l < langs.length; l++) {
      html += '<button data-lang="' + langs[l].code + '" style="padding:10px 14px;background:#3498db;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;flex:1;min-width:130px;transition:background 0.2s;" onmouseover="this.style.background=\'#2980b9\'" onmouseout="this.style.background=\'#3498db\'">' + langs[l].name + '</button>';
    }

    html += '</div>';
    html += '<button id="iniu-cancel" style="margin-top:16px;padding:8px 16px;background:#e0e0e0;border:none;border-radius:6px;cursor:pointer;font-size:14px;width:100%;">取消</button>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // 绑定事件
    var buttons = overlay.querySelectorAll('button[data-lang]');
    for (var b = 0; b < buttons.length; b++) {
      buttons[b].onclick = function() {
        overlay.remove();
        executeFill(this.getAttribute('data-lang'));
      };
    }

    overlay.querySelector('#iniu-cancel').onclick = function() { overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  }

  // ====== 执行填充 ======
  function executeFill(langCode) {
    addLog('🚀 开始填充语言: ' + langCode + ' (' + (LANG_NAMES[langCode] || '') + ')', '#2c3e50');

    var inputItems = findAllInputs();

    if (inputItems.length === 0) {
      addLog('⚠️ 未找到翻译输入框！', '#e74c3c');
      showPanel('⚠️ 未找到翻译输入框',
        '请确保：<br>1. 已打开 Customize 翻译编辑弹窗（点击语言的 ✏️ 按钮）<br>2. 弹窗中的翻译输入框已加载完成<br><br>'
        + '<b>提示：</b>打开浏览器控制台 (F12) 查看详细日志',
        '#e74c3c');
      return;
    }

    var result = fillTranslations(langCode, inputItems);

    var msg = '✅ 已填入 ' + result.filled + ' 条翻译';
    if (result.skipped > 0) msg += '，跳过 ' + result.skipped + ' 条（未匹配）';
    msg += '<br><br><b>⚠️ 请务必点击弹窗中的 Save 按钮保存！</b>';

    showPanel('✅ 翻译填充完成', msg, result.filled > 0 ? '#27ae60' : '#e67e22');
    addLog('✅ ' + msg.replace(/<[^>]*>/g, ''), '#27ae60');
  }

  // ====== 启动 ======
  addLog('📦 INIU 翻译自动填充工具 v2 启动', '#2c3e50');

  // 始终显示语言选择器，不再自动检测（自动检测经常误判）
  function startWithSelector() {
    addLog('✅ 翻译数据已加载 (' + Object.keys(window.__INIU_TRANSLATIONS__).length + ' 种语言)', '#27ae60');
    addLog('📋 显示语言选择器...', '#3498db');
    createLanguageSelector();
  }

  if (window.__INIU_TRANSLATIONS__) {
    startWithSelector();
  } else {
    addLog('⏳ 等待翻译数据加载...', '#e67e22');
    var attempts = 0;
    var checkInterval = setInterval(function() {
      attempts++;
      if (window.__INIU_TRANSLATIONS__) {
        clearInterval(checkInterval);
        startWithSelector();
      } else if (attempts > 60) {
        clearInterval(checkInterval);
        addLog('❌ 翻译数据加载超时（30秒）。请检查网络连接，或刷新页面重试', '#e74c3c');
        showPanel('❌ 数据加载超时',
          '翻译数据文件 (translations.js) 加载失败。<br>可能原因：<br>1. Render 服务器正在冷启动（等待 30 秒后重试）<br>2. 网络连接问题<br><br><b>建议：</b>刷新页面后重新点击书签',
          '#e74c3c');
      }
    }, 500);
  }
})();