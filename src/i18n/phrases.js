/**
 * 句子拼装层：把「结构化的订单 / 提示」翻译成完整的儿童语言句子。
 * 界面只调用这里，不自己拼字符串，这样中英文都能保证通顺。
 */
import { t, getLanguage } from './index.js';
import { productLabel, getProduct } from '../data/products.js';
import { colorName } from '../data/colors.js';
import { shapeName } from '../data/shapes.js';
import { formatYuan } from '../logic/money.js';

/** 把列表拼成自然语言：中文用「、」，英文用逗号 + and。 */
export function joinList(items, language = getLanguage()) {
  const list = items.filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (language === 'en') {
    const separator = t('order.listJoin', {}, language);
    const andWord = t('order.listAnd', {}, language);
    return `${list.slice(0, -1).join(separator)} ${andWord} ${list[list.length - 1]}`;
  }
  return list.join(t('order.listJoin', {}, language));
}

/** 订单里某一行商品的说法，例如「2 个苹果」/「2 apples」。 */
export function lineText(line, language = getLanguage()) {
  return t(
    'order.itemLine',
    { n: line.quantity, product: productLabel(line.productId, language, line.quantity) },
    language
  );
}

/** 顾客的整句需求。 */
export function orderSentence(order, language = getLanguage()) {
  if (!order) return '';
  const quantity = order.quantity;
  const constraint = order.constraint || {};

  if (constraint.type === 'color') {
    return t('order.wantColor', { n: quantity, color: colorName(constraint.value, language) }, language);
  }
  if (constraint.type === 'shape') {
    const shape = shapeName(constraint.value, language);
    if (constraint.productId) {
      return t(
        'order.wantShapeProduct',
        { n: quantity, shape, product: productLabel(constraint.productId, language, quantity) },
        language
      );
    }
    return t('order.wantShape', { n: quantity, shape }, language);
  }
  if (constraint.type === 'product') {
    return t(
      'order.wantProduct',
      { n: quantity, product: productLabel(constraint.value, language, quantity) },
      language
    );
  }
  const list = joinList((order.lines || []).map((line) => lineText(line, language)), language);
  return t('order.wantItems', { list }, language);
}

/** 订单上的关键信息标签，用于无障碍描述和订单小卡。 */
export function orderBadges(order, language = getLanguage()) {
  const badges = [];
  const constraint = (order && order.constraint) || {};
  if (constraint.type === 'color') {
    badges.push({ kind: 'color', value: constraint.value, label: colorName(constraint.value, language) });
  }
  if (constraint.type === 'shape') {
    badges.push({ kind: 'shape', value: constraint.value, label: shapeName(constraint.value, language) });
  }
  if (constraint.productId) {
    const product = getProduct(constraint.productId);
    badges.push({
      kind: 'product',
      value: constraint.productId,
      label: product ? product.name[language] || product.name.zh : constraint.productId,
      color: product ? product.color : null,
      shape: product ? product.shape : null
    });
  }
  badges.push({ kind: 'count', value: order ? order.quantity : 0, label: `${order ? order.quantity : 0}` });
  return badges;
}

/**
 * 把 checkCart() 返回的 hint 翻译成鼓励性句子。
 * 参数里的颜色 / 形状是原始 id，这里统一本地化。
 */
export function hintSentence(hint, language = getLanguage()) {
  if (!hint || !hint.code) return '';
  const params = { ...(hint.params || {}) };
  if (params.color) params.color = colorName(params.color, language);
  if (params.shape) params.shape = shapeName(params.shape, language);
  const key = `hint.${hint.code}`;
  const text = t(key, params, language);
  return text === key ? '' : text;
}

/** 顾客付款那句话。 */
export function paymentSentence(order, payment, language = getLanguage()) {
  const amount = formatYuan(payment, language);
  const wantsChange = order && order.mode === 'change';
  const sentence = t('order.payWith', { money: amount }, language);
  return wantsChange ? `${sentence} ${t('order.pleaseChange', {}, language)}` : sentence;
}

export { formatYuan };
