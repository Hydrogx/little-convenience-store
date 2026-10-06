/**
 * 端到端流程测试：走完一整轮「挑商品 → 算总价 → 收钱 → 找零 → 拿星星」。
 * 直接用真实的 store 和 game 控制器（不启动浏览器），
 * 守住验收标准里最容易出错的那条链路。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { store } from '../src/state.js';
import * as game from '../src/game.js';
import { createProgress } from '../src/logic/progress.js';
import { breakdown, selectionTotal } from '../src/logic/money.js';
import { PRODUCTS, getProduct, productsByColor, productsByShape } from '../src/data/products.js';
import { DIFFICULTY_IDS } from '../src/data/levels.js';
import { setLanguage } from '../src/i18n/index.js';

const MODES = ['color', 'shape', 'count', 'price', 'change'];

function reset(difficulty = 'easy', settings = {}) {
  store.patch({
    difficulty,
    settings: {
      allowChange: true,
      maxNumber: 100,
      multiplication: true,
      timer: false,
      hints: true,
      advancedPrices: false,
      ...settings
    },
    progress: createProgress(),
    language: 'zh'
  });
  setLanguage('zh');
}

/** 找出能满足顾客要求的一种商品（同一种商品可以买多份）。 */
function pickProductFor(order) {
  const constraint = order.constraint;
  if (constraint.type === 'product') return constraint.value;
  if (constraint.type === 'color') {
    const ids = productsByColor(constraint.value).slice().sort((a, b) => getProduct(b).maxQty - getProduct(a).maxQty);
    assert.ok(ids.length, `颜色 ${constraint.value} 没有商品`);
    return ids[0];
  }
  if (constraint.type === 'shape') {
    if (constraint.productId) return constraint.productId;
    const ids = productsByShape(constraint.value).slice().sort((a, b) => getProduct(b).maxQty - getProduct(a).maxQty);
    assert.ok(ids.length, `形状 ${constraint.value} 没有商品`);
    return ids[0];
  }
  throw new Error(`未知订单类型 ${constraint.type}`);
}

/** 按顾客要求把正确的商品放进购物篮。 */
function fillBasket(state) {
  const order = state.order;
  if (order.fixedLines) {
    for (const line of order.lines) game.addProduct(line.productId, line.quantity);
    return;
  }
  game.addProduct(pickProductFor(order), order.quantity);
}

/** 用零钱盒里的面额凑出指定金额，并逐张放进去。 */
function putChange(amount, rules) {
  for (const piece of breakdown(amount, rules.denominations)) {
    for (let i = 0; i < piece.count; i += 1) game.addChangeMoney(piece.value);
  }
}

test('完整一轮购物：正确完成订单会拿到 3 颗星和金币', () => {
  for (const difficultyId of DIFFICULTY_IDS) {
    for (const mode of MODES) {
      reset(difficultyId);
      game.startGame(mode);
      let state = store.getState();
      assert.equal(state.screen, 'game');
      assert.equal(state.phase, 'shopping');
      assert.ok(state.order, `${difficultyId}/${mode}: 应该生成订单`);

      // 空购物篮不能通过检查
      assert.equal(game.checkBasket().ok, false, `${difficultyId}/${mode}: 空购物篮不该通过`);
      assert.ok(store.getState().feedback, '空购物篮应该给出提示');

      fillBasket(store.getState());
      state = store.getState();
      assert.ok(state.cart.length > 0, `${difficultyId}/${mode}: 购物篮不该是空的`);

      assert.equal(game.checkBasket().ok, true, `${difficultyId}/${mode}: 标准答案应该通过检查`);
      assert.equal(store.getState().phase, 'total');

      const derived = game.deriveGame();
      assert.ok(derived.total > 0);
      assert.equal(derived.revealTotal, false, '问总价时不该把答案显示出来');

      assert.equal(game.submitTotal(derived.total).ok, true, `${difficultyId}/${mode}: 总价应为 ${derived.total}`);
      state = store.getState();
      assert.equal(state.phase, 'payment');
      const payment = state.payment;
      assert.ok(payment.payment >= derived.total);
      assert.equal(payment.change, payment.payment - derived.total);
      assert.ok(payment.change >= 0, '找零不能是负数');
      assert.equal(game.deriveGame().revealTotal, true, '答完总价后可以显示总价');

      game.acceptPayment();
      state = store.getState();
      if (payment.change > 0) {
        assert.equal(state.phase, 'change');
        const rules = game.currentRules();
        putChange(payment.change, rules);
        assert.equal(selectionTotal(store.getState().changeSelection), payment.change);
        assert.equal(game.submitChange().ok, true, `${difficultyId}/${mode}: 正确零钱应该通过`);
      }

      state = store.getState();
      assert.equal(state.phase, 'result');
      assert.equal(state.reward.stars, 3);
      assert.ok(state.reward.coins >= 15);
      assert.equal(state.progress.ordersCompleted, 1);
      assert.ok(state.reward.steps.length >= 2, '结果页要展示计算过程');
      assert.equal(state.progress.stars, 3);

      game.nextCustomer();
      state = store.getState();
      assert.equal(state.phase, 'shopping');
      assert.deepEqual(state.cart, [], '换顾客要清空购物篮');
    }
  }
});

