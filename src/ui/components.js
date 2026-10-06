/**
 * 共用界面零件：商品图、颜色/形状徽章、纸币硬币、顶部信息条、对话框等。
 * 命名、颜色和形状信息一律「图案 + 文字 + 数字」三重呈现，
 * 不把颜色当作唯一线索（无障碍要求，PRD 15）。
 */
import { el, clear, pressable, announce } from './dom.js';
import { icon } from './icons.js';
import { getColor, colorName } from '../data/colors.js';
import { shapeBadgeSvg, shapeName } from '../data/shapes.js';
import { productArtPath } from '../data/products.js';
import { getDenomination, denominationLabel, denominationShort } from '../data/denominations.js';
import { formatYuan } from '../logic/money.js';

/* ----------------------------- 商品图 ----------------------------- */

function fallbackArt(product) {
  const color = getColor(product.color);
  return el('span', {
    class: 'product-art product-art--fallback',
    style: { backgroundColor: color ? color.hex : '#f1f3f7' },
    text: product.emoji || '🛒',
    attrs: { 'aria-hidden': 'true' }
  });
}

/**
 * 商品插画。
 * 用 <img> 单独加载 assets/products/<id>.svg —— 资源分开载入，浏览器可以缓存和并行下载；
 * 万一图片加载失败，自动换成同色系的表情兜底，游戏不会变成空白卡片。
 */
export function productArt(product, { size = 96, className = '' } = {}) {
  return el('img', {
    class: `product-art ${className}`.trim(),
    src: productArtPath(product.id),
    alt: '',
    attrs: {
      width: size,
      height: size,
      decoding: 'async',
      'aria-hidden': 'true'
    },
    on: {
      error(event) {
        const target = event.currentTarget;
        if (target && target.replaceWith) target.replaceWith(fallbackArt(product));
      }
    }
  });
}

/* --------------------------- 颜色 / 形状 --------------------------- */

/** 颜色圆点：色块 + 图案 + 文字，色盲也能分辨。 */
export function colorDot(colorId, language, { showLabel = true } = {}) {
  const color = getColor(colorId);
  const swatch = el('span', {
    class: `swatch pattern--${color ? color.pattern : 'dots'}`,
    style: { backgroundColor: color ? color.hex : '#ddd' },
    attrs: { 'aria-hidden': 'true' }
  });
  if (!showLabel) return el('span', { class: 'color-dot color-dot--bare' }, [swatch]);
  return el('span', { class: 'color-dot' }, [swatch, el('span', { class: 'color-dot__label', text: colorName(colorId, language) })]);
}

/** 形状徽章：图形 + 名称。 */
export function shapeBadge(shapeId, language, { showLabel = true } = {}) {
  return el('span', { class: 'shape-badge' }, [
    el('span', { class: 'shape-badge__icon', html: shapeBadgeSvg(shapeId) }),
    showLabel ? el('span', { class: 'shape-badge__label', text: shapeName(shapeId, language) }) : null
  ]);
}

/* ------------------------------ 钱 -------------------------------- */

/**
 * 一张纸币或一枚硬币，可以直接点击放进找零盘。
 * onClick 为空时返回静态展示用的元素（例如展示「顾客这样付钱」）。
 */
export function moneyChip(value, language, { onClick = null, disabled = false, count = 0, small = false } = {}) {
  const info = getDenomination(value);
  const kind = info ? info.kind : 'note';
  const tone = info ? info.tone : '#ddd';
  const content = [
    el('span', { class: 'money-chip__value', text: String(value) }),
    el('span', { class: 'money-chip__unit', text: language === 'en' ? '¥' : '元' }),
    count > 1 ? el('span', { class: 'money-chip__count', text: `×${count}` }) : null
  ];

  if (!onClick) {
    return el(
      'span',
      {
        class: `money-chip money-chip--${kind} ${small ? 'money-chip--small' : ''}`,
        style: { '--money-tone': tone },
        attrs: { 'aria-label': denominationLabel(value, language) }
      },
      content
    );
  }

  return el(
    'button',
    {
      class: `money-chip money-chip--${kind} money-chip--button ${small ? 'money-chip--small' : ''}`,
      type: 'button',
      style: { '--money-tone': tone },
      disabled,
      attrs: {
        'aria-label': `${denominationLabel(value, language)}`,
        title: denominationLabel(value, language)
      },
      on: { click: () => onClick(value) }
    },
    content
  );
}

/** 大字号金额（带单位）。 */
export function amountText(amount, language, { className = 'amount' } = {}) {
  return el('span', { class: className }, [
    el('span', { class: 'amount__value', text: String(Math.round(Number(amount) || 0)) }),
    el('span', { class: 'amount__unit', text: language === 'en' ? 'yuan' : '元' })
  ]);
}

export function moneyText(amount, language) {
  return el('span', { class: 'money-text', text: formatYuan(amount, language) });
}

/* --------------------------- 顶部信息条 --------------------------- */

export function statChip(iconName, value, label, ariaLabel) {
  return el('div', { class: 'stat-chip', attrs: { 'aria-label': ariaLabel || `${label} ${value}` } }, [
    icon(iconName),
    el('span', { class: 'stat-chip__value', text: String(value) }),
    el('span', { class: 'stat-chip__label', text: label })
  ]);
}

