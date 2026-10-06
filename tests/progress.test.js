/**
 * 奖励、进度与状态持久化测试。
 * 规则：答错绝不扣已经拿到的奖励（PRD 11.2）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProgress,
  starsFor,
  coinsFor,
  applyOrderResult,
  recordAttempt,
  breakStreak,
  MAX_STARS_PER_ORDER
} from '../src/logic/progress.js';
import { DECORATIONS, nextDecoration, unlockedDecorations } from '../src/data/decorations.js';
import {
  createInitialState,
  createSettings,
  sanitizeSave,
  persistenceSnapshot,
  saveToStorage,
  loadSave,
  STORAGE_KEY
} from '../src/state.js';

test('星星规则：一次做对 3 颗，答错或看提示会少一些但至少 1 颗', () => {
  assert.equal(starsFor({ mistakes: 0, hintsUsed: 0 }), 3);
  assert.equal(starsFor({ mistakes: 1, hintsUsed: 0 }), 2);
  assert.equal(starsFor({ mistakes: 0, hintsUsed: 1 }), 2);
  assert.equal(starsFor({ mistakes: 2, hintsUsed: 0 }), 1);
  assert.equal(starsFor({ mistakes: 9, hintsUsed: 9 }), 1);
  assert.ok(starsFor({ mistakes: 9 }) <= MAX_STARS_PER_ORDER);
});

test('金币 = 星星 × 5 + 连对奖励', () => {
  assert.equal(coinsFor(3, 0), 15);
  assert.equal(coinsFor(3, 4), 19);
  assert.equal(coinsFor(1, 1), 6);
  assert.equal(coinsFor(3, 99), 20);
});

test('每完成一单都会增加星星、金币和订单数，绝不会减少', () => {
  let progress = createProgress();
  let previousStars = 0;
  let previousCoins = 0;
  for (let i = 0; i < 12; i += 1) {
    const { progress: next } = applyOrderResult(progress, { mistakes: i % 3, hintsUsed: i % 2 });
    assert.ok(next.stars >= previousStars, '星星不能变少');
    assert.ok(next.coins >= previousCoins, '金币不能变少');
    assert.equal(next.ordersCompleted, progress.ordersCompleted + 1);
    previousStars = next.stars;
    previousCoins = next.coins;
    progress = next;
  }
  assert.ok(progress.ordersCompleted === 12);
  assert.ok(progress.bestStreak >= 1);
});

test('连对中断只清空连对，不扣星星和金币', () => {
  const { progress } = applyOrderResult(createProgress(), { mistakes: 0 });
  const broken = breakStreak(progress);
  assert.equal(broken.streak, 0);
  assert.equal(broken.stars, progress.stars);
  assert.equal(broken.coins, progress.coins);
});

test('答错只记录，不影响已有奖励', () => {
  const progress = applyOrderResult(createProgress(), { mistakes: 0 }).progress;
  const after = recordAttempt(progress, { correct: false, hint: true });
  assert.equal(after.stars, progress.stars);
  assert.equal(after.coins, progress.coins);
  assert.equal(after.mistakes, progress.mistakes + 1);
  assert.equal(after.hintsUsed, progress.hintsUsed + 1);
});

test('完成订单会按里程碑解锁装饰', () => {
  assert.deepEqual(unlockedDecorations(0), []);
  const first = DECORATIONS[0];
  assert.deepEqual(unlockedDecorations(first.unlockAt), [first.id]);

  let progress = createProgress();
  const unlocked = [];
  for (let i = 0; i < 30; i += 1) {
    const result = applyOrderResult(progress, { mistakes: 0 });
    progress = result.progress;
    unlocked.push(...result.reward.newlyUnlocked);
  }
  assert.equal(new Set(unlocked).size, unlocked.length, '同一个装饰不应该重复解锁');
  assert.equal(progress.unlockedDecor.length, DECORATIONS.length);
  assert.equal(nextDecoration(progress.ordersCompleted), null);
});

test('初始状态包含 PRD 14.3 要求的全部字段', () => {
  const state = createInitialState();
  // 直接状态
  assert.equal(state.language, 'zh');
  assert.equal(state.difficulty, 'easy');
  assert.equal(state.gameMode, 'free');
  assert.equal(state.soundEnabled, true);
  assert.equal(state.animationEnabled, true);
  assert.deepEqual(state.cart, []);
  assert.deepEqual(state.changeSelection, []);
  assert.equal(state.payment, null);
  assert.equal(state.phase, 'shopping');
  // 奖励与进度（stars / coins / score）
  assert.equal(state.progress.stars, 0);
  assert.equal(state.progress.coins, 0);
  assert.equal(state.progress.ordersCompleted, 0);
  // currentCustomer / products 分别由订单和商品数据模块提供
  assert.equal(state.order, null);
  assert.equal(state.session.previousCustomerId, null);
});

test('存档只保存需要的字段，并且能原样读回来', () => {
  const fake = new Map();
  globalThis.localStorage = {
    getItem: (key) => (fake.has(key) ? fake.get(key) : null),
    setItem: (key, value) => fake.set(key, String(value)),
    removeItem: (key) => fake.delete(key)
  };

  const state = {
    ...createInitialState(),
    language: 'en',
    difficulty: 'challenge',
    soundEnabled: false,
    animationEnabled: false,
    settings: { ...createSettings(), allowChange: false, maxNumber: 20, timer: true },
    progress: { ...createProgress(), stars: 42, coins: 99, ordersCompleted: 7, unlockedDecor: ['flag'] }
  };
  assert.equal(saveToStorage(state), true);

  const saved = JSON.parse(fake.get(STORAGE_KEY));
  assert.equal(saved.version, 1);
  assert.deepEqual(Object.keys(persistenceSnapshot(state)).sort(), [
    'animationEnabled',
    'difficulty',
    'language',
    'progress',
    'settings',
    'soundEnabled',
    'version'
  ]);
  assert.equal('cart' in saved, false, '购物篮不应该写进存档');

  const loaded = loadSave();
  assert.equal(loaded.language, 'en');
  assert.equal(loaded.difficulty, 'challenge');
  assert.equal(loaded.soundEnabled, false);
  assert.equal(loaded.settings.maxNumber, 20);
  assert.equal(loaded.progress.stars, 42);
  assert.deepEqual(loaded.progress.unlockedDecor, ['flag']);
  assert.equal(loaded.screen, 'home');

  delete globalThis.localStorage;
});

test('坏存档、缺字段、非法取值都会安全地退回默认值', () => {
  assert.deepEqual(sanitizeSave(null).language, 'zh');
  assert.deepEqual(sanitizeSave('这不是对象').difficulty, 'easy');
  assert.deepEqual(sanitizeSave({}).settings, createSettings());

  const messy = sanitizeSave({
    language: 'klingon',
    difficulty: 'impossible',
    soundEnabled: 'yes',
    settings: { maxNumber: 37, allowChange: 'maybe' },
    progress: { stars: -50, coins: 'x', ordersCompleted: 3.7, unlockedDecor: 'nope' }
  });
  assert.equal(messy.language, 'zh');
  assert.equal(messy.difficulty, 'easy');
  assert.equal(messy.soundEnabled, true);
  assert.equal(messy.settings.maxNumber, 100, '非法数字范围应退回默认值');
  assert.equal(messy.settings.allowChange, true);
  assert.equal(messy.progress.stars, 0);
  assert.equal(messy.progress.coins, 0);
  assert.equal(messy.progress.ordersCompleted, 4);
  assert.deepEqual(messy.progress.unlockedDecor, []);
});

test('没有 localStorage 时（隐私模式）游戏依然能初始化', () => {
  const blocked = { getItem: () => { throw new Error('blocked'); } };
  const originalStorage = globalThis.localStorage;
  const originalWarn = console.warn;
  console.warn = () => {}; // 这里预期会打警告，测试输出保持干净
  globalThis.localStorage = blocked;
  try {
    assert.doesNotThrow(() => loadSave());
    assert.equal(loadSave().language, 'zh');
  } finally {
    globalThis.localStorage = originalStorage;
    console.warn = originalWarn;
  }
});
