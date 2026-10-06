/**
 * 购物篮与价格计算测试（PRD 19.12 要求覆盖：总价计算、商品数量变化）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCart,
  addToCart,
  removeFromCart,
  setQuantity,
  deleteLine,
  clearCart,
  cartQuantity,
  cartTotalQuantity,
  cartTotal,
  cartLines,
  lineSubtotal,
  checkCart,
  cartsEqual,
  isCartEmpty
} from '../src/logic/cart.js';
import { PRODUCT_IDS, getProduct, productsByColor, productsByShape } from '../src/data/products.js';

test('空购物篮总价为 0', () => {
  assert.equal(cartTotal(createCart()), 0);
  assert.equal(cartTotalQuantity(createCart()), 0);
  assert.equal(isCartEmpty(createCart()), true);
});

test('总价 = 单价 × 数量 之和（由程序计算，不硬编码）', () => {
  const apple = getProduct('apple'); // 3 元
  const drink = getProduct('drink'); // 5 元
  const cart = [
    { productId: 'apple', quantity: 2 },
    { productId: 'drink', quantity: 1 }
  ];
  assert.equal(lineSubtotal('apple', 2), apple.price * 2);
  assert.equal(cartTotal(cart), apple.price * 2 + drink.price * 1);
  assert.equal(cartTotal(cart), 11);
  assert.equal(cartTotalQuantity(cart), 3);
});

test('随机购物篮：总价始终等于各行小计之和', () => {
  let cart = createCart();
  const expected = new Map();
  // 用一个固定序列代替随机，测试可复现
  const sequence = [0, 3, 7, 11, 2, 5, 9, 1, 6, 10];
  for (let i = 0; i < 40; i += 1) {
    const id = PRODUCT_IDS[sequence[i % sequence.length]];
    cart = addToCart(cart, id, 1);
    expected.set(id, (expected.get(id) || 0) + 1);
  }
  const sum = [...expected.entries()].reduce((total, [id, qty]) => total + getProduct(id).price * qty, 0);
  assert.equal(cartTotal(cart), sum);
  for (const [id, qty] of expected.entries()) {
    assert.equal(cartQuantity(cart, id), qty, `${id} 数量应为 ${qty}`);
  }
});

test('增加数量不会超过商品的 maxQty', () => {
  const max = getProduct('sandwich').maxQty;
  let cart = createCart();
  for (let i = 0; i < max + 5; i += 1) cart = addToCart(cart, 'sandwich', 1);
  assert.equal(cartQuantity(cart, 'sandwich'), max);
});

test('减少数量到 0 时自动移出购物篮', () => {
  let cart = addToCart(createCart(), 'candy', 2);
  cart = removeFromCart(cart, 'candy', 1);
  assert.equal(cartQuantity(cart, 'candy'), 1);
  cart = removeFromCart(cart, 'candy', 1);
  assert.equal(cartQuantity(cart, 'candy'), 0);
  assert.equal(isCartEmpty(cart), true);
});

test('数量变化不会影响原购物篮（纯函数）', () => {
  const cart = addToCart(createCart(), 'milk', 2);
  const frozen = JSON.stringify(cart);
  addToCart(cart, 'milk', 1);
  setQuantity(cart, 'milk', 5);
  removeFromCart(cart, 'milk', 2);
  deleteLine(cart, 'milk');
  assert.equal(JSON.stringify(cart), frozen);
  assert.equal(cartQuantity(cart, 'milk'), 2);
});

test('setQuantity 可以指定数量，设为 0 时删除该行', () => {
  let cart = setQuantity(createCart(), 'juice', 4);
  assert.equal(cartQuantity(cart, 'juice'), 4);
  cart = setQuantity(cart, 'juice', 0);
  assert.equal(isCartEmpty(cart), true);
});

test('setQuantity 会把数量夹在合法范围内（不能是负数）', () => {
  let cart = setQuantity(createCart(), 'juice', -5);
  assert.equal(isCartEmpty(cart), true);
  cart = setQuantity(createCart(), 'juice', 999);
  assert.equal(cartQuantity(cart, 'juice'), getProduct('juice').maxQty);
});

test('clearCart 清空购物篮；cartsEqual 比较商品与数量', () => {
  const cart = addToCart(addToCart(createCart(), 'apple', 2), 'candy', 1);
  assert.equal(isCartEmpty(clearCart(cart)), true);
  assert.equal(cartsEqual(cart, addToCart(addToCart(createCart(), 'apple', 2), 'candy', 1)), true);
  assert.equal(cartsEqual(cart, addToCart(addToCart(createCart(), 'apple', 3), 'candy', 1)), false);
  assert.equal(cartsEqual(cart, addToCart(createCart(), 'apple', 2)), false);
});

test('数量模式：数量和商品都要对上', () => {
  const order = { constraint: { type: 'product', value: 'apple', productId: 'apple' }, quantity: 3 };
  assert.equal(checkCart(addToCart(createCart(), 'apple', 3), order).ok, true);
  assert.equal(checkCart(createCart(), order).ok, false);
  assert.equal(checkCart(addToCart(createCart(), 'apple', 3), order).hint.code, 'correct');

  const fewer = checkCart(addToCart(createCart(), 'apple', 2), order);
  assert.equal(fewer.ok, false);
  assert.equal(fewer.hint.code, 'needMoreItems');
  assert.equal(fewer.hint.params.n, 1);

  const more = checkCart(addToCart(createCart(), 'apple', 5), order);
  assert.equal(more.ok, false);
  assert.equal(more.hint.code, 'tooManyItems');

  const wrong = checkCart(addToCart(createCart(), 'banana', 3), order);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.hint.code, 'wrongProduct');
});

test('颜色模式：允许用同色的其他商品，颜色不对会提示', () => {
  const reds = productsByColor('red');
  assert.ok(reds.length >= 1);
  const order = { constraint: { type: 'color', value: 'red' }, quantity: 2 };

  assert.equal(checkCart(addToCart(createCart(), reds[0], 2), order).ok, true);

  const blue = productsByColor('blue')[0];
  const wrong = checkCart(addToCart(createCart(), blue, 2), order);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.hint.code, 'wrongColor');
});

test('形状模式：指定商品时商品和形状都要对', () => {
  const circles = productsByShape('circle');
  const order = { constraint: { type: 'shape', value: 'circle', productId: circles[0] }, quantity: 2 };
  assert.equal(checkCart(addToCart(createCart(), circles[0], 2), order).ok, true);

  if (circles.length > 1) {
    const other = checkCart(addToCart(createCart(), circles[1], 2), order);
    assert.equal(other.ok, false);
    assert.equal(other.hint.code, 'wrongProduct');
  }

  const triangles = productsByShape('triangle');
  const generic = { constraint: { type: 'shape', value: 'triangle' }, quantity: 1 };
  assert.equal(checkCart(addToCart(createCart(), triangles[0], 1), generic).ok, true);
  assert.equal(checkCart(addToCart(createCart(), circles[0], 1), generic).ok, false);
});

test('清单模式（算总价 / 找零钱）：购物篮必须和订单完全一致', () => {
  const order = {
    constraint: { type: 'items', value: 'items' },
    quantity: 3,
    lines: [
      { productId: 'apple', quantity: 2 },
      { productId: 'drink', quantity: 1 }
    ]
  };
  const exact = addToCart(addToCart(createCart(), 'apple', 2), 'drink', 1);
  assert.equal(checkCart(exact, order).ok, true);

  const extra = addToCart(exact, 'candy', 1);
  const extraResult = checkCart(extra, order);
  assert.equal(extraResult.ok, false);
  assert.equal(extraResult.hint.code, 'notNeeded');

  const tooMany = addToCart(addToCart(createCart(), 'apple', 3), 'drink', 1);
  assert.equal(checkCart(tooMany, order).hint.code, 'tooMany');

  const missing = addToCart(createCart(), 'apple', 2);
  const missingResult = checkCart(missing, order);
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.hint.code, 'needMore');
  assert.equal(missingResult.hint.params.n, 1);
});

test('购物篮明细同时给出双语名称和小计', () => {
  const cart = addToCart(addToCart(createCart(), 'apple', 2), 'milk', 1);
  const zh = cartLines(cart, 'zh');
  const en = cartLines(cart, 'en');
  assert.equal(zh[0].name, '苹果');
  assert.equal(en[0].name, 'Apple');
  assert.equal(zh[0].subtotal, 6);
  assert.equal(en[1].subtotal, getProduct('milk').price);
  assert.equal(
    zh.reduce((sum, line) => sum + line.subtotal, 0),
    cartTotal(cart)
  );
});
