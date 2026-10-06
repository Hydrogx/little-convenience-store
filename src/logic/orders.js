/**
 * 题目（顾客订单）生成器 —— 完全由数据 + 随机规则产生，界面上不写死任何答案数字。
 *
 * 订单结构：
 * {
 *   id, mode, customerId,
 *   constraint: { type: 'color' | 'shape' | 'product' | 'items', value, productId? },
 *   quantity,                        // 约束型订单需要的总件数
 *   lines: [{ productId, quantity }] // 清单型订单（算总价 / 找零钱）的固定内容
 * }
 */
import { COLORS, COLOR_IDS } from '../data/colors.js';
import { ORDERABLE_SHAPE_IDS } from '../data/shapes.js';
import { PRODUCTS, unlockedProducts, getProduct, productsByColor, productsByShape } from '../data/products.js';
import { CUSTOMERS } from '../data/customers.js';
import { defaultRandom, pick, randInt, shuffle, clamp } from './rng.js';
import { lineSubtotal } from './cart.js';

/** 五种玩法：自由购物不生成订单，其余都会产生顾客需求。 */
export const GAME_MODES = ['free', 'color', 'shape', 'count', 'price', 'change'];

/** 需要顾客订单的玩法。 */
export const ORDER_MODES = ['color', 'shape', 'count', 'price', 'change'];

export function isOrderMode(mode) {
  return ORDER_MODES.includes(mode);
}

let orderCounter = 0;

/** 生成一位顾客（尽量不和上一位重复）。 */
export function pickCustomer(rng = defaultRandom, excludeId = null) {
  const pool = CUSTOMERS.filter((customer) => customer.id !== excludeId);
  return pick(rng, pool.length ? pool : CUSTOMERS).id;
}

/**
 * 某样商品在当前难度下「最多能买多少」——同时受商品自身的 maxQty 和难度的数量上限约束。
 * 题目生成必须按这个上限来估算，否则会出现无解的题目（怎么加都够不到要求的金额）。
 */
function effectiveMax(product, rules) {
  return Math.max(1, Math.min(rules.quantityRange[1], product.maxQty));
}

function potentialOf(product, rules) {
  return effectiveMax(product, rules) * product.price;
}

function maxPotential(lines, rules) {
  return lines.reduce((sum, line) => {
    const product = getProduct(line.productId);
    return sum + (product ? potentialOf(product, rules) : 0);
  }, 0);
}

function priceOf(productId) {
  const product = getProduct(productId);
  return product ? product.price : 0;
}

function maxQtyOf(productId) {
  const product = getProduct(productId);
  return product ? product.maxQty : 0;
}

function totalOf(lines) {
  return lines.reduce((sum, line) => sum + lineSubtotal(line.productId, line.quantity), 0);
}

/**
 * 挑选清单型订单的商品。
 * 会保证「把所有数量加到上限」时能达到难度要求的金额下限，否则题目会无解。
 */
function chooseLineProducts(rng, count, minTotal, rules) {
  const pool = shuffle(rng, unlockedProducts());
  const chosen = pool.slice(0, Math.max(1, Math.min(count, pool.length))).map((product) => ({
    productId: product.id,
    quantity: 1
  }));

  let guard = 0;
  while (maxPotential(chosen, rules) < minTotal && guard < 80) {
    guard += 1;
    let weakest = 0;
    for (let i = 1; i < chosen.length; i += 1) {
      if (
        potentialOf(getProduct(chosen[i].productId), rules) <
        potentialOf(getProduct(chosen[weakest].productId), rules)
      ) {
        weakest = i;
      }
    }
    const used = new Set(chosen.map((line) => line.productId));
    const options = unlockedProducts().filter(
      (product) =>
        !used.has(product.id) && potentialOf(product, rules) > potentialOf(getProduct(chosen[weakest].productId), rules)
    );
    if (!options.length) {
      // 没有更「有潜力」的替换品，就再加一样商品，保证题目一定做得出
      const extra = unlockedProducts().find((product) => !used.has(product.id));
      if (!extra) break;
      chosen.push({ productId: extra.id, quantity: 1 });
      continue;
    }
    chosen[weakest] = { productId: pick(rng, options).id, quantity: 1 };
  }
  return chosen;
}

