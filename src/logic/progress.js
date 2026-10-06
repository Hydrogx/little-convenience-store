/**
 * 奖励与进度 —— 星星、金币、连对、装饰解锁。
 * 规则要点：答错绝不扣除已经得到的奖励（PRD 11.2）。
 */
import { DECORATIONS, unlockedDecorations, nextDecoration } from '../data/decorations.js';

export const MAX_STARS_PER_ORDER = 3;

/** 初始进度。 */
export function createProgress() {
  return {
    stars: 0,
    coins: 0,
    ordersCompleted: 0,
    streak: 0,
    bestStreak: 0,
    mistakes: 0,
    hintsUsed: 0,
    unlockedDecor: [],
    lastPlayedAt: null
  };
}

/**
 * 一颗订单能拿几颗星：
 * 一次做对 3 颗；提示过或错过一次 2 颗；再差也有 1 颗（鼓励为主）。
 */
export function starsFor({ mistakes = 0, hintsUsed = 0 } = {}) {
  const penalty = Math.min(2, mistakes + (hintsUsed > 0 ? 1 : 0));
  return Math.max(1, MAX_STARS_PER_ORDER - penalty);
}

/** 金币 = 星星 × 5 + 连对奖励（最多 +5）。 */
export function coinsFor(stars, streak = 0) {
  const safeStars = Math.max(0, Math.min(MAX_STARS_PER_ORDER, Math.round(stars)));
  const bonus = Math.min(5, Math.max(0, Math.round(streak)));
  return safeStars * 5 + bonus;
}

/** 累计答题次数（不影响已有奖励，只做统计）。 */
export function recordAttempt(progress, { correct = false, hint = false } = {}) {
  return {
    ...progress,
    mistakes: correct ? progress.mistakes : progress.mistakes + 1,
    hintsUsed: hint ? progress.hintsUsed + 1 : progress.hintsUsed
  };
}

/**
 * 完成一单后结算奖励。
 * 返回 { progress, reward }，reward 用来播动画和弹结果页。
 */
export function applyOrderResult(progress, { mistakes = 0, hintsUsed = 0 } = {}) {
  const stars = starsFor({ mistakes, hintsUsed });
  const streak = progress.streak + 1;
  const coins = coinsFor(stars, streak);
  const ordersCompleted = progress.ordersCompleted + 1;
  const unlockedDecor = unlockedDecorations(ordersCompleted);

  const next = {
    ...progress,
    stars: progress.stars + stars,
    coins: progress.coins + coins,
    ordersCompleted,
    streak,
    bestStreak: Math.max(progress.bestStreak, streak),
    mistakes: progress.mistakes + mistakes,
    hintsUsed: progress.hintsUsed + hintsUsed,
    unlockedDecor,
    lastPlayedAt: new Date().toISOString()
  };

  const newlyUnlocked = next.unlockedDecor.filter((id) => !progress.unlockedDecor.includes(id));
  return {
    progress: next,
    reward: { stars, coins, streak, newlyUnlocked, decoration: nextDecoration(ordersCompleted) }
  };
}

/** 连对中断（例如中途放弃订单），只清空连对，不扣星星金币。 */
export function breakStreak(progress) {
  return { ...progress, streak: 0 };
}

export function decorationLabel(id, language) {
  const item = DECORATIONS.find((entry) => entry.id === id);
  if (!item) return id;
  return language === 'en' ? item.name.en : item.name.zh;
}
