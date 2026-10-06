/**
 * 题目生成测试（PRD 19.12 要求覆盖：难度生成）
 * 每一道生成的题目都必须是「可以做到的」：存在一个购物篮能满足顾客要求。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateOrder,
  resolveOrderLines,
  resolveOrderTotal,
  explainLines,
  explainChange,
  ORDER_MODES
} from '../src/logic/orders.js';
import { DIFFICULTY_IDS, resolveRules } from '../src/data/levels.js';
import { getProduct, productsByColor, productsByShape, PRODUCTS } from '../src/data/products.js';
import { ORDERABLE_SHAPE_IDS } from '../src/data/shapes.js';
import { CUSTOMERS } from '../src/data/customers.js';
import { seededRandom } from '../src/logic/rng.js';
import { checkCart, cartTotal, addToCart, createCart } from '../src/logic/cart.js';

const SAMPLES = 120;

/** 为一道题找出一个合法答案，用来验证题目可解。 */
function solve(order) {
  const constraint = order.constraint;
  if (constraint.type === 'items') {
    return order.lines.map((line) => ({ ...line }));
  }
  if (constraint.type === 'product') {
    return [{ productId: constraint.value, quantity: order.quantity }];
  }
  if (constraint.type === 'color') {
    // 同一种商品可以买多份，所以取该颜色下最贵的容量最大的商品即可
    const ids = productsByColor(constraint.value).sort((a, b) => getProduct(b).maxQty - getProduct(a).maxQty);
    return [{ productId: ids[0], quantity: order.quantity }];
  }
  if (constraint.type === 'shape') {
    if (constraint.productId) return [{ productId: constraint.productId, quantity: order.quantity }];
    const ids = productsByShape(constraint.value)
      .slice()
      .sort((a, b) => getProduct(b).maxQty - getProduct(a).maxQty);
    return [{ productId: ids[0], quantity: order.quantity }];
  }
  throw new Error(`未知约束类型 ${constraint.type}`);
}

function cartFromLines(lines) {
  let cart = createCart();
  for (const line of lines) cart = addToCart(cart, line.productId, line.quantity);
  return cart;
}

for (const difficultyId of DIFFICULTY_IDS) {
  test(`[${difficultyId}] 生成的订单都在难度范围内，并且一定有解`, () => {
    const rules = resolveRules(difficultyId, {});
    const rng = seededRandom(difficultyId.length * 7717 + 13);
    const [minQty, maxQty] = rules.quantityRange;

    for (const mode of ORDER_MODES) {
      for (let i = 0; i < SAMPLES; i += 1) {
        const order = generateOrder({ mode, rules, rng });
        assert.equal(order.mode, mode);
        assert.ok(
          CUSTOMERS.some((customer) => customer.id === order.customerId),
          '顾客必须是角色表里的角色'
        );
        assert.ok(order.quantity >= 1, '件数必须是正整数');

        if (order.fixedLines) {
          assert.ok(order.lines.length >= 1);
          assert.ok(
            order.lines.length <= rules.lineItems,
            `${difficultyId}/${mode}: 商品种类 ${order.lines.length} 超过了难度上限 ${rules.lineItems}`
          );
          const ids = order.lines.map((line) => line.productId);
          assert.equal(new Set(ids).size, ids.length, '同一张清单里不应重复出现同一种商品');
          for (const line of order.lines) {
            const product = getProduct(line.productId);
            assert.ok(product, '商品必须存在');
            assert.ok(line.quantity >= 1, '数量至少为 1');
            assert.ok(line.quantity <= product.maxQty, '数量不能超过 maxQty');
            assert.ok(
              line.quantity >= minQty && line.quantity <= maxQty,
              `${difficultyId}: 数量 ${line.quantity} 不在 ${minQty}-${maxQty} 范围内`
            );
          }
          const total = resolveOrderTotal(order, []);
          assert.equal(total, cartTotal(order.lines), '总价必须等于各行小计之和');
          assert.ok(
            total >= rules.totalRange[0] && total <= rules.totalRange[1],
            `${difficultyId}/${mode}: 总价 ${total} 不在 ${rules.totalRange.join('-')} 之内`
          );
        } else {
          const constraint = order.constraint;
          if (constraint.type === 'color') {
            assert.ok(productsByColor(constraint.value).length > 0);
          }
          if (constraint.type === 'shape') {
            assert.ok(ORDERABLE_SHAPE_IDS.includes(constraint.value));
            assert.ok(productsByShape(constraint.value).length > 0);
          }
          if (constraint.type === 'product') {
            assert.ok(getProduct(constraint.value));
          }
          assert.ok(
            order.quantity >= minQty && order.quantity <= maxQty,
            `${difficultyId}/${mode}: 件数 ${order.quantity} 不在 ${minQty}-${maxQty} 范围内`
          );
        }

        // 关键一步：题目必须可解
        const solution = solve(order);
        const result = checkCart(cartFromLines(solution), order, 'zh');
        assert.equal(result.ok, true, `${difficultyId}/${mode}: 标准答案竟然不通过 —— ${result.hint.code}`);
      }
    }
  });
}

