/**
 * 轻量随机数工具。
 * 所有题目生成都必须走这里注入的 rng，这样测试可以用固定种子复现同一批题目。
 */

/** mulberry32：小巧的可播种伪随机数发生器，返回 [0, 1)。 */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 默认 rng：包装 Math.random，保持与其他 rng 相同的调用方式。 */
export function defaultRandom() {
  return Math.random();
}

/** 生成 [min, max] 闭区间内的整数。 */
export function randInt(rng, min, max) {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  if (hi <= lo) return lo;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** 从数组里等概率取一个元素。 */
export function pick(rng, list) {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  return list[randInt(rng, 0, list.length - 1)];
}

/** 不重复地取 count 个元素（count 大于数组长度时返回打乱后的全部）。 */
export function pickMany(rng, list, count) {
  return shuffle(rng, list).slice(0, Math.max(0, Math.min(count, list.length)));
}

/** Fisher-Yates 洗牌，返回新数组。 */
export function shuffle(rng, list) {
  const result = list.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randInt(rng, 0, i);
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/** 概率为 probability 时返回 true。 */
export function chance(rng, probability) {
  return rng() < probability;
}

/** 把数字夹在 [min, max] 之间。 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
