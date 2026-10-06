/**
 * 购物篮与价格计算 —— 全部是纯函数，不接触 DOM，方便单元测试。
 *
 * 购物篮结构：[{ productId: 'apple', quantity: 2 }, ...]
 * 所有金额都用「元」为单位的整数运算，避免浮点误差。
 */
import { getProduct, productName } from '../data/products.js';

/** 创建空购物篮。 */
export function createCart() {
  return [];
}

export function isCartEmpty(cart) {
  return !cart || cart.length === 0;
}

/** 某样商品在购物篮里的数量。 */
export function cartQuantity(cart, productId) {
  if (!cart) return 0;
  const line = cart.find((item) => item.productId === productId);
  return line ? line.quantity : 0;
}

/** 购物篮里的商品总件数。 */
export function cartTotalQuantity(cart) {
  if (!cart) return 0;
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

/** 单行小计 = 单价 × 数量。 */
export function lineSubtotal(productId, quantity) {
  const product = getProduct(productId);
  if (!product) return 0;
  return product.price * quantity;
}

/**
 * 购物篮明细，收银台和小票都用它。
 * 返回 [{ productId, name, unitPrice, quantity, subtotal }]
 */
export function cartLines(cart, language = 'zh') {
  if (!cart) return [];
  const lines = [];
  for (const item of cart) {
    const product = getProduct(item.productId);
    if (!product) continue;
    lines.push({
      productId: item.productId,
      name: product.name[language] || product.name.zh,
      unitPrice: product.price,
      quantity: item.quantity,
      subtotal: product.price * item.quantity
    });
  }
  return lines;
}

/** 总价 = 所有小计之和。必须由程序计算，不能硬编码。 */
export function cartTotal(cart) {
  if (!cart) return 0;
  return cart.reduce((sum, item) => sum + lineSubtotal(item.productId, item.quantity), 0);
}

/** 把数量限制在该商品的 0..maxQty 范围内。 */
export function clampQuantity(productId, quantity) {
  const product = getProduct(productId);
  const maxQty = product ? product.maxQty : 0;
  return Math.max(0, Math.min(Math.floor(quantity), maxQty));
}

/** 增加数量（返回新的购物篮，不修改原对象）。 */
export function addToCart(cart, productId, amount = 1) {
  const product = getProduct(productId);
  if (!product) return cart.slice();
  const current = cartQuantity(cart, productId);
  const next = clampQuantity(productId, current + amount);
  if (next === current) return cart.slice();

  const result = cart.map((item) => ({ ...item }));
  const index = result.findIndex((item) => item.productId === productId);
  if (next <= 0) {
    if (index !== -1) result.splice(index, 1);
  } else if (index === -1) {
    result.push({ productId, quantity: next });
  } else {
    result[index].quantity = next;
  }
  return result;
}

/** 直接设置数量；数量为 0 时删除该行。 */
export function setQuantity(cart, productId, quantity) {
  const target = clampQuantity(productId, quantity);
  const result = cart.filter((item) => item.productId !== productId).map((item) => ({ ...item }));
  if (target > 0) result.push({ productId, quantity: target });
  return result;
}

/** 减少数量；减到 0 时自动移除。 */
export function removeFromCart(cart, productId, amount = 1) {
  return addToCart(cart, productId, -amount);
}

/** 完全删除某一行。 */
export function deleteLine(cart, productId) {
  return cart.filter((item) => item.productId !== productId);
}

/** 清空购物篮。 */
export function clearCart() {
  return [];
}

/** 两个购物篮是否完全一致（商品与数量都要相同）。 */
export function cartsEqual(a, b) {
  const ids = new Set([...(a || []).map((l) => l.productId), ...(b || []).map((l) => l.productId)]);
  for (const id of ids) {
    if (cartQuantity(a, id) !== cartQuantity(b, id)) return false;
  }
  return true;
}

/**
 * 采购校验：把购物篮和顾客订单做对比。
 * 返回 { ok, hint }，hint 是 { code, params }，界面负责翻译成儿童能懂的话。
 * 提示语一律是鼓励性的，不出现「错误」「失败」这类字眼。
 */
export function checkCart(cart, order, language = 'zh') {
  if (!order) return { ok: false, hint: { code: 'noOrder', params: {} } };
  if (isCartEmpty(cart)) return { ok: false, hint: { code: 'empty', params: {} } };

  if (order.constraint && order.constraint.type === 'items') {
    return checkLines(cart, order.lines, language);
  }
  return checkConstraint(cart, order, language);
}

/** 精确清单校验（算总价 / 找零钱模式的订单是固定的）。 */
function checkLines(cart, lines, language) {
  const wanted = new Map(lines.map((line) => [line.productId, line.quantity]));

  for (const item of cart) {
    if (!wanted.has(item.productId)) {
      return {
        ok: false,
        hint: { code: 'notNeeded', params: { product: productName(item.productId, language) } }
      };
    }
    const need = wanted.get(item.productId);
    if (item.quantity > need) {
      return {
        ok: false,
        hint: {
          code: 'tooMany',
          params: { product: productName(item.productId, language), n: item.quantity - need }
        }
      };
    }
  }

  for (const line of lines) {
    const have = cartQuantity(cart, line.productId);
    if (have < line.quantity) {
      return {
        ok: false,
        hint: {
          code: 'needMore',
          params: { product: productName(line.productId, language), n: line.quantity - have }
        }
      };
    }
  }
  return { ok: true, hint: { code: 'correct', params: {} } };
}

/** 约束校验（颜色 / 形状 / 数量模式允许用同类的其他商品替代）。 */
function checkConstraint(cart, order, language) {
  const { constraint, quantity } = order;

  for (const item of cart) {
    const product = getProduct(item.productId);
    if (!product) continue;

    if (constraint.type === 'color' && product.color !== constraint.value) {
      return {
        ok: false,
        hint: {
          code: 'wrongColor',
          params: { product: product.name[language] || product.name.zh, color: constraint.value }
        }
      };
    }
    if (constraint.type === 'shape' && product.shape !== constraint.value) {
      return {
        ok: false,
        hint: {
          code: 'wrongShape',
          params: { product: product.name[language] || product.name.zh, shape: constraint.value }
        }
      };
    }
    if (
      (constraint.type === 'product' || constraint.productId) &&
      constraint.productId &&
      item.productId !== constraint.productId
    ) {
      return {
        ok: false,
        hint: {
          code: 'wrongProduct',
          params: {
            product: product.name[language] || product.name.zh,
            wanted: productName(constraint.productId, language)
          }
        }
      };
    }
  }

  const total = cartTotalQuantity(cart);
  if (total < quantity) {
    return { ok: false, hint: { code: 'needMoreItems', params: { n: quantity - total } } };
  }
  if (total > quantity) {
    return { ok: false, hint: { code: 'tooManyItems', params: { n: total - quantity } } };
  }
  return { ok: true, hint: { code: 'correct', params: {} } };
}
