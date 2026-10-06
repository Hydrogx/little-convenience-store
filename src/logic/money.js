/**
 * 钱的计算 —— 面额拆分、付款方案、找零校验、总价选项。
 * 纯函数，可单元测试。金额单位一律是整数「元」。
 */
import { DENOMINATIONS, denominationsIn, getDenomination } from '../data/denominations.js';
import { t } from '../i18n/index.js';
import { randInt, pick, shuffle } from './rng.js';

/** 把金额写成人看得懂的样子：3 元 / 3 yuan。文案来自 i18n 字典，界面语言切换后自动跟随。 */
export function formatYuan(amount, language = 'zh') {
  const value = Math.round(Number(amount) || 0);
  return t('money.yuan', { n: value }, language);
}

/** 金额数字（不带单位），用于大字号展示。 */
export function amountNumber(amount) {
  return String(Math.round(Number(amount) || 0));
}

/**
 * 贪心拆分面额 —— 用最少的张数凑出 amount。
 * 返回 [{ value, kind, count }]，按面额从大到小排列。
 */
export function breakdown(amount, allowedValues) {
  const allowed = (allowedValues && allowedValues.length ? allowedValues : DENOMINATIONS.map((d) => d.value))
    .slice()
    .sort((a, b) => b - a);
  let rest = Math.max(0, Math.round(Number(amount) || 0));
  const result = [];
  for (const value of allowed) {
    if (rest <= 0) break;
    if (value <= 0) continue;
    const count = Math.floor(rest / value);
    if (count > 0) {
      const info = getDenomination(value);
      result.push({ value, kind: info ? info.kind : 'note', count });
      rest -= count * value;
    }
  }
  return result;
}

/** 拆分需要的最少张数；无法凑出时返回 Infinity。 */
export function breakdownSlots(amount, allowedValues) {
  const parts = breakdown(amount, allowedValues);
  const covered = parts.reduce((sum, part) => sum + part.value * part.count, 0);
  if (covered !== Math.round(Number(amount) || 0)) return Number.POSITIVE_INFINITY;
  return parts.reduce((sum, part) => sum + part.count, 0);
}

/** 付款方案：为总价挑一张（或几张）纸币，并算出应找零钱。 */
export function planPayment(total, rules, rng) {
  const paymentNotes = (rules.paymentNotes || [10, 20, 50]).slice().sort((a, b) => a - b);
  const drawer = rules.denominations || [1, 5, 10];
  const cap = Number.isFinite(rules.changeCap) && rules.changeCap > 0 ? rules.changeCap : 10;
  const minSlots = Number.isFinite(rules.minChangeSlots) ? rules.minChangeSlots : 0;
  const safeTotal = Math.max(0, Math.round(total));

  const candidates = paymentNotes.filter((note) => note > safeTotal);
  const viable = candidates.filter((note) => {
    const change = note - safeTotal;
    if (change < 1 || change > cap) return false;
    if (minSlots > 0 && breakdownSlots(change, drawer) < minSlots) return false;
    return true;
  });

  let payment = viable.length ? viable[0] : null;

  if (payment === null) {
    // 放宽「组合零钱」的要求，只要找零不超出上限即可
    const loose = candidates.filter((note) => {
      const change = note - safeTotal;
      return change >= 1 && change <= cap;
    });
    payment = loose.length ? loose[0] : null;
  }
  if (payment === null && candidates.length) payment = candidates[0];
  if (payment === null) payment = safeTotal; // 没有更大的纸币时按原价支付，找零为 0

  const change = payment - safeTotal;
  return {
    payment,
    change: Math.max(0, change),
    notes: breakdown(payment, paymentNotes),
    exact: change <= 0
  };
}

/** 玩家投入零钱盒的金额合计。 */
export function selectionTotal(values) {
  if (!values || !values.length) return 0;
  return values.reduce((sum, value) => sum + (Number(value) || 0), 0);
}

/** 统计玩家选的每张钱的数量，用于在零钱盒里显示 3×1 元。 */
export function selectionCounts(values) {
  const counts = new Map();
  for (const value of values || []) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.value - a.value);
}

/**
 * 找零校验：还差多少 / 多了多少。
 * 提供 remaining 和 excess 两个数字，界面按儿童语言翻译，不使用「错误」字眼。
 */
export function checkChange(selection, target) {
  const total = selectionTotal(selection);
  const wanted = Math.max(0, Math.round(target));
  return {
    ok: total === wanted,
    total,
    target: wanted,
    remaining: Math.max(0, wanted - total),
    excess: Math.max(0, total - wanted)
  };
}

/** 总价选择题的选项：正确答案 + 若干个「像是对的」干扰项。 */
export function totalChoices(total, count, rng) {
  if (!count || count < 2) return null;
  const answer = Math.round(total);
  const offsets = [1, -1, 2, -2, 10, -10, 5, -5, 3, -3, 4, -4];
  const pool = [];
  for (const offset of offsets) {
    const value = answer + offset;
    if (value > 0 && value !== answer && !pool.includes(value)) pool.push(value);
  }
  const chosen = shuffle(rng, pool).slice(0, Math.max(0, count - 1));
  return shuffle(rng, [answer, ...chosen]);
}

/** 用于「读数」题：把总价读成最大面额组合，帮助孩子理解钱的大小。 */
export function biggestNoteFor(amount, allowedValues) {
  const allowed = denominationsIn(allowedValues || DENOMINATIONS.map((d) => d.value)).filter(
    (item) => item.value <= amount
  );
  return allowed.length ? allowed[allowed.length - 1] : null;
}

/** 随机取一个零钱盒里的面额（兜底提示用）。 */
export function randomDenomination(rng, allowedValues) {
  const allowed = denominationsIn(allowedValues || DENOMINATIONS.map((d) => d.value));
  if (!allowed.length) return null;
  return pick(rng, allowed).value;
}

export { randInt };
