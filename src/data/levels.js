/**
 * 难度配置。
 * 三档难度的所有数值都写在这里，题目生成器只读这些字段 —— 不把数字写死在界面里。
 *
 * quantityRange   每样商品的数量范围
 * lineItems       订单里最多几种商品
 * totalRange      订单总价的取值范围（生成器会重试直到落入该区间）
 * choices         总价选择题的选项个数（0 表示只用数字键盘）
 * allowChange     默认是否启用找零钱
 * changeCap       找零钱上限
 * payment         'single-note' 一张纸币 / 'round-10' 凑整到十 / 'round-50' 大额付款
 * minChangeSlots  找零钱至少需要几张纸币硬币（挑战级要求组合零钱）
 * timerSeconds    0 表示不限时
 * hintDelayMs     答错后自动显示提示前的等待时间
 */
export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    label: { zh: '简单', en: 'Easy' },
    blurb: {
      zh: '10 以内加减法 · 1-3 件商品 · 找零不超过 10 元',
      en: 'Adding and taking away within 10 · 1-3 items · change up to 10'
    },
    quantityRange: [1, 3],
    lineItems: 1,
    totalRange: [2, 10],
    choices: 3,
    allowChange: true,
    changeCap: 10,
    payment: 'single-note',
    minChangeSlots: 1,
    timerSeconds: 0,
    showMultiplication: false,
    hintDelayMs: 2500,
    denominations: [1, 5],
    paymentNotes: [5, 10, 20]
  },
  standard: {
    id: 'standard',
    label: { zh: '标准', en: 'Standard' },
    blurb: {
      zh: '100 以内加减法 · 两种商品 · 乘法口诀 · 找零不超过 50 元',
      en: 'Add and subtract within 100 · two products · times tables · change up to 50'
    },
    quantityRange: [1, 5],
    lineItems: 2,
    totalRange: [8, 60],
    choices: 4,
    allowChange: true,
    changeCap: 50,
    payment: 'round-10',
    minChangeSlots: 1,
    timerSeconds: 0,
    showMultiplication: true,
    hintDelayMs: 3000,
    denominations: [1, 5, 10, 20],
    paymentNotes: [10, 20, 50, 100]
  },
  challenge: {
    id: 'challenge',
    label: { zh: '挑战', en: 'Challenge' },
    blurb: {
      zh: '三种商品 · 两位数加减 · 组合零钱 · 限时完成订单',
      en: 'Three products · two-digit sums · mixed coins and notes · timed orders'
    },
    quantityRange: [2, 5],
    lineItems: 3,
    totalRange: [25, 99],
    choices: 0,
    allowChange: true,
    changeCap: 100,
    payment: 'round-50',
    minChangeSlots: 2,
    timerSeconds: 90,
    showMultiplication: true,
    hintDelayMs: 4000,
    denominations: [1, 5, 10, 20, 50],
    paymentNotes: [20, 50, 100]
  }
};

export const DIFFICULTY_IDS = ['easy', 'standard', 'challenge'];

/**
 * 「开始游戏」按钮的综合练习会从这些玩法里随机出题。
 * 简单级只出认颜色/形状/数数量；挑战级偏重计算和找零。
 */
export const MIX_MODES = {
  easy: ['color', 'shape', 'count'],
  standard: ['color', 'shape', 'count', 'price', 'change'],
  challenge: ['count', 'price', 'change']
};

export const DEFAULT_DIFFICULTY = 'easy';

export function getDifficulty(id) {
  return DIFFICULTIES[id] || DIFFICULTIES[DEFAULT_DIFFICULTY];
}

export function difficultyLabel(id, language) {
  const level = getDifficulty(id);
  return language === 'en' ? level.label.en : level.label.zh;
}

/** 家长设置里可调的数字范围档位。 */
export const MAX_NUMBER_OPTIONS = [10, 20, 50, 100];

/**
 * 把难度配置与家长设置合并成一份「本次游戏生效的规则」。
 * 家长设置可以收紧难度（例如关闭乘法、关闭找零钱），但不能让题目超出所选难度。
 */
export function resolveRules(difficultyId, settings = {}) {
  const base = getDifficulty(difficultyId);
  const maxNumber = Number.isFinite(settings.maxNumber) ? settings.maxNumber : base.totalRange[1];

  const rules = {
    ...base,
    maxNumber,
    totalRange: [base.totalRange[0], Math.min(base.totalRange[1], maxNumber)],
    allowChange: settings.allowChange === undefined ? base.allowChange : Boolean(settings.allowChange),
    allowMultiplication:
      settings.multiplication === undefined ? base.showMultiplication : Boolean(settings.multiplication),
    showHints: settings.hints === undefined ? true : Boolean(settings.hints),
    timerSeconds: settings.timer === undefined ? base.timerSeconds : settings.timer ? base.timerSeconds : 0,
    advancedPrices: Boolean(settings.advancedPrices)
  };

  if (rules.totalRange[0] > rules.totalRange[1]) {
    rules.totalRange = [1, Math.max(1, rules.totalRange[1])];
  }
  if (!rules.allowChange) {
    rules.changeCap = 0;
    rules.minChangeSlots = 0;
  }
  return rules;
}
