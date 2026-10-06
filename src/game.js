/**
 * 游戏控制器：把「玩家操作」翻译成状态变化。
 * 界面只调用这里的函数，所有数学都由 logic/ 里的纯函数算出来。
 */
import { store, createSession } from './state.js';
import { resolveRules, MIX_MODES } from './data/levels.js';
import {
  generateOrder,
  resolveOrderLines,
  explainLines,
  explainChange,
  isOrderMode
} from './logic/orders.js';
import {
  addToCart,
  removeFromCart,
  setQuantity,
  deleteLine,
  clearCart,
  cartTotal,
  cartTotalQuantity,
  checkCart,
  lineSubtotal,
  isCartEmpty
} from './logic/cart.js';
import { planPayment, checkChange, totalChoices, selectionTotal } from './logic/money.js';
import { applyOrderResult, breakStreak, createProgress } from './logic/progress.js';
import { hintSentence } from './i18n/phrases.js';
import { getLanguage, t } from './i18n/index.js';
import { playSound, setSoundEnabled } from './audio.js';
import { defaultRandom } from './logic/rng.js';

let timerHandle = null;

/** 延迟执行：在没有 window 的环境（比如 node --test）里安静地跳过。 */
function later(callback, delay) {
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    window.setTimeout(callback, delay);
  }
}

/** 本次生效的规则（难度 + 家长设置）。 */
export function currentRules(state = store.getState()) {
  return resolveRules(state.difficulty, state.settings);
}

/**
 * 派生数据：结账要用到的清单、总价、付款与找零。
 * 全部由程序计算 —— 界面上不会出现写死的答案。
 */
export function deriveGame(state = store.getState()) {
  const rules = currentRules(state);
  const order = state.order;
  const lines = order ? resolveOrderLines(order, state.cart) : state.cart.map((item) => ({ ...item }));
  const total = cartTotal(lines);
  const quantity = cartTotalQuantity(lines);
  const payment = state.payment || null;
  // 算总价 / 找零钱这两种玩法需要孩子自己算总价，购物篮里的大字总价就先藏起来
  const revealTotal =
    state.phase === 'shopping'
      ? state.gameMode !== 'price' && state.gameMode !== 'change'
      : Boolean(payment);
  return { rules, order, lines, total, quantity, payment, revealTotal };
}

function patch(partial) {
  return store.patch(partial);
}

function clearFeedback() {
  if (store.getState().feedback) patch({ feedback: null });
}

/* ------------------------------------------------------------------ */
/* 开局与顾客                                                          */
/* ------------------------------------------------------------------ */

/** 开始一局游戏。mode 为 'free' 时不生成订单，只逛店。 */
export function startGame(mode, { difficulty } = {}) {
  stopTimer();
  const state = store.getState();
  const nextDifficulty = difficulty || state.difficulty;
  patch({
    screen: 'game',
    gameMode: mode,
    difficulty: nextDifficulty,
    cart: clearCart(),
    payment: null,
    totalInput: '',
    changeSelection: [],
    feedback: null,
    reward: null,
    phase: 'shopping',
    session: createSession()
  });
  const rules = currentRules();
  if (isOrderMode(mode)) {
    createOrder({ mode, rules });
    playSound('welcome');
  } else {
    patch({ order: null });
  }
  return store.getState();
}

/** 生成一位新顾客和一张新订单。 */
export function createOrder({ mode, rules, rng = defaultRandom } = {}) {
  const state = store.getState();
  const activeMode = mode || state.gameMode;
  const activeRules = rules || currentRules();
  if (!isOrderMode(activeMode)) return null;

  const order = generateOrder({
    mode: activeMode,
    rules: activeRules,
    rng,
    previousCustomerId: state.session.previousCustomerId
  });

  patch({
    order,
    cart: clearCart(),
    phase: 'shopping',
    totalInput: '',
    changeSelection: [],
    payment: null,
    feedback: null,
    reward: null,
    session: {
      ...state.session,
      orderCount: state.session.orderCount + 1,
      attempts: 0,
      mistakes: 0,
      hintsUsed: 0,
      hintVisible: false,
      previousCustomerId: order.customerId,
      timerLeft: activeRules.timerSeconds,
      timerRunning: activeRules.timerSeconds > 0
    }
  });
  return order;
}

/** 换下一位顾客（自由购物模式不会换）。 */
export function nextCustomer() {
  const state = store.getState();
  if (!isOrderMode(state.gameMode)) return null;
  stopTimer();
  return createOrder({});
}

