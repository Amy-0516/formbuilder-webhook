/**
 * 123formbuilder Translation Auto-Filler
 * 在 123formbuilder 的 Language → Customize 弹窗中自动填入翻译
 * 
 * 用法: 在浏览器控制台运行此脚本，或通过书签工具加载
 */

(function() {
  'use strict';

  // ========== 语言名称映射 (123formbuilder 显示名称 → 代码) ==========
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

  // ========== 检测当前编辑的语言 ==========
  function detectLanguage() {
    var pageText = document.body.innerText || '';

    // 方法1: 检查页面标题或面包屑
    var title = document.title || '';
    for (var name in LANG_MAP) {
      if (title.toLowerCase().indexOf(name) >= 0) {
        return LANG_MAP[name];
      }
    }

    // 方法2: 检查语言侧边栏中的活动项
    var langItems = document.querySelectorAll('.language-item, .lang-item, [class*="language"] [class*="active"], [class*="lang"] [class*="active"]');
    for (var i = 0; i < langItems.length; i++) {
      var text = (langItems[i].textContent || '').toLowerCase();
      for (var n in LANG_MAP) {
        if (text.indexOf(n) >= 0) {
          return LANG_MAP[n];
        }
      }
    }

    // 方法3: 检查 modal/lightbox 标题
    var modals = document.querySelectorAll('.modal, .lightbox, .dialog, [class*="modal"], [class*="lightbox"], [class*="dialog"], [role="dialog"]');
    for (var j = 0; j < modals.length; j++) {
      var modalText = (modals[j].textContent || '').toLowerCase();
      for (var m in LANG_MAP) {
        if (modalText.indexOf(m) >= 0) {
          return LANG_MAP[m];
        }
      }
    }

    // 方法4: 检查 URL
    var url = window.location.href.toLowerCase();
    for (var k in LANG_MAP) {
      if (url.indexOf(k) >= 0) {
        return LANG_MAP[k];
      }
    }

    return null;
  }

  // ========== 标准化文本（去除多余空格、特殊字符） ==========
  function normalizeText(text) {
    return text.replace(/\s+/g, ' ').replace(/[‘’'']/g, "'").replace(/[""]/g, '"').trim();
  }

  // ========== 查找翻译输入框 ==========
  function findTranslationInputs() {
    var inputs = [];

    // 策略1: 在 modal/dialog 中查找所有 input 和 textarea
    var containers = document.querySelectorAll('.modal, .lightbox, .dialog, [role="dialog"], [class*="modal"], [class*="lightbox"], [class*="customize"], [class*="translate"]');
    var searchIn = containers.length > 0 ? containers : [document.body];

    for (var ci = 0; ci < searchIn.length; ci++) {
      var container = searchIn[ci];
      var allInputs = container.querySelectorAll('input[type="text"], input:not([type]), textarea, [contenteditable="true"]');

      for (var i = 0; i < allInputs.length; i++) {
        var input = allInputs[i];
        // 跳过隐藏的、只读的、禁用的
        if (input.offsetParent === null && input.type !== 'hidden') continue;
        if (input.readOnly || input.disabled) continue;

        // 查找关联的原始文本
        var originalText = findAssociatedText(input);
        if (originalText) {
          inputs.push({ input: input, original: originalText });
        }
      }
    }

    return inputs;
  }

  // ========== 查找与输入框关联的原始文本 ==========
  function findAssociatedText(input) {
    // 策略1: 查找同行的 label
    var row = input.closest('tr, .row, [class*="row"], .field-row, .translation-row, li');
    if (row) {
      var labels = row.querySelectorAll('td:first-child, .label, .original, .source, .default-text, [class*="label"], [class*="original"], [class*="source"], [class*="default"]');
      for (var i = 0; i < labels.length; i++) {
        var text = (labels[i].textContent || '').trim();
        if (text && text.length > 1 && labels[i] !== input) {
          return text;
        }
      }
      // 也检查第一个 td 或第一个非输入元素
      var firstCell = row.querySelector('td, .cell, [class*="cell"]');
      if (firstCell) {
        var inputs = firstCell.querySelectorAll('input, textarea, select');
        if (inputs.length === 0) {
          var text = (firstCell.textContent || '').trim();
          if (text && text.length > 1) {
            return text;
          }
        }
      }
    }

    // 策略2: 查找前面的兄弟元素
    var prev = input.previousElementSibling;
    while (prev) {
      var text = (prev.textContent || '').trim();
      if (text && text.length > 1 && prev.tagName !== 'INPUT' && prev.tagName !== 'TEXTAREA') {
        return text;
      }
      prev = prev.previousElementSibling;
    }

    // 策略3: 查找父元素中的 label
    var parent = input.parentElement;
    if (parent) {
      var label = parent.querySelector('label, span, .label-text, [class*="label"]');
      if (label && label !== input) {
        var text = (label.textContent || '').trim();
        if (text && text.length > 1) {
          return text;
        }
      }
    }

    return null;
  }

  // ========== 显示通知 ==========
  function showToast(message, isError) {
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;padding:14px 24px;border-radius:8px;color:#fff;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.2);animation:slideIn 0.3s ease;max-width:400px;';
    toast.style.background = isError ? '#e74c3c' : '#27ae60';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(function() { toast.remove(); }, 500);
    }, 4000);
  }

  // 添加动画样式
  var style = document.createElement('style');
  style.textContent = '@keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:translateX(0);opacity:1}}';
  document.head.appendChild(style);

  // ========== 主逻辑 ==========
  function main() {
    // 检查翻译数据是否已加载
    if (!window.__INIU_TRANSLATIONS__) {
      showToast('❌ 翻译数据未加载，请先加载 translations.js', true);
      return;
    }

    var langCode = detectLanguage();
    if (!langCode) {
      showToast('⚠️ 无法自动检测语言，请手动选择', true);

      // 创建语言选择器
      createLanguageSelector();
      return;
    }

    var translations = window.__INIU_TRANSLATIONS__[langCode];
    if (!translations) {
      showToast('❌ 未找到语言 "' + langCode + '" 的翻译数据', true);
      return;
    }

    // 查找翻译输入框
    var inputs = findTranslationInputs();

    if (inputs.length === 0) {
      showToast('⚠️ 未找到翻译输入框，请确保 Customize（翻译编辑）弹窗已打开', true);
      return;
    }

    var filled = 0;
    var skipped = 0;

    for (var i = 0; i < inputs.length; i++) {
      var item = inputs[i];
      var original = normalizeText(item.original);
      var translation = translations[original];

      // 尝试模糊匹配
      if (!translation) {
        for (var key in translations) {
          if (normalizeText(key) === original) {
            translation = translations[key];
            break;
          }
        }
      }

      if (translation) {
        if (item.input.tagName === 'TEXTAREA' || item.input.tagName === 'INPUT') {
          // 触发原生事件以确保 React/Angular 等框架能检测到变化
          var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          var nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;

          if (item.input.tagName === 'INPUT') {
            nativeInputValueSetter.call(item.input, translation);
          } else {
            nativeTextareaValueSetter.call(item.input, translation);
          }

          // 触发 input 和 change 事件
          item.input.dispatchEvent(new Event('input', { bubbles: true }));
          item.input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (item.input.getAttribute('contenteditable') === 'true') {
          item.input.textContent = translation;
          item.input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        filled++;
      } else {
        skipped++;
      }
    }

    showToast('✅ 完成！已填入 ' + filled + ' 条翻译' + (skipped > 0 ? '，跳过 ' + skipped + ' 条（未匹配）' : '') + ' — 请点击 Save 保存');
  }

  // ========== 语言选择器（当自动检测失败时） ==========
  function createLanguageSelector() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999998;display:flex;align-items:center;justify-content:center;';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;border-radius:12px;padding:24px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);font-family:-apple-system,BlinkMacSystemFont,sans-serif;';

    panel.innerHTML = '<h3 style="margin:0 0 8px 0;font-size:18px;">🌐 选择要填入的语言</h3>' +
      '<p style="margin:0 0 16px 0;color:#666;font-size:14px;">请选择当前正在编辑的语言：</p>' +
      '<div id="lang-buttons" style="display:flex;flex-wrap:wrap;gap:8px;"></div>' +
      '<button id="close-selector" style="margin-top:16px;padding:8px 16px;background:#e0e0e0;border:none;border-radius:6px;cursor:pointer;font-size:14px;">取消</button>';

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    var buttonsDiv = panel.querySelector('#lang-buttons');
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
      (function(lang) {
        var btn = document.createElement('button');
        btn.textContent = lang.name;
        btn.style.cssText = 'padding:10px 16px;background:#3498db;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;flex:1;min-width:140px;';
        btn.onclick = function() {
          overlay.remove();
          fillWithLanguage(lang.code);
        };
        buttonsDiv.appendChild(btn);
      })(langs[l]);
    }

    panel.querySelector('#close-selector').onclick = function() { overlay.remove(); };
  }

  function fillWithLanguage(langCode) {
    var translations = window.__INIU_TRANSLATIONS__[langCode];
    if (!translations) {
      showToast('❌ 未找到该语言的翻译数据', true);
      return;
    }

    var inputs = findTranslationInputs();
    if (inputs.length === 0) {
      showToast('⚠️ 未找到翻译输入框，请确保 Customize 弹窗已打开', true);
      return;
    }

    var filled = 0;
    var skipped = 0;

    for (var i = 0; i < inputs.length; i++) {
      var original = normalizeText(inputs[i].original);
      var translation = translations[original];

      if (!translation) {
        for (var key in translations) {
          if (normalizeText(key) === original) {
            translation = translations[key];
            break;
          }
        }
      }

      if (translation) {
        var input = inputs[i].input;
        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
          var setter = input.tagName === 'INPUT' ?
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set :
            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          setter.call(input, translation);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (input.getAttribute('contenteditable') === 'true') {
          input.textContent = translation;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        filled++;
      } else {
        skipped++;
      }
    }

    showToast('✅ 完成！已填入 ' + filled + ' 条翻译' + (skipped > 0 ? '，跳过 ' + skipped + ' 条' : '') + ' — 请点击 Save 保存');
  }

  // ========== 启动 ==========
  // 如果数据已加载，直接执行；否则等待数据加载
  if (window.__INIU_TRANSLATIONS__) {
    main();
  } else {
    // 轮询等待数据加载
    var attempts = 0;
    var checkInterval = setInterval(function() {
      attempts++;
      if (window.__INIU_TRANSLATIONS__) {
        clearInterval(checkInterval);
        main();
      } else if (attempts > 30) {
        clearInterval(checkInterval);
        showToast('❌ 翻译数据加载超时，请刷新页面重试', true);
      }
    }, 200);
  }
})();