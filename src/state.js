/**
 * 全局状态 + localStorage 持久化。
 *
 * 只保存「需要记住」的东西：语言、音效、动画、难度、家长设置、星星金币与解锁进度。
 * 不保存任何个人信息，也不上传到任何地方（PRD 13）。
 */
import { DEFAULT_DIFFICULTY, DIFFICULTY_IDS, MAX_NUMBER_OPTIONS } from './data/levels.js';
import { createProgress } from './logic/progress.js';
import { DEFAULT_LANGUAGE, isLanguage } from './i18n/index.js';
import { createCart } from './logic/cart.js';

export const STORAGE_KEY = 'lcs.save.v1';
export const SCHEMA_VERSION = 1;

export const SCREENS = ['home', 'game', 'settings', 'help', 'decor'];
export const PHASES = ['shopping', 'total', 'payment', 'change', 'result'];

/** 家长设置的默认值。 */
export function createSettings() {
  return {
    allowChange: true,
    maxNumber: 100,
    multiplication: true,
    timer: false,
    hints: true,
    advancedPrices: false
  };
}

/** 一局游戏的运行时状态（不写入 localStorage，刷新即重来）。 */
export function createSession() {
  return {
    orderCount: 0,
    attempts: 0,
    mistakes: 0,
    hintsUsed: 0,
    hintVisible: false,
    previousCustomerId: null,
    timerLeft: 0,
    timerRunning: false
  };
}

export function createInitialState() {
  return {
    // —— 会被保存的部分 ——
    language: DEFAULT_LANGUAGE,
    soundEnabled: true,
    animationEnabled: true,
    difficulty: DEFAULT_DIFFICULTY,
    settings: createSettings(),
    progress: createProgress(),

    // —— 只存在于内存的部分 ——
    screen: 'home',
    gameMode: 'free',
    order: null,
    cart: createCart(),
    phase: 'shopping',
    payment: null,
    totalInput: '',
    changeSelection: [],
    answerMode: 'choices',
    reward: null,
    feedback: null,
    session: createSession()
  };
}

function coerceInt(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

/** 校验读回来的存档：任何非法字段都退回默认值，坏存档不会让游戏打不开。 */
export function sanitizeSave(raw) {
  const base = createInitialState();
  if (!raw || typeof raw !== 'object') return base;

  const progress = raw.progress && typeof raw.progress === 'object' ? raw.progress : {};
  const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};

  return {
    ...base,
    language: isLanguage(raw.language) ? raw.language : base.language,
    soundEnabled: raw.soundEnabled === undefined ? base.soundEnabled : Boolean(raw.soundEnabled),
    animationEnabled: raw.animationEnabled === undefined ? base.animationEnabled : Boolean(raw.animationEnabled),
    difficulty: DIFFICULTY_IDS.includes(raw.difficulty) ? raw.difficulty : base.difficulty,
    settings: {
      allowChange:
        settings.allowChange === undefined ? base.settings.allowChange : Boolean(settings.allowChange),
      maxNumber: MAX_NUMBER_OPTIONS.includes(settings.maxNumber) ? settings.maxNumber : base.settings.maxNumber,
      multiplication:
        settings.multiplication === undefined ? base.settings.multiplication : Boolean(settings.multiplication),
      timer: settings.timer === undefined ? base.settings.timer : Boolean(settings.timer),
      hints: settings.hints === undefined ? base.settings.hints : Boolean(settings.hints),
      advancedPrices: Boolean(settings.advancedPrices)
    },
    progress: {
      stars: coerceInt(progress.stars, 0, 0, 999999),
      coins: coerceInt(progress.coins, 0, 0, 999999),
      ordersCompleted: coerceInt(progress.ordersCompleted, 0, 0, 999999),
      streak: coerceInt(progress.streak, 0, 0, 9999),
      bestStreak: coerceInt(progress.bestStreak, 0, 0, 9999),
      mistakes: coerceInt(progress.mistakes, 0, 0, 999999),
      hintsUsed: coerceInt(progress.hintsUsed, 0, 0, 999999),
      unlockedDecor: Array.isArray(progress.unlockedDecor)
        ? progress.unlockedDecor.filter((id) => typeof id === 'string')
        : [],
      lastPlayedAt: typeof progress.lastPlayedAt === 'string' ? progress.lastPlayedAt : null
    }
  };
}

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadSave() {
  const store = storage();
  if (!store) return createInitialState();
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    return { ...sanitizeSave(parsed), screen: 'home' };
  } catch (error) {
    console.warn('[state] 存档无法读取，已使用默认设置', error);
    return createInitialState();
  }
}

/** 挑选出需要写入 localStorage 的字段。 */
export function persistenceSnapshot(state) {
  return {
    version: SCHEMA_VERSION,
    language: state.language,
    soundEnabled: state.soundEnabled,
    animationEnabled: state.animationEnabled,
    difficulty: state.difficulty,
    settings: state.settings,
    progress: state.progress
  };
}

export function saveToStorage(state) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(persistenceSnapshot(state)));
    return true;
  } catch (error) {
    console.warn('[state] 无法写入存档（可能是隐私模式）', error);
    return false;
  }
}

export function clearStorage() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[state] 无法清除存档', error);
  }
}

/** 极简 store：patch 合并 + 订阅通知 + 自动存档。 */
export function createStore(initialState = loadSave()) {
  let state = initialState;
  const listeners = new Set();
  let pendingPersist = null;

  function notify(changedKeys) {
    for (const listener of listeners) {
      try {
        listener(state, changedKeys);
      } catch (error) {
        console.error('[state] listener failed', error);
      }
    }
  }

  function schedulePersist() {
    if (pendingPersist && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(pendingPersist);
      pendingPersist = null;
    }
    saveToStorage(state);
  }

  return {
    getState() {
      return state;
    },
    /** 合并式更新；返回新的 state。 */
    patch(partial) {
      const changedKeys = Object.keys(partial);
      state = { ...state, ...partial };
      notify(changedKeys);
      schedulePersist();
      return state;
    },
    /** 用函数更新（需要读取旧值时更方便）。 */
    update(updater) {
      const partial = updater(state);
      return partial ? this.patch(partial) : state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** 回到首页并保留奖励与设置。 */
    goHome() {
      return this.patch({
        screen: 'home',
        order: null,
        cart: createCart(),
        phase: 'shopping',
        totalInput: '',
        changeSelection: [],
        reward: null,
        feedback: null,
        session: createSession()
      });
    },
    /** 清除进度（家长设置里的按钮）。 */
    resetProgress() {
      return this.patch({ progress: createProgress(), session: createSession() });
    }
  };
}

export const store = createStore();