/** 跳过这一题：直接看答案，不扣任何已经得到的奖励。 */
export function skipQuestion() {
  const state = store.getState();
  stopTimer();
  const { lines, total, payment } = deriveGame(state);
  const steps = explainLines(lines, currentRules(state));
  const changeLine =
    payment && payment.change > 0 ? explainChange({ payment: payment.payment, total, change: payment.change }) : '';
  patch({
    phase: 'result',
    reward: {
      stars: 0,
      coins: 0,
      streak: 0,
      skipped: true,
      steps,
      changeLine,
      total
    },
    progress: breakStreak(state.progress),
    session: { ...state.session, timerRunning: false }
  });
  return store.getState();
}

/* ------------------------------------------------------------------ */
/* 购物篮                                                              */
/* ------------------------------------------------------------------ */

export function addProduct(productId, amount = 1) {
  const state = store.getState();
  const next = addToCart(state.cart, productId, amount);
  if (next === state.cart || cartTotalQuantity(next) === cartTotalQuantity(state.cart)) return state;
  clearFeedback();
  patch({ cart: next });
  return store.getState();
}

export function removeProduct(productId, amount = 1) {
  const state = store.getState();
  const next = removeFromCart(state.cart, productId, amount);
  if (cartTotalQuantity(next) === cartTotalQuantity(state.cart)) return state;
  clearFeedback();
  patch({ cart: next });
  return store.getState();
}

/**
 * 用数字按钮直接把某样商品的数量设为 N（PRD 4.4 的「数字按钮快速选择数量」）。
 * 仍然会被 clamp 到 0..maxQty，所以不可能出现非法数量。
 */
export function setProductQuantity(productId, quantity) {
  const state = store.getState();
  const next = setQuantity(state.cart, productId, quantity);
  if (cartTotalQuantity(next) === cartTotalQuantity(state.cart) && next.length === state.cart.length) {
    return state;
  }
  clearFeedback();
  patch({ cart: next });
  return store.getState();
}

export function removeProductLine(productId) {
  const state = store.getState();
  clearFeedback();
  patch({ cart: deleteLine(state.cart, productId) });
  return store.getState();
}

export function emptyBasket() {
  const state = store.getState();
  if (isCartEmpty(state.cart)) return state;
  patch({ cart: clearCart(), feedback: null });
  return store.getState();
}

/**
 * 检查购物篮是否符合顾客的要求。
 * 符合 → 进入算总价；不符合 → 给出鼓励性的提示（永远不说「错了」）。
 */