test('清单型订单：标准答案的总价等于程序计算的总价', () => {
  const rules = resolveRules('standard', {});
  const rng = seededRandom(4242);
  for (let i = 0; i < 60; i += 1) {
    const order = generateOrder({ mode: 'price', rules, rng });
    const lines = resolveOrderLines(order, []);
    const expected = lines.reduce((sum, line) => sum + getProduct(line.productId).price * line.quantity, 0);
    assert.equal(resolveOrderTotal(order, []), expected);
  }
});

test('约束型订单：结算时用的是玩家真正选的购物篮', () => {
  const rules = resolveRules('easy', {});
  const rng = seededRandom(11);
  const order = generateOrder({ mode: 'count', rules, rng });
  const cart = addToCart(createCart(), order.constraint.value, order.quantity);
  const lines = resolveOrderLines(order, cart);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].productId, order.constraint.value);
  assert.equal(resolveOrderTotal(order, cart), getProduct(order.constraint.value).price * order.quantity);
});

test('计算过程把乘法还原成重复加法', () => {
  const lines = [
    { productId: 'apple', quantity: 2 }, // 3 元 × 2
    { productId: 'drink', quantity: 1 } // 5 元 × 1
  ];
  const steps = explainLines(lines, { allowMultiplication: true });
  assert.equal(steps.length, 3);
  assert.equal(steps[0].multiplyText, '2 × 3 = 6');
  assert.equal(steps[0].repeatedText, '3 + 3 = 6');
  assert.equal(steps[0].subtotal, 6);
  assert.equal(steps[0].showMultiply, true);
  assert.equal(steps[1].multiplyText, '1 × 5 = 5');
  assert.equal(steps[2].type, 'total');
  assert.equal(steps[2].total, 11);
});

test('关闭乘法后不展示乘法式子，但小计仍然正确', () => {
  const steps = explainLines([{ productId: 'candy', quantity: 3 }], { allowMultiplication: false });
  assert.equal(steps[0].showMultiply, false);
  assert.equal(steps[0].repeatedText, '2 + 2 + 2 = 6');
  assert.equal(steps[0].subtotal, 6);
});

test('找零的计算过程写成减法', () => {
  assert.equal(explainChange({ payment: 10, total: 7, change: 3 }), '10 − 7 = 3');
});

test('同一批种子生成同一批题目（可复现）', () => {
  const rules = resolveRules('standard', {});
  const first = [];
  const second = [];
  const rngA = seededRandom(2024);
  const rngB = seededRandom(2024);
  for (let i = 0; i < 20; i += 1) {
    first.push(generateOrder({ mode: 'count', rules, rng: rngA }));
    second.push(generateOrder({ mode: 'count', rules, rng: rngB }));
  }
  assert.deepEqual(
    first.map((order) => [order.constraint.value, order.quantity, order.customerId]),
    second.map((order) => [order.constraint.value, order.quantity, order.customerId])
  );
});

test('换个顾客：不会连着两次都是同一位', () => {
  const rules = resolveRules('easy', {});
  const rng = seededRandom(88);
  let previous = null;
  for (let i = 0; i < 40; i += 1) {
    const order = generateOrder({ mode: 'count', rules, rng, previousCustomerId: previous });
    assert.notEqual(order.customerId, previous);
    previous = order.customerId;
  }
});

test('商品数据至少有 8 种，且每种都有名称、价格、颜色和形状', () => {
  assert.ok(PRODUCTS.length >= 8, `商品数量 ${PRODUCTS.length} 少于 8`);
  for (const product of PRODUCTS) {
    assert.ok(product.name.zh && product.name.en, `${product.id} 缺少双语名称`);
    assert.ok(Number.isInteger(product.price) && product.price > 0, `${product.id} 价格必须是正整数`);
    assert.ok(product.color && product.shape, `${product.id} 缺少颜色或形状`);
    assert.ok(product.maxQty > 0);
  }
});
