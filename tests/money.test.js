/**
 * 钱的计算测试（PRD 19.12 要求覆盖：找零钱计算、难度生成）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatYuan,
  breakdown,
  breakdownSlots,
  planPayment,
  selectionTotal,
  selectionCounts,
  checkChange,
  totalChoices
} from '../src/logic/money.js';
import { DIFFICULTY_IDS, resolveRules } from '../src/data/levels.js';
import { seededRandom } from '../src/logic/rng.js';

test('金额读法：中文和英文', () => {
  assert.equal(formatYuan(3, 'zh'), '3 元');
  assert.equal(formatYuan(3, 'en'), '3 yuan');
  assert.equal(formatYuan(0, 'zh'), '0 元');
});

test('面额拆分用最少的张数', () => {
  assert.deepEqual(
    breakdown(13, [1, 5, 10]).map((part) => [part.value, part.count]),
    [
      [10, 1],
      [1, 3]
    ]
  );
  assert.deepEqual(breakdown(0, [1, 5]).length, 0);
  assert.equal(breakdownSlots(13, [1, 5, 10]), 4);
  assert.equal(breakdownSlots(10, [1, 5, 10]), 1);
});

test('找零校验：还差 / 多了 / 刚好', () => {
  assert.deepEqual(checkChange([5, 1, 1], 7), {
    ok: true,
    total: 7,
    target: 7,
    remaining: 0,
    excess: 0
  });
  const under = checkChange([5, 1], 7);
  assert.equal(under.ok, false);
  assert.equal(under.remaining, 1);
  assert.equal(under.excess, 0);
  const over = checkChange([10], 7);
  assert.equal(over.ok, false);
  assert.equal(over.remaining, 0);
  assert.equal(over.excess, 3);
});

test('零钱盘合计与张数统计', () => {
  assert.equal(selectionTotal([10, 5, 1, 1]), 17);
  assert.equal(selectionTotal([]), 0);
  assert.deepEqual(selectionCounts([1, 10, 1, 5]).map((item) => [item.value, item.count]), [
    [10, 1],
    [5, 1],
    [1, 2]
  ]);
});

test('三档难度的付款方案都合法：找零非负、不超过上限、能被零钱盒凑出', () => {
  for (const difficultyId of DIFFICULTY_IDS) {
    const rules = resolveRules(difficultyId, {});
    const rng = seededRandom(20240607);
    for (let total = rules.totalRange[0]; total <= rules.totalRange[1]; total += 1) {
      const plan = planPayment(total, rules, rng);
      assert.ok(plan.payment >= total, `${difficultyId}: 付款 ${plan.payment} 不应少于总价 ${total}`);
      assert.equal(plan.change, plan.payment - total);
      assert.ok(plan.change >= 0, '找零不能是负数');
      assert.ok(
        plan.change <= rules.changeCap,
        `${difficultyId}: 总价 ${total} 的找零 ${plan.change} 超过上限 ${rules.changeCap}`
      );
      // 找零必须能用零钱盒里的面额恰好凑出来
      const slots = breakdownSlots(plan.change, rules.denominations);
      if (plan.change > 0) {
        assert.ok(Number.isFinite(slots), `${difficultyId}: 找零 ${plan.change} 无法用零钱盒凑出`);
      }
      // 付款本身也要能被面额表示
      const noteTotal = plan.notes.reduce((sum, note) => sum + note.value * note.count, 0);
      assert.equal(noteTotal, plan.payment, '付款纸币之和应等于付款金额');
    }
  }
});

test('简单级：只用一张纸币付款，找零不超过 10 元', () => {
  const rules = resolveRules('easy', {});
  const rng = seededRandom(7);
  const seen = new Set();
  for (let total = rules.totalRange[0]; total <= rules.totalRange[1]; total += 1) {
    const plan = planPayment(total, rules, rng);
    const notes = plan.notes.reduce((sum, note) => sum + note.count, 0);
    assert.equal(notes, 1, `总价 ${total} 应该只用一张纸币`);
    assert.ok(plan.change >= 1 && plan.change <= 10, `总价 ${total} 的找零应为 1-10 元`);
    seen.add(plan.payment);
  }
  assert.ok(seen.size >= 2);
});

test('挑战级：找零通常需要组合多种纸币硬币', () => {
  const rules = resolveRules('challenge', {});
  const rng = seededRandom(99);
  let combined = 0;
  let samples = 0;
  for (let total = rules.totalRange[0]; total <= rules.totalRange[1]; total += 2) {
    const plan = planPayment(total, rules, rng);
    samples += 1;
    if (plan.change > 0 && breakdownSlots(plan.change, rules.denominations) >= 2) combined += 1;
  }
  assert.ok(combined / samples > 0.6, '挑战级大多数找零应该需要组合面额');
});

test('总价选择题：包含正确答案、选项互不相同且都是正数', () => {
  const rng = seededRandom(1234);
  for (let total = 1; total <= 60; total += 1) {
    const choices = totalChoices(total, 4, rng);
    assert.equal(choices.length, 4);
    assert.ok(choices.includes(total), `选项里应该有正确答案 ${total}`);
    assert.equal(new Set(choices).size, 4, '选项不能重复');
    assert.ok(choices.every((value) => value > 0 && Number.isInteger(value)));
  }
});

test('选项个数不足两个时返回 null（改用数字键盘）', () => {
  const rng = seededRandom(5);
  assert.equal(totalChoices(10, 0, rng), null);
  assert.equal(totalChoices(10, 1, rng), null);
});

test('关闭找零钱后不再生成付款方案（changeCap 归零）', () => {
  const rules = resolveRules('standard', { allowChange: false });
  assert.equal(rules.allowChange, false);
  assert.equal(rules.changeCap, 0);
});

test('家长设置可以收紧数字范围', () => {
  const rules = resolveRules('standard', { maxNumber: 20 });
  assert.equal(rules.totalRange[1], 20);
  assert.equal(rules.maxNumber, 20);
});
