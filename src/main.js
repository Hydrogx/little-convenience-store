/**
 * 应用入口：装配状态、语言、音效、界面路由和全局键盘操作。
 * 具体玩法逻辑在 src/game.js，数学计算在 src/logic/，这里只做「接线」。
 */
import { store } from './state.js';
import { setLanguage, t } from './i18n/index.js';
import { setSoundEnabled, unlockAudio, playSound } from './audio.js';
import { createApp } from './ui/router.js';
import { announce } from './ui/dom.js';
import { formatYuan } from './logic/money.js';
import { orderSentence } from './i18n/phrases.js';
import { isOrderMode } from './logic/orders.js';
import * as actions from './game.js';

const reducedMotion =
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** 当前激活的数字键盘（由收银台注册），用来支持电脑键盘输入。 */
let activeKeypad = null;

const ctx = {
  actions: {
    ...actions,
    // 界面里用 ctx.actions.setLanguage(...) 调用，这里映射到 game.changeLanguage
    setLanguage: actions.changeLanguage,
    startMixed: actions.startMixed,
    registerKeypad(keypad) {
      activeKeypad = keypad || null;
    },
    totalChoices: () => actions.currentTotalChoices(),
    hasNextCustomer: () => isOrderMode(store.getState().gameMode)
  },
  getState: () => store.getState(),
  get language() {
    return store.getState().language;
  },
  get animate() {
    const state = store.getState();
    if (!state.animationEnabled) return false;
    return !(reducedMotion && reducedMotion.matches);
  },
  t(key, params) {
    return t(key, params, store.getState().language);
  },
  moneyLabel(amount) {
    return formatYuan(amount, store.getState().language);
  }
};

const app = createApp(ctx);

/* --------------------------- 渲染与副作用 --------------------------- */

let lastPhase = null;
let lastLanguage = null;

function announcePhase(state) {
  if (state.screen !== 'game') return;
  const language = state.language;
  if (state.phase === 'shopping') {
    if (state.order) {
      announce(`${t('game.says', {}, language)} ${orderSentence(state.order, language)}`);
    } else {
      announce(t('game.freeHint', {}, language));
    }
    return;
  }
  if (state.phase === 'total') {
    announce(`${t('checkout.totalQuestion', {}, language)}`);
    return;
  }
  if (state.phase === 'payment') {
    announce(`${t('checkout.payment', {}, language)} ${formatYuan(state.payment ? state.payment.payment : 0, language)}`);
    return;
  }
  if (state.phase === 'change') {
    announce(t('checkout.changeQuestion', {}, language));
    return;
  }
  if (state.phase === 'result') {
    announce(state.reward && state.reward.skipped ? t('result.encourage', {}, language) : t('result.greatJob', {}, language));
  }
}

function render() {
  const state = store.getState();

  if (lastLanguage !== state.language) {
    setLanguage(state.language, { notify: false });
    document.title = t('app.docTitle', {}, state.language);
    lastLanguage = state.language;
  }
  setSoundEnabled(state.soundEnabled);

  const animate = ctx.animate;
  document.documentElement.dataset.animation = animate ? 'on' : 'off';
  document.documentElement.classList.toggle('is-animated', animate);

  app.render(state);

  if (lastPhase !== state.phase) {
    lastPhase = state.phase;
    announcePhase(state);
  }
}

store.subscribe(render);

/* ----------------------------- 全局输入 ----------------------------- */

// 浏览器要求先有一次用户操作才允许播放声音
document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
document.addEventListener('keydown', unlockAudio, { once: true });

// 统一的点击音效：按钮可以写 data-sound="pop" 换成别的声音，写 data-sound="none" 静音。
// 具体玩法结果的声音（答对、需要再试一次、收银）由 src/game.js 负责，二者不会重复。
document.addEventListener(
  'click',
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (!button || button.disabled) return;
    const name = button.dataset.sound || 'click';
    if (name === 'none') return;
    playSound(name);
  },
  true
);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const dialog = document.querySelector('.dialog-backdrop');
    if (dialog) return; // 对话框自己会处理 Esc
    const state = store.getState();
    if (state.screen === 'settings' || state.screen === 'help') {
      event.preventDefault();
      actions.goHome();
    }
    return;
  }

  if (!activeKeypad) return;
  const tag = document.activeElement ? document.activeElement.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (/^[0-9]$/.test(event.key) || event.key === 'Backspace' || event.key === 'Delete') {
    if (activeKeypad.handleKey(event.key)) event.preventDefault();
    return;
  }
  if (event.key === 'Enter' && tag !== 'BUTTON') {
    if (activeKeypad.handleKey('Enter')) event.preventDefault();
  }
});

/* ------------------------------ 启动 ------------------------------- */

setLanguage(store.getState().language, { notify: false });
render();

// 让 scripts/boot-check.js 知道模块已经正常启动（file:// 打开时会一直等不到这一步）
window.__LCS_BOOTED__ = true;