/** 中英文分段切换按钮：切换后立即生效，不刷新页面。 */
export function languageSwitch(ctx, state) {
  const group = el('div', {
    class: 'language-switch',
    role: 'group',
    attrs: { 'aria-label': ctx.t('a11y.languageSwitch') }
  });
  for (const code of ['zh', 'en']) {
    const active = state.language === code;
    group.appendChild(
      el('button', {
        class: `language-switch__button ${active ? 'is-active' : ''}`,
        type: 'button',
        text: code === 'zh' ? '中文' : 'English',
        attrs: { 'aria-pressed': String(active), lang: code === 'zh' ? 'zh-CN' : 'en' },
        on: { click: () => ctx.actions.setLanguage(code) }
      })
    );
  }
  return group;
}

export function iconButton(ctx, { iconName, label, onClick, className = '', extraClass = '' }) {
  return el(
    'button',
    {
      class: `icon-button ${className} ${extraClass}`.trim(),
      type: 'button',
      attrs: { 'aria-label': label, title: label },
      on: { click: onClick }
    },
    [icon(iconName)]
  );
}

export function bigButton(ctx, { label, onClick, variant = 'primary', iconName = null, disabled = false, className = '' }) {
  return el(
    'button',
    {
      class: `button button--${variant} ${className}`.trim(),
      type: 'button',
      disabled,
      on: { click: onClick }
    },
    [iconName ? icon(iconName) : null, el('span', { class: 'button__label', text: label })]
  );
}

/* ----------------------------- 对话框 ----------------------------- */

/**
 * 通用对话框：Esc 关闭、点背景关闭、打开时把焦点移进去、关闭后焦点还给原来的按钮。
 * 儿童误触关闭也不会丢失状态（状态一直在 store 里）。
 */
export function openDialog({ title, body, actions = [], onClose, labelledBy = 'dialog-title' }) {
  const previouslyFocused = document.activeElement;
  const titleId = `${labelledBy}-${Math.random().toString(36).slice(2, 7)}`;

  const closeButton = el('button', {
    class: 'icon-button dialog__close',
    type: 'button',
    attrs: { 'aria-label': 'close' },
    on: { click: () => close() },
    html: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'
  });

  const panel = el('div', {
    class: 'dialog',
    role: 'dialog',
    attrs: { 'aria-modal': 'true', 'aria-labelledby': title ? titleId : null }
  }, [
    el('div', { class: 'dialog__head' }, [
      title ? el('h2', { class: 'dialog__title', id: titleId, text: title }) : null,
      closeButton
    ]),
    el('div', { class: 'dialog__body' }, body),
    actions.length ? el('div', { class: 'dialog__actions' }, actions) : null
  ]);

  const backdrop = el('div', { class: 'dialog-backdrop' }, [panel]);

  function focusables() {
    return [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
      (node) => !node.disabled
    );
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = focusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function close() {
    backdrop.removeEventListener('keydown', onKeydown);
    document.body.classList.remove('has-dialog');
    backdrop.remove();
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    if (typeof onClose === 'function') onClose();
  }

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.addEventListener('keydown', onKeydown);
  document.body.appendChild(backdrop);
  document.body.classList.add('has-dialog');
  const first = focusables()[0];
  if (first) first.focus();

  return { root: backdrop, close };
}

/* ----------------------------- 小装饰 ----------------------------- */

/** 彩纸庆祝效果；关闭动画时自动跳过，只播报一次无障碍提示。 */
export function confetti(container, { enabled = true, count = 16 } = {}) {
  announce('🎉');
  if (!enabled) return;
  for (let i = 0; i < count; i += 1) {
    const piece = el('span', {
      class: 'confetti__piece',
      style: {
        left: `${Math.round((i / count) * 100)}%`,
        '--fall-delay': `${(i % 6) * 0.08}s`,
        '--fall-x': `${Math.round(Math.random() * 60 - 30)}px`,
        background: ['#f2545b', '#ffd93d', '#5bc0eb', '#8ed081', '#b28dff', '#ff9ecd'][i % 6]
      },
      attrs: { 'aria-hidden': 'true' }
    });
    container.appendChild(piece);
    window.setTimeout(() => piece.remove(), 1400);
  }
}

/** 星星行：3 颗星，亮起来的是本次拿到的。 */
export function starRow(stars, total = 3) {
  const row = el('div', { class: 'star-row', attrs: { 'aria-hidden': 'true' } });
  for (let i = 0; i < total; i += 1) {
    row.appendChild(el('span', { class: `star-row__star ${i < stars ? 'is-on' : ''}` }, [icon('star')]));
  }
  return row;
}

/** 简单的进度条（数量进度用）。 */
export function progressBar(value, max, { className = '' } = {}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return el('div', { class: `progress-bar ${className}`.trim(), attrs: { 'aria-hidden': 'true' } }, [
    el('span', { class: 'progress-bar__fill', style: { width: `${Math.round(ratio * 100)}%` } })
  ]);
}

export { clear, el, pressable, icon, colorName, shapeName, denominationShort };