/**
 * 把数量微调进难度要求的金额区间。
 * 单位价格都远小于区间宽度，所以「一次加一份 / 减一份」不会冲出区间。
 */
function fitTotal(lines, rules) {
  const [low, high] = rules.totalRange;
  const floor = Math.max(1, rules.quantityRange[0]);
  const ceiling = (productId) => Math.min(rules.quantityRange[1], maxQtyOf(productId));
  const work = lines.map((line) => ({ ...line }));
  let total = totalOf(work);
  let guard = 0;

  while (total < low && guard < 400) {
    guard += 1;
    const growable = work.filter((line) => line.quantity < ceiling(line.productId));
    if (!growable.length) break;
    growable.sort((a, b) => priceOf(b.productId) - priceOf(a.productId));
    const target = growable.find((line) => total + priceOf(line.productId) <= high) || null;
    if (!target) break;
    target.quantity += 1;
    total += priceOf(target.productId);
  }

  guard = 0;
  while (total > high && guard < 400) {
    guard += 1;
    const shrinkable = work.filter((line) => line.quantity > floor);
    if (!shrinkable.length) {
      if (work.length > 1) {
        // 数量都降到 1 还是太贵，就去掉一行
        const cheapest = work.reduce(
          (min, line) => (priceOf(line.productId) < priceOf(min.productId) ? line : min),
          work[0]
        );
        work.splice(work.indexOf(cheapest), 1);
        total = totalOf(work);
        continue;
      }
      break;
    }
    shrinkable.sort((a, b) => priceOf(b.productId) - priceOf(a.productId));
    shrinkable[0].quantity -= 1;
    total = totalOf(work);
  }

  return work;
}

/** 颜色模式：只要颜色对、件数对就可以，允许用同色的其他商品。 */
function generateColorOrder(rules, rng) {
  const candidates = COLOR_IDS.map((colorId) => {
    const ids = productsByColor(colorId);
    const maxQty = ids.reduce((max, id) => Math.max(max, maxQtyOf(id)), 0);
    return { colorId, maxQty };
  }).filter((item) => item.colorId in COLORS && item.maxQty >= rules.quantityRange[0]);

  const chosen = pick(rng, candidates) || candidates[0];
  const quantity = randInt(rng, rules.quantityRange[0], Math.min(rules.quantityRange[1], chosen.maxQty));
  return {
    constraint: { type: 'color', value: chosen.colorId },
    quantity
  };
}

/** 形状模式：一半的题会指定具体商品，另一半只要形状对。 */
function generateShapeOrder(rules, rng) {
  const candidates = ORDERABLE_SHAPE_IDS.map((shapeId) => {
    const ids = productsByShape(shapeId);
    const maxQty = ids.reduce((max, id) => Math.max(max, maxQtyOf(id)), 0);
    return { shapeId, ids, maxQty };
  }).filter((item) => item.ids.length && item.maxQty >= rules.quantityRange[0]);

  const chosen = pick(rng, candidates) || candidates[0];
  const specific = rng() < 0.5;
  if (specific) {
    const affordable = chosen.ids
      .map((id) => getProduct(id))
      .filter((product) => product.maxQty >= rules.quantityRange[0]);
    const product = pick(rng, affordable.length ? affordable : chosen.ids.map((id) => getProduct(id)));
    return {
      constraint: { type: 'shape', value: chosen.shapeId, productId: product.id },
      quantity: randInt(rng, rules.quantityRange[0], Math.min(rules.quantityRange[1], product.maxQty))
    };
  }
  return {
    constraint: { type: 'shape', value: chosen.shapeId },
    quantity: randInt(rng, rules.quantityRange[0], Math.min(rules.quantityRange[1], chosen.maxQty))
  };
}