test('答错不会推进步骤，也不会扣奖励；再答对仍然拿星星', () => {
  reset('easy');
  game.startGame('count');
  fillBasket(store.getState());
  assert.equal(game.checkBasket().ok, true);

  const total = game.deriveGame().total;
  assert.equal(game.submitTotal(total + 1).ok, false);
  assert.equal(store.getState().phase, 'total', '答错应停留在同一题');
  assert.equal(store.getState().session.mistakes, 1);
  assert.equal(store.getState().progress.stars, 0);
  assert.ok(store.getState().feedback.text.length > 0, '答错要给出温和提示');

  assert.equal(game.submitTotal(total).ok, true);
  const payment = store.getState().payment;
  game.acceptPayment();
  if (payment.change > 0) {
    putChange(payment.change, game.currentRules());
    assert.equal(game.submitChange().ok, true);
  }
  assert.equal(store.getState().phase, 'result');
  assert.equal(store.getState().reward.stars, 2, '错过一次仍应有 2 颗星');
  assert.ok(store.getState().progress.stars >= 1, '已经拿到的星星不会变少');
});

test('找零不对时会提示还差多少，补上以后通过', () => {
  reset('standard');
  game.startGame('change');
  fillBasket(store.getState());
  game.checkBasket();
  game.submitTotal(game.deriveGame().total);
  game.acceptPayment();
  const state = store.getState();
  assert.equal(state.phase, 'change');
  const target = state.payment.change;
  assert.ok(target > 0);

  putChange(target - 1, game.currentRules());
  const result = game.submitChange();
  assert.equal(result.ok, false);
  assert.equal(result.remaining, 1);
  assert.ok(store.getState().feedback.text.length > 0);
  assert.notEqual(store.getState().phase, 'result');

  game.addChangeMoney(1);
  assert.equal(game.submitChange().ok, true);
  assert.equal(store.getState().phase, 'result');
});

test('切换语言不会清空购物篮和当前订单', () => {
  reset('standard');
  game.startGame('price');
  fillBasket(store.getState());
  const before = store.getState();
  const cartSnapshot = JSON.stringify(before.cart);
  const orderId = before.order.id;

  game.changeLanguage('en');
  const after = store.getState();
  assert.equal(after.language, 'en');
  assert.equal(JSON.stringify(after.cart), cartSnapshot, '切换语言不能清空购物篮');
  assert.equal(after.order.id, orderId, '切换语言不能换订单');
  assert.equal(after.phase, before.phase, '切换语言不能改变当前步骤');

  game.changeLanguage('zh');
  assert.equal(JSON.stringify(store.getState().cart), cartSnapshot);
});

test('自由购物模式：没有顾客也能逛、能算总价、能清空', () => {
  reset('easy');
  game.startGame('free');
  let state = store.getState();
  assert.equal(state.order, null);
  assert.equal(game.checkBasket().ok, false, '自由模式没有订单，检查按钮不作用');

  game.addProduct('apple', 2);
  game.addProduct('candy', 1);
  state = store.getState();
  const derived = game.deriveGame();
  assert.equal(derived.total, getProduct('apple').price * 2 + getProduct('candy').price * 1);
  assert.equal(derived.revealTotal, true, '自由购物时总价可以直接显示');

  assert.equal(game.goToCheckout(), true);
  assert.equal(store.getState().phase, 'total');
  assert.equal(game.submitTotal(derived.total).ok, true);

  game.emptyBasket();
  assert.deepEqual(store.getState().cart, []);
  assert.equal(game.goToCheckout(), false, '空购物篮不能进收银台');
});