export function checkBasket() {
  const state = store.getState();
  const language = getLanguage();
  const { order } = deriveGame(state);
  if (!order) return { ok: false };

  if (isCartEmpty(state.cart)) {
    playSound('gentle');
    patch({ feedback: { kind: 'hint', text: hintSentence({ code: 'empty' }, language) } });
    return { ok: false };
  }

  const result = checkCart(state.cart, order, language);
  if (!result.ok) {
    playSound('gentle');
    patch({
      feedback: { kind: 'hint', text: hintSentence(result.hint, language) },
      session: { ...state.session, mistakes: state.session.mistakes + 1 }
    });
    return { ok: false };
  }

  playSound('correct');
  patch({
    feedback: { kind: 'ok', text: hintSentence(result.hint, language) },
    phase: 'total',
    totalInput: ''
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* 收银台                                                              */
/* ------------------------------------------------------------------ */

/** 回到货架改购物篮。 */
export function backToShopping() {
  patch({ phase: 'shopping', feedback: null, totalInput: '' });
  return store.getState();
}

/** 找零时在「纸币硬币」和「数字键盘」之间切换。 */
export function setAnswerMode(mode) {
  patch({ answerMode: mode === 'keypad' ? 'keypad' : 'money', totalInput: '' });
  return store.getState();
}

/** 进入收银台：自由购物模式也可以来练习找零。 */
export function goToCheckout() {
  const state = store.getState();
  if (isCartEmpty(state.cart)) {
    playSound('gentle');
    patch({ feedback: { kind: 'hint', text: t('game.basketEmpty') } });
    return false;
  }
  patch({ phase: 'total', totalInput: '', feedback: null, changeSelection: [] });
  return true;
}

/** 当前总价题目的选项；难度为挑战级时返回 null，表示用数字键盘。 */
export function currentTotalChoices(rng = defaultRandom) {
  const state = store.getState();
  const { rules, total } = deriveGame(state);
  if (rules.choices < 2) return null;
  return totalChoices(total, rules.choices, rng);
}

/**
 * 提交总价答案。
 * 答对 → 生成付款方案并进入「顾客付款」步骤；答错 → 温和提示 + 计算过程提示。
 */
export function submitTotal(value) {
  const state = store.getState();
  const { rules, total, lines } = deriveGame(state);
  const answer = Math.round(Number(value));
  const language = getLanguage();

  if (!Number.isFinite(answer)) return { ok: false };

  if (answer === total) {
    const plan = rules.allowChange
      ? planPayment(total, rules, defaultRandom)
      : { payment: total, change: 0, notes: [], exact: true };
    playSound('correct');
    patch({
      phase: 'payment',
      payment: plan,
      totalInput: String(total),
      answerMode: 'money',
      feedback: { kind: 'ok', text: t('checkout.correctTotal', {}, language) },
      session: { ...state.session, attempts: state.session.attempts + 1 }
    });
    return { ok: true, total };
  }

  playSound('gentle');
  const steps = explainLines(lines, rules);
  const hintText = rules.showHints
    ? t('checkout.hintTotal', { step: steps.map((step) => stepHint(step, language)).filter(Boolean).join('，') }, language)
    : '';
  patch({
    feedback: {
      kind: 'hint',
      text: `${t('checkout.wrongTotal', {}, language)}${hintText ? ` ${hintText}` : ''}`,
      reveal: hintText
    },
    totalInput: '',
    session: { ...state.session, attempts: state.session.attempts + 1, mistakes: state.session.mistakes + 1 }
  });
  return { ok: false, total };
}

function stepHint(step, language) {
  if (step.type === 'total') return `${t('common.total', {}, language)} ${step.total}`;
  return step.multiplyText;
}

/** 收下顾客的钱，进入找零步骤；如果不用找零，直接进结果页。 */
export function acceptPayment() {
  const state = store.getState();
  const { rules, payment, total, lines } = deriveGame(state);
  playSound('cash');
  if (!payment || payment.change <= 0 || !rules.allowChange) {
    return finishOrder({ total, lines, changeLine: '' });
  }
  patch({
    phase: 'change',
    changeSelection: [],
    feedback: null,
    session: { ...state.session, timerLeft: rules.timerSeconds, timerRunning: rules.timerSeconds > 0 }
  });
  startTimer();
  return store.getState();
}

/** 往找零盘里放一张钱。 */
export function addChangeMoney(value) {
  const state = store.getState();
  patch({ changeSelection: [...state.changeSelection, value], feedback: null });
  return store.getState();
}

/** 把找零盘里最后一张钱拿回来。 */
export function removeChangeMoney(value) {
  const state = store.getState();
  const index = value ? state.changeSelection.lastIndexOf(value) : state.changeSelection.length - 1;
  if (index === -1) return state;
  const next = state.changeSelection.slice();
  next.splice(index, 1);
  patch({ changeSelection: next, feedback: null });
  return store.getState();
}

export function resetChange() {
  patch({ changeSelection: [], feedback: null });
  return store.getState();
}

/** 确认找零。金额必须恰好等于应找金额（不允许负数或不足）。 */
export function submitChange() {
  const state = store.getState();
  const language = getLanguage();
  const { total, lines, payment } = deriveGame(state);
  const target = payment ? payment.change : 0;
  const result = checkChange(state.changeSelection, target);

  if (result.ok) {
    playSound('correct');
    return finishOrder({
      total,
      lines,
      changeLine: target > 0 ? explainChange({ payment: payment.payment, total, change: target }) : ''
    });
  }

  playSound('gentle');
  const feedback =
    result.total < target
      ? t('checkout.remaining', { money: result.remaining }, language)
      : t('checkout.excess', { money: result.excess }, language);
  patch({
    feedback: { kind: 'hint', text: `${t('checkout.wrongChange', {}, language)} ${feedback}` },
    session: { ...state.session, attempts: state.session.attempts + 1, mistakes: state.session.mistakes + 1 }
  });
  return { ok: false, ...result };
}

/** 用数字键盘直接输入找零金额。 */
export function submitChangeAmount(value) {
  const state = store.getState();
  const { payment } = deriveGame(state);
  const target = payment ? payment.change : 0;
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false };
  // 把金额拆成最少的纸币硬币放进找零盘，再统一走同一个校验
  const values = [];
  let rest = amount;
  for (const note of [...(currentRules(state).denominations || [])].sort((a, b) => b - a)) {
    while (rest >= note) {
      values.push(note);
      rest -= note;
    }
  }
  patch({ changeSelection: values, feedback: null });
  if (amount === target) return submitChange();
  playSound('gentle');
  const diff = target - amount;
  patch({
    feedback: {
      kind: 'hint',
      text: `${t('checkout.wrongChange', {}, getLanguage())} ${
        diff > 0
          ? t('checkout.remaining', { money: diff }, getLanguage())
          : t('checkout.excess', { money: -diff }, getLanguage())
      }`
    },
    session: { ...state.session, attempts: state.session.attempts + 1, mistakes: state.session.mistakes + 1 }
  });
  return { ok: false };
}

/** 结算一单：算星星、发金币、解锁装饰。 */
function finishOrder({ total, lines, changeLine }) {
  const state = store.getState();
  const rules = currentRules(state);
  stopTimer();
  const { progress, reward } = applyOrderResult(state.progress, {
    mistakes: state.session.mistakes,
    hintsUsed: state.session.hintsUsed
  });
  const steps = explainLines(lines, rules);

  playSound(reward.stars > 0 ? 'correct' : 'gentle');
  if (reward.newlyUnlocked && reward.newlyUnlocked.length) {
    later(() => playSound('unlock'), 320);
  }

  patch({
    phase: 'result',
    progress,
    reward: { ...reward, steps, changeLine, total },
    feedback: null,
    session: { ...state.session, timerRunning: false }
  });
  return { ok: true, reward, progress };
}

/* ------------------------------------------------------------------ */
/* 计时器（挑战级）                                                     */
/* ------------------------------------------------------------------ */

function startTimer() {
  stopTimer();
  const rules = currentRules();
  if (!rules.timerSeconds) return;
  if (typeof window === 'undefined' || typeof window.setInterval !== 'function') return;
  timerHandle = window.setInterval(() => {
    const state = store.getState();
    if (!state.session.timerRunning) {
      stopTimer();
      return;
    }
    const left = state.session.timerLeft - 1;
    if (left <= 0) {
      stopTimer();
      patch({
        session: { ...state.session, timerLeft: 0, timerRunning: false },
        feedback: { kind: 'hint', text: t('checkout.timerUp') }
      });
      return;
    }
    patch({ session: { ...state.session, timerLeft: left } });
  }, 1000);
}

export function stopTimer() {
  if (timerHandle) {
    if (typeof window !== 'undefined' && typeof window.clearInterval === 'function') {
      window.clearInterval(timerHandle);
    }
    timerHandle = null;
  }
}

/* ------------------------------------------------------------------ */
/* 设置与语言                                                          */
/* ------------------------------------------------------------------ */

/** 切换语言立即生效，并且不清空购物篮或当前订单。 */
export function changeLanguage(language) {
  patch({ language });
  return language;
}

export function toggleSound() {
  const state = store.getState();
  const next = !state.soundEnabled;
  setSoundEnabled(next);
  patch({ soundEnabled: next });
  if (next) playSound('click');
  return next;
}

export function toggleAnimation() {
  const state = store.getState();
  const next = !state.animationEnabled;
  patch({ animationEnabled: next });
  return next;
}

export function setDifficulty(difficulty) {
  const state = store.getState();
  patch({ difficulty });
  if (state.screen === 'game' && isOrderMode(state.gameMode)) {
    createOrder({ rules: resolveRules(difficulty, state.settings) });
  }
  return difficulty;
}

export function updateSettings(partial) {
  const state = store.getState();
  const settings = { ...state.settings, ...partial };
  patch({ settings });
  return settings;
}

export function resetProgress() {
  stopTimer();
  patch({ progress: createProgress() });
  return store.getState().progress;
}

/** 回到首页：保留星星金币，清掉当前这一单。 */
export function goHome() {
  stopTimer();
  store.goHome();
  return store.getState();
}

/** 打开帮助 / 家长设置界面。 */
export function openHelp() {
  patch({ screen: 'help' });
  return store.getState();
}

export function openSettings() {
  patch({ screen: 'settings', session: { ...store.getState().session, timerRunning: false } });
  return store.getState();
}

/** 首页「开始游戏」：按当前难度随机挑一种玩法，做综合练习。 */
export function startMixed() {
  const state = store.getState();
  const pool = MIX_MODES[state.difficulty] || MIX_MODES.easy;
  const mode = pool[Math.floor(Math.random() * pool.length)];
  return startGame(mode);
}

/** 辅助：某样商品在小计里的金额（界面显示「3 × 2 = 6」用）。 */
export function subtotalFor(productId, quantity) {
  return lineSubtotal(productId, quantity);
}

export { selectionTotal };
