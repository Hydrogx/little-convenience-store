/**
 * 国际化入口。
 * - 中英文分别放在 zh.js / en.js 两个独立资源文件里；
 * - 切换语言立刻生效，不需要刷新页面，也不会清空购物篮或进度；
 * - 语言本身由 src/state.js 负责写入 localStorage。
 *
 * 这个模块故意不依赖 DOM：在没有 document 的环境（比如 node --test）里也能安全 import。
 */
import { ZH } from './zh.js';
import { EN } from './en.js';

export const DICTIONARIES = { zh: ZH, en: EN };
export const LANGUAGES = ['zh', 'en'];
export const DEFAULT_LANGUAGE = 'zh';

let currentLanguage = DEFAULT_LANGUAGE;
const listeners = new Set();

export function isLanguage(value) {
  return LANGUAGES.includes(value);
}

export function normalizeLanguage(value) {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export function getLanguage() {
  return currentLanguage;
}

/** 当前语言的 BCP-47 标签，写进 <html lang>。 */
export function localeTag(language = currentLanguage) {
  return language === 'en' ? 'en' : 'zh-CN';
}

/** 语言按钮上的名字（永远显示语言自己的写法，方便孩子和家长辨认）。 */
export function languageLabel(language) {
  return language === 'en' ? 'English' : '中文';
}

/**
 * 切换语言。返回真正生效的语言代码。
 * notify=false 用于初始化，避免刚打开页面就触发一次重绘。
 */
export function setLanguage(language, { notify = true } = {}) {
  const next = normalizeLanguage(language);
  const changed = next !== currentLanguage;
  currentLanguage = next;

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = localeTag(next);
  }
  if (changed && notify) {
    for (const listener of listeners) {
      try {
        listener(next);
      } catch (error) {
        console.error('[i18n] listener failed', error);
      }
    }
  }
  return currentLanguage;
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 取一条界面文本。
 * 找不到键时：先退回中文，再退回键名本身 —— 界面上永远不显示 undefined。
 */
export function t(key, params = {}, language = currentLanguage) {
  const dict = DICTIONARIES[normalizeLanguage(language)];
  let template = dict[key];
  if (template === undefined) template = ZH[key];
  if (template === undefined) return key;

  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/** 该键是否有翻译（测试用）。 */
export function hasKey(key, language = currentLanguage) {
  return Boolean(DICTIONARIES[normalizeLanguage(language)][key]);
}

/** 把字典里的键按顺序拼起来（例如把几条说明连成一段）。 */
export function tList(keys, params = {}, language = currentLanguage) {
  return keys.map((key) => t(key, params, language)).join(' ');
}

/**
 * 把带 data-i18n 标记的静态节点翻译一遍。
 * 语言切换后调用一次即可，页面上所有静态文字（含 aria-label）都会更新。
 */
export function applyToDom(root) {
  if (typeof document === 'undefined') return;
  const scope = root || document;
  for (const node of scope.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of scope.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  }
  for (const node of scope.querySelectorAll('[data-i18n-title]')) {
    node.setAttribute('title', t(node.dataset.i18nTitle));
  }
}

export { ZH, EN };
