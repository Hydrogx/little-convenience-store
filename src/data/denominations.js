/**
 * 人民币面额数据（只用整数元，低龄儿童不需要一开始就处理小数）。
 * kind 用来区分纸币和硬币，界面据此画不同的样子。
 */
export const DENOMINATIONS = [
  { value: 1, kind: 'coin', zh: '1 元硬币', en: '1 yuan coin', short: { zh: '1 元', en: '¥1' }, tone: '#f4c95d' },
  { value: 5, kind: 'note', zh: '5 元纸币', en: '5 yuan note', short: { zh: '5 元', en: '¥5' }, tone: '#9ad5a0' },
  { value: 10, kind: 'note', zh: '10 元纸币', en: '10 yuan note', short: { zh: '10 元', en: '¥10' }, tone: '#8ecae6' },
  { value: 20, kind: 'note', zh: '20 元纸币', en: '20 yuan note', short: { zh: '20 元', en: '¥20' }, tone: '#f4a261' },
  { value: 50, kind: 'note', zh: '50 元纸币', en: '50 yuan note', short: { zh: '50 元', en: '¥50' }, tone: '#b8a9e8' },
  { value: 100, kind: 'note', zh: '100 元纸币', en: '100 yuan note', short: { zh: '100 元', en: '¥100' }, tone: '#f28ab2' }
];

const BY_VALUE = new Map(DENOMINATIONS.map((item) => [item.value, item]));

export function getDenomination(value) {
  return BY_VALUE.get(value) || null;
}

/** 按面额筛选（例如只给找零盒提供小面额）。 */
export function denominationsIn(values) {
  return values
    .map((value) => getDenomination(value))
    .filter(Boolean)
    .sort((a, b) => a.value - b.value);
}

/** 面额的中文/英文读法；找不到时返回数字本身，保证界面不会出现 undefined。 */
export function denominationLabel(value, language) {
  const item = getDenomination(value);
  if (!item) return String(value);
  return language === 'en' ? item.en : item.zh;
}

/** 面额上的小字：10 元 / ¥10。 */
export function denominationShort(value, language) {
  const item = getDenomination(value);
  if (!item) return String(value);
  return language === 'en' ? item.short.en : item.short.zh;
}
