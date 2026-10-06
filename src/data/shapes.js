/**
 * 形状数据。
 * svg 字段是 0 0 100 100 视口内的图形，用来画形状徽章。
 * 形状徽章会出现在商品卡片和订单上，保证「形状」不只是文字描述。
 */
export const SHAPES = {
  circle: {
    id: 'circle',
    zh: '圆形',
    en: 'circle',
    svg: '<circle cx="50" cy="50" r="42" />'
  },
  square: {
    id: 'square',
    zh: '正方形',
    en: 'square',
    svg: '<rect x="10" y="10" width="80" height="80" rx="10" />'
  },
  rectangle: {
    id: 'rectangle',
    zh: '长方形',
    en: 'rectangle',
    svg: '<rect x="6" y="24" width="88" height="52" rx="10" />'
  },
  triangle: {
    id: 'triangle',
    zh: '三角形',
    en: 'triangle',
    svg: '<path d="M50 12 L92 88 H8 Z" />'
  },
  star: {
    id: 'star',
    zh: '星形',
    en: 'star',
    svg: '<path d="M50 8 L62 38 H94 L68 58 L78 90 L50 70 L22 90 L32 58 L6 38 H38 Z" />'
  },
  crescent: {
    id: 'crescent',
    zh: '弯月形',
    en: 'crescent',
    svg: '<path d="M64 10a42 42 0 1 0 0 80 34 34 0 1 1 0-80z" />'
  }
};

export const SHAPE_IDS = Object.keys(SHAPES);

/**
 * 形状选择模式只会用到 PRD 里列出的 5 种常见形状。
 * banana 的弯月形只作为商品属性存在，不出题。
 */
export const ORDERABLE_SHAPE_IDS = ['circle', 'square', 'rectangle', 'triangle', 'star'];

export function getShape(id) {
  return SHAPES[id] || null;
}

export function shapeName(id, language) {
  const shape = getShape(id);
  if (!shape) return id;
  return language === 'en' ? shape.en : shape.zh;
}

/** 返回形状徽章的 SVG 字符串；未知形状返回一个中性小圆点。 */
export function shapeBadgeSvg(id) {
  const shape = getShape(id) || { svg: '<circle cx="50" cy="50" r="18" />' };
  return `<svg class="shape-badge__svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${shape.svg}</svg>`;
}
