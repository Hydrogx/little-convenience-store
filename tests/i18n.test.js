/**
 * 中英文切换测试（PRD 19.12 要求覆盖：语言切换）
 * 重点：两套字典的键必须完全一致 —— 漏翻一个键就会让测试失败。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DICTIONARIES,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  getLanguage,
  setLanguage,
  t,
  hasKey,
  normalizeLanguage,
  localeTag,
  languageLabel,
  applyToDom
} from '../src/i18n/index.js';
import { ZH } from '../src/i18n/zh.js';
import { EN } from '../src/i18n/en.js';
import { hintSentence, orderSentence, joinList, paymentSentence } from '../src/i18n/phrases.js';
import { PRODUCTS, getProduct } from '../src/data/products.js';
import { COLORS, colorName } from '../src/data/colors.js';
import { SHAPES, shapeName } from '../src/data/shapes.js';
import { generateOrder, ORDER_MODES } from '../src/logic/orders.js';
import { resolveRules } from '../src/data/levels.js';
import { seededRandom } from '../src/logic/rng.js';

test('中文和英文的键完全一致，没有漏翻译', () => {
  const zhKeys = Object.keys(ZH).sort();
  const enKeys = Object.keys(EN).sort();
  const missingInEn = zhKeys.filter((key) => !(key in EN));
  const missingInZh = enKeys.filter((key) => !(key in ZH));
  assert.deepEqual(missingInEn, [], `英文缺少这些键：${missingInEn.join(', ')}`);
  assert.deepEqual(missingInZh, [], `中文缺少这些键：${missingInZh.join(', ')}`);
  assert.ok(zhKeys.length > 120, `翻译键数量偏少（${zhKeys.length}）`);
});

test('没有空的翻译文本', () => {
  for (const [language, dict] of Object.entries(DICTIONARIES)) {
    for (const [key, value] of Object.entries(dict)) {
      assert.equal(typeof value, 'string', `${language}.${key} 必须是字符串`);
      assert.ok(value.trim().length > 0, `${language}.${key} 不能是空文本`);
    }
  }
});

test('t() 会替换占位符，找不到键时返回键名而不是 undefined', () => {
  assert.equal(t('money.yuan', { n: 7 }, 'zh'), '7 元');
  assert.equal(t('money.yuan', { n: 7 }, 'en'), '7 yuan');
  assert.equal(t('不存在的键'), '不存在的键');
  assert.equal(t('money.yuan', {}, 'zh'), '{n} 元'); // 没给参数时保留占位符，方便发现遗漏
});

test('切换语言立即生效，且非法语言退回中文', () => {
  const original = getLanguage();
  setLanguage('en');
  assert.equal(getLanguage(), 'en');
  assert.equal(t('common.total'), 'Total');
  setLanguage('zh');
  assert.equal(t('common.total'), '总价');
  setLanguage('fr');
  assert.equal(getLanguage(), DEFAULT_LANGUAGE);
  setLanguage(original);
});

test('语言元数据', () => {
  assert.deepEqual(LANGUAGES, ['zh', 'en']);
  assert.equal(normalizeLanguage('en'), 'en');
  assert.equal(normalizeLanguage('xx'), 'zh');
  assert.equal(localeTag('en'), 'en');
  assert.equal(localeTag('zh'), 'zh-CN');
  assert.equal(languageLabel('zh'), '中文');
  assert.equal(languageLabel('en'), 'English');
});

test('商品、颜色、形状在两种语言下都有名字', () => {
  for (const product of PRODUCTS) {
    assert.ok(product.name.zh && product.name.en, `${product.id} 名称缺失`);
    assert.ok(product.enPlural, `${product.id} 缺少英文复数形式`);
    assert.ok(colorName(product.color, 'zh') && colorName(product.color, 'en'), `${product.id} 的颜色没有名字`);
    assert.ok(shapeName(product.shape, 'zh') && shapeName(product.shape, 'en'), `${product.id} 的形状没有名字`);
    assert.equal(colorName(product.color, 'en'), COLORS[product.color].en);
    assert.equal(shapeName(product.shape, 'en'), SHAPES[product.shape].en);
  }
});

test('每种玩法的顾客需求在两种语言下都是完整句子', () => {
  const rng = seededRandom(31337);
  for (const difficultyId of ['easy', 'standard', 'challenge']) {
    const rules = resolveRules(difficultyId, {});
    for (const mode of ORDER_MODES) {
      for (let i = 0; i < 12; i += 1) {
        const order = generateOrder({ mode, rules, rng });
        for (const language of LANGUAGES) {
          const sentence = orderSentence(order, language);
          assert.ok(sentence.length > 0, '句子不能为空');
          assert.ok(!sentence.includes('{'), `${language}/${mode}: 句子还有未替换的占位符：${sentence}`);
          assert.ok(!sentence.includes('undefined'), `${language}/${mode}: 句子出现 undefined：${sentence}`);
          assert.ok(!sentence.includes('hint.') && !sentence.includes('order.'), '句子不应出现键名');
        }
      }
    }
  }
});

test('英文句子使用复数形式，中文用量词', () => {
  const rng = seededRandom(5);
  const rules = resolveRules('standard', {});
  let checked = false;
  for (let i = 0; i < 40 && !checked; i += 1) {
    const order = generateOrder({ mode: 'count', rules, rng });
    if (order.quantity > 1) {
      const product = getProduct(order.constraint.value);
      const en = orderSentence(order, 'en');
      assert.ok(en.includes(product.enPlural), `英文句子应使用复数：${en} / ${product.enPlural}`);
      const zh = orderSentence(order, 'zh');
      assert.ok(zh.includes(product.name.zh), `中文句子应包含商品名：${zh}`);
      checked = true;
    }
  }
  assert.ok(checked, '没有生成到数量大于 1 的订单');
});

test('所有提示语在两种语言下都有对应文案', () => {
  const codes = [
    'empty',
    'notNeeded',
    'tooMany',
    'needMore',
    'needMoreItems',
    'tooManyItems',
    'wrongColor',
    'wrongShape',
    'wrongProduct',
    'correct',
    'noOrder'
  ];
  for (const code of codes) {
    assert.ok(hasKey(`hint.${code}`, 'zh'), `中文缺少 hint.${code}`);
    assert.ok(hasKey(`hint.${code}`, 'en'), `英文缺少 hint.${code}`);
    for (const language of LANGUAGES) {
      const sentence = hintSentence(
        { code, params: { n: 2, product: 'Apple', color: 'red', shape: 'circle', wanted: 'Milk' } },
        language
      );
      assert.ok(sentence.length > 0, `${language}/${code} 提示为空`);
      assert.ok(!sentence.includes('{'), `${language}/${code} 占位符没替换：${sentence}`);
    }
  }
});

test('提示语里的颜色和形状会被翻译成当前语言', () => {
  const zh = hintSentence({ code: 'wrongColor', params: { product: '饮料', color: 'red' } }, 'zh');
  const en = hintSentence({ code: 'wrongColor', params: { product: 'Drink', color: 'red' } }, 'en');
  assert.ok(zh.includes('红色'), zh);
  assert.ok(en.includes('red'), en);
});

test('列表拼接：中文用顿号，英文用 and', () => {
  assert.equal(joinList(['苹果', '饮料'], 'zh'), '苹果、饮料');
  assert.equal(joinList(['apples', 'drinks'], 'en'), 'apples and drinks');
  assert.equal(joinList(['a', 'b', 'c'], 'en'), 'a, b and c');
  assert.equal(joinList([], 'zh'), '');
});

test('付款句子包含金额和找零请求', () => {
  const order = { mode: 'change' };
  const zh = paymentSentence(order, 10, 'zh');
  const en = paymentSentence(order, 10, 'en');
  assert.ok(zh.includes('10 元'));
  assert.ok(zh.includes('零钱'));
  assert.ok(en.includes('10 yuan'));
  assert.ok(en.includes('change'));
});

test('applyToDom 在没有 document 的环境里不会抛错（可安全用于测试）', () => {
  assert.doesNotThrow(() => applyToDom());
});
