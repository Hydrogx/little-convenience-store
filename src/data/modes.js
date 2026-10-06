/**
 * 五种玩法（+ 自由购物）的展示数据。
 * label / desc 是 i18n 的键，界面负责翻译，这样切换语言时玩法名称也会跟着变。
 */
export const MODES = [
  { id: 'free', emoji: '🛍️', label: 'mode.free', desc: 'mode.free.desc' },
  { id: 'color', emoji: '🎨', label: 'mode.color', desc: 'mode.color.desc' },
  { id: 'shape', emoji: '🔷', label: 'mode.shape', desc: 'mode.shape.desc' },
  { id: 'count', emoji: '🔢', label: 'mode.count', desc: 'mode.count.desc' },
  { id: 'price', emoji: '🧮', label: 'mode.price', desc: 'mode.price.desc' },
  { id: 'change', emoji: '💰', label: 'mode.change', desc: 'mode.change.desc' }
];

/** 首页「数学练习」里的五种带题目的玩法。 */
export const MATH_MODES = MODES.filter((mode) => mode.id !== 'free');

export function modeById(id) {
  return MODES.find((mode) => mode.id === id) || MODES[0];
}