test('跳过这一题：不扣奖励、不计入完成订单', () => {
  reset('easy');
  game.startGame('count');
  fillBasket(store.getState());
  game.checkBasket();
  game.submitTotal(game.deriveGame().total);
  const beforeSkip = store.getState().progress;
  game.skipQuestion();
  const state = store.getState();
  assert.equal(state.phase, 'result');
  assert.equal(state.reward.skipped, true);
  assert.equal(state.reward.stars, 0);
  assert.equal(state.progress.stars, beforeSkip.stars, '跳过不能扣星星');
  assert.equal(state.progress.coins, beforeSkip.coins);
  assert.equal(state.progress.ordersCompleted, beforeSkip.ordersCompleted, '跳过不计入完成订单');
  assert.ok(state.reward.steps.length >= 2, '跳过也要能看到答案和过程');
});

test('回到货架可以修改购物篮，然后重新检查', () => {
  reset('easy');
  game.startGame('count');
  fillBasket(store.getState());
  game.checkBasket();
  assert.equal(store.getState().phase, 'total');
  game.backToShopping();
  assert.equal(store.getState().phase, 'shopping');
  game.emptyBasket();
  assert.equal(game.checkBasket().ok, false);
});

test('关闭找零钱后，收钱直接进入结果页', () => {
  reset('standard', { allowChange: false });
  game.startGame('price');
  fillBasket(store.getState());
  game.checkBasket();
  const total = game.deriveGame().total;
  game.submitTotal(total);
  const state = store.getState();
  assert.equal(state.payment.change, 0, '关闭找零后不产生找零');
  assert.equal(state.payment.payment, total);
  game.acceptPayment();
  assert.equal(store.getState().phase, 'result');
  assert.equal(store.getState().reward.changeLine, '');
});

test('难度切换后重新出题，题目符合新难度', () => {
  reset('easy');
  game.startGame('price');
  const easyOrder = store.getState().order;
  const easyTotal = game.deriveGame().total;
  assert.ok(easyTotal <= 10, `简单级总价应不超过 10，实际 ${easyTotal}`);

  game.setDifficulty('challenge');
  const state = store.getState();
  assert.equal(state.difficulty, 'challenge');
  assert.ok(state.order, '切换难度后应该有新订单');
  assert.notEqual(state.order.id, easyOrder.id);
  assert.deepEqual(state.cart, []);
});

test('星星与金币会累计，并且随着订单变多解锁装饰', () => {
  reset('easy');
  const unlocked = [];
  for (let i = 0; i < 6; i += 1) {
    game.startGame('count');
    fillBasket(store.getState());
    game.checkBasket();
    const derived = game.deriveGame();
    game.submitTotal(derived.total);
    game.acceptPayment();
    const payment = store.getState().payment;
    if (payment && payment.change > 0) {
      putChange(payment.change, game.currentRules());
      game.submitChange();
    }
    const state = store.getState();
    assert.equal(state.phase, 'result');
    unlocked.push(...state.reward.newlyUnlocked);
  }
  const progress = store.getState().progress;
  assert.equal(progress.ordersCompleted, 6);
  assert.equal(progress.stars, 18);
  assert.ok(progress.coins >= 90);
  assert.ok(progress.unlockedDecor.length >= 2, '完成 6 单至少解锁 2 个装饰');
  assert.equal(new Set(unlocked).size, unlocked.length, '同一个装饰不会重复解锁');
});

test('快速数量按钮：一次点击就能把数量设成指定值', () => {
  reset('easy');
  game.startGame('free');
  game.addProduct('apple', 1);
  game.addProduct('candy', 1);
  // candy 是最后加进来的，快速按钮作用于它
  game.setProductQuantity('candy', 4);
  assert.equal(store.getState().cart.find((line) => line.productId === 'candy').quantity, 4);
  assert.equal(getProduct('apple').price * 1 + getProduct('candy').price * 4, game.deriveGame().total);

  // 超过 maxQty 会被夹住
  game.setProductQuantity('candy', 5);
  assert.ok(store.getState().cart.find((line) => line.productId === 'candy').quantity <= getProduct('candy').maxQty);
  // 设为 0 等于移除
  game.setProductQuantity('candy', 0);
  assert.equal(
    store.getState().cart.some((line) => line.productId === 'candy'),
    false
  );
});

test('商品数据完整性：数量、颜色与形状都能支撑玩法', () => {
  assert.ok(PRODUCTS.length >= 8);
  const colors = new Set(PRODUCTS.map((product) => product.color));
  const shapes = new Set(PRODUCTS.map((product) => product.shape));
  assert.ok(colors.size >= 4, '至少要有 4 种颜色的商品');
  assert.ok(shapes.size >= 4, '至少要有 4 种形状的商品');
  for (const shape of ['circle', 'square', 'rectangle', 'triangle', 'star']) {
    assert.ok(productsByShape(shape).length > 0, `形状 ${shape} 至少要有一种商品`);
  }
});
