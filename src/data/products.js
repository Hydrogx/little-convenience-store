/**
 * 商品数据 —— 唯一的商品真相来源。
 * 新增商品只需要在这里加一条数据 + 一个 assets/products/<id>.svg，
 * 界面、题目、购物篮、收银台都会自动支持。
 *
 * 字段说明：
 *   id        唯一标识（也对应 assets/products/<id>.svg）
 *   name      { zh, en } 双语名称
 *   enPlural  英文复数形式（"2 apples" 这类句子需要）
 *   price     整数单价（元），默认难度使用
 *   color     主颜色 id，见 src/data/colors.js
 *   shape     形状 id，见 src/data/shapes.js
 *   maxQty    单次最多可购买数量
 *   unlocked  是否默认解锁
 *   emoji     无障碍/兜底用的表情符号
 *   sound     加入购物篮时的音效名，见 src/audio.js
 */
export const PRODUCTS = [
  {
    id: 'apple',
    name: { zh: '苹果', en: 'Apple' },
    enPlural: 'apples',
    price: 3,
    color: 'red',
    shape: 'circle',
    maxQty: 8,
    unlocked: true,
    emoji: '🍎',
    sound: 'pop'
  },
  {
    id: 'banana',
    name: { zh: '香蕉', en: 'Banana' },
    enPlural: 'bananas',
    price: 2,
    color: 'yellow',
    shape: 'crescent',
    maxQty: 8,
    unlocked: true,
    emoji: '🍌',
    sound: 'pop'
  },
  {
    id: 'cookie',
    name: { zh: '饼干', en: 'Cookie' },
    enPlural: 'cookies',
    price: 4,
    color: 'brown',
    shape: 'circle',
    maxQty: 6,
    unlocked: true,
    emoji: '🍪',
    sound: 'pop'
  },
  {
    id: 'candy',
    name: { zh: '糖果', en: 'Candy' },
    enPlural: 'candies',
    price: 2,
    color: 'yellow',
    shape: 'circle',
    maxQty: 10,
    unlocked: true,
    emoji: '🍬',
    sound: 'pop'
  },
  {
    id: 'drink',
    name: { zh: '饮料', en: 'Drink' },
    enPlural: 'drinks',
    price: 5,
    color: 'blue',
    shape: 'rectangle',
    maxQty: 6,
    unlocked: true,
    emoji: '🥤',
    sound: 'pop'
  },
  {
    id: 'milk',
    name: { zh: '牛奶', en: 'Milk' },
    enPlural: 'cartons of milk',
    price: 6,
    color: 'white',
    shape: 'rectangle',
    maxQty: 6,
    unlocked: true,
    emoji: '🥛',
    sound: 'pop'
  },
  {
    id: 'juice',
    name: { zh: '果汁', en: 'Juice' },
    enPlural: 'boxes of juice',
    price: 7,
    color: 'orange',
    shape: 'rectangle',
    maxQty: 6,
    unlocked: true,
    emoji: '🧃',
    sound: 'pop'
  },
  {
    id: 'sandwich',
    name: { zh: '三明治', en: 'Sandwich' },
    enPlural: 'sandwiches',
    price: 8,
    color: 'green',
    shape: 'triangle',
    maxQty: 4,
    unlocked: true,
    emoji: '🥪',
    sound: 'pop'
  },
  {
    id: 'cheese',
    name: { zh: '奶酪', en: 'Cheese' },
    enPlural: 'pieces of cheese',
    price: 2,
    color: 'yellow',
    shape: 'square',
    maxQty: 6,
    unlocked: true,
    emoji: '🧀',
    sound: 'pop'
  },
  {
    id: 'chocolate',
    name: { zh: '巧克力', en: 'Chocolate' },
    enPlural: 'chocolate bars',
    price: 3,
    color: 'brown',
    shape: 'square',
    maxQty: 6,
    unlocked: true,
    emoji: '🍫',
    sound: 'pop'
  },
  {
    id: 'sticker',
    name: { zh: '贴纸', en: 'Sticker' },
    enPlural: 'stickers',
    price: 1,
    color: 'purple',
    shape: 'star',
    maxQty: 10,
    unlocked: true,
    emoji: '⭐',
    sound: 'pop'
  },
  {
    id: 'starCookie',
    name: { zh: '星星饼干', en: 'Star Cookie' },
    enPlural: 'star cookies',
    price: 3,
    color: 'pink',
    shape: 'star',
    maxQty: 6,
    unlocked: true,
    emoji: '🌟',
    sound: 'pop'
  }
];

const BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]));

export const PRODUCT_IDS = PRODUCTS.map((product) => product.id);

export function getProduct(id) {
  return BY_ID.get(id) || null;
}

export function productName(id, language) {
  const product = getProduct(id);
  if (!product) return id;
  return language === 'en' ? product.name.en : product.name.zh;
}

export function productPrice(id) {
  const product = getProduct(id);
  return product ? product.price : 0;
}

/**
 * 带数量的商品名。
 * 中文用量词「个」，英文用复数形式（milk 这类不可数名词用量词短语），
 * 保证中英文句子都自然，不会出现 "2 milk" 这种生硬表达。
 */
export function productLabel(id, language, quantity = 1) {
  const product = getProduct(id);
  if (!product) return id;
  if (language === 'en' && quantity > 1) return product.enPlural || `${product.name.en}s`;
  return language === 'en' ? product.name.en : product.name.zh;
}

export function productArtPath(id) {
  return `assets/products/${id}.svg`;
}

/** 默认解锁的商品；预留给后续「靠玩解锁新商品」的扩展。 */
export function unlockedProducts() {
  return PRODUCTS.filter((product) => product.unlocked);
}

/** 某种颜色的全部商品 id。 */
export function productsByColor(colorId) {
  return PRODUCTS.filter((product) => product.color === colorId).map((product) => product.id);
}

/** 某种形状的全部商品 id。 */
export function productsByShape(shapeId) {
  return PRODUCTS.filter((product) => product.shape === shapeId).map((product) => product.id);
}