/** 数量模式：指定商品 + 指定件数。 */
function generateCountOrder(rules, rng) {
  const candidates = unlockedProducts().filter((product) => product.maxQty >= rules.quantityRange[0]);
  const product = pick(rng, candidates.length ? candidates : PRODUCTS);
  const quantity = randInt(rng, rules.quantityRange[0], Math.min(rules.quantityRange[1], product.maxQty));
  return {
    constraint: { type: 'product', value: product.id, productId: product.id },
    quantity
  };
}

/** 算总价 / 找零钱模式：固定清单，答案由程序计算。 */
function generateItemsOrder(rules, rng) {
  const lineCount = randInt(rng, 1, Math.max(1, rules.lineItems));
  const chosen = chooseLineProducts(rng, lineCount, rules.totalRange[0], rules);
  for (const line of chosen) {
    line.quantity = clamp(
      rules.quantityRange[0],
      1,
      Math.min(rules.quantityRange[1], maxQtyOf(line.productId))
    );
  }
  const lines = fitTotal(chosen, rules);
  return {
    constraint: { type: 'items', value: 'items' },
    quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    lines
  };
}

/**
 * 生成一道订单。
 * @param {object} options
 * @param {'color'|'shape'|'count'|'price'|'change'} options.mode
 * @param {object} options.rules  resolveRules() 的结果
 * @param {Function} [options.rng]
 * @param {string|null} [options.previousCustomerId]
 */
export function generateOrder({ mode = 'count', rules, rng = defaultRandom, previousCustomerId = null } = {}) {
  if (!rules) throw new Error('generateOrder 需要一个 rules 配置（见 resolveRules）');
  const safeMode = ORDER_MODES.includes(mode) ? mode : 'count';

  let base;
  if (safeMode === 'color') base = generateColorOrder(rules, rng);
  else if (safeMode === 'shape') base = generateShapeOrder(rules, rng);
  else if (safeMode === 'count') base = generateCountOrder(rules, rng);
  else base = generateItemsOrder(rules, rng);

  orderCounter += 1;
  const order = {
    id: `order-${Date.now().toString(36)}-${orderCounter}`,
    mode: safeMode,
    customerId: pickCustomer(rng, previousCustomerId),
    fixedLines: base.constraint.type === 'items',
    ...base
  };

  if (order.fixedLines) {
    order.answer = { total: totalOf(order.lines), lines: order.lines.map((line) => ({ ...line })) };
  }
  return order;
}

/**
 * 结账时真正要结算的清单。
 * 清单型订单用生成时定好的内容；约束型订单用孩子实际选的购物篮 —— 选什么就买什么。
 */
export function resolveOrderLines(order, cart) {
  if (!order) return [];
  if (order.fixedLines) return order.lines.map((line) => ({ ...line }));
  return (cart || []).map((line) => ({ ...line }));
}

/** 订单总价（程序计算，绝不硬编码）。 */
export function resolveOrderTotal(order, cart) {
  return totalOf(resolveOrderLines(order, cart));
}

/** 逐行展示计算过程，答对后告诉孩子「为什么是这个答案」。 */
export function explainLines(lines, rules = {}) {
  const steps = [];
  for (const line of lines) {
    const product = getProduct(line.productId);
    if (!product) continue;
    const subtotal = product.price * line.quantity;
    const repeated = Array.from({ length: line.quantity }, () => product.price);
    steps.push({
      type: 'line',
      productId: line.productId,
      unitPrice: product.price,
      quantity: line.quantity,
      subtotal,
      showMultiply: line.quantity > 1 && rules.allowMultiplication !== false,
      multiplyText: `${line.quantity} × ${product.price} = ${subtotal}`,
      repeatedText: `${repeated.join(' + ')} = ${subtotal}`
    });
  }
  const total = steps.reduce((sum, step) => sum + step.subtotal, 0);
  steps.push({ type: 'total', total });
  return steps;
}

/** 找零的计算过程：付款 − 总价 = 找零。 */
export function explainChange({ payment, total, change }) {
  return `${payment} − ${total} = ${change}`;
}
