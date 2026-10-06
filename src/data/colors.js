/**
 * 颜色数据。
 * 每种颜色除了十六进制值，还带一个「图案标记」(pattern)，
 * 这样色盲或分不清颜色的儿童也能靠图案区分商品 —— 颜色永远不是唯一线索。
 * pattern 对应的 CSS 类写在 styles/base.css 中（.pattern--dots 等）。
 */
export const COLORS = {
  red: { id: 'red', zh: '红色', en: 'red', hex: '#f2545b', ink: '#ffffff', pattern: 'dots' },
  yellow: { id: 'yellow', zh: '黄色', en: 'yellow', hex: '#ffd93d', ink: '#5c4300', pattern: 'stripes' },
  blue: { id: 'blue', zh: '蓝色', en: 'blue', hex: '#5bc0eb', ink: '#0b3d55', pattern: 'grid' },
  green: { id: 'green', zh: '绿色', en: 'green', hex: '#8ed081', ink: '#1f4620', pattern: 'waves' },
  orange: { id: 'orange', zh: '橙色', en: 'orange', hex: '#ff9f45', ink: '#57290a', pattern: 'chevron' },
  brown: { id: 'brown', zh: '咖啡色', en: 'brown', hex: '#b07d4f', ink: '#ffffff', pattern: 'cross' },
  purple: { id: 'purple', zh: '紫色', en: 'purple', hex: '#b28dff', ink: '#331a5c', pattern: 'stars' },
  pink: { id: 'pink', zh: '粉色', en: 'pink', hex: '#ff9ecd', ink: '#5c1039', pattern: 'hearts' },
  white: { id: 'white', zh: '白色', en: 'white', hex: '#fdfdff', ink: '#3b4252', pattern: 'ring' }
};

export const COLOR_IDS = Object.keys(COLORS);

export function getColor(id) {
  return COLORS[id] || null;
}

/** 颜色的本地化名称；未知颜色返回 id 本身，避免界面出现 undefined。 */
export function colorName(id, language) {
  const color = getColor(id);
  if (!color) return id;
  return language === 'en' ? color.en : color.zh;
}
