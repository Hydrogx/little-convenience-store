/**
 * 顾客订单卡片：头像 + 对话气泡 + 颜色/形状/数量徽章 + 计时。
 * 订单信息同时用图案、文字和数字表达，不依赖单一通道。
 */
import { el, clear } from './dom.js';
import { icon } from './icons.js';
import { productArt, colorDot, shapeBadge, moneyText } from './components.js';
import { getCustomer } from '../data/customers.js';
import { getProduct } from '../data/products.js';
import { orderSentence } from '../i18n/phrases.js';
import { cartTotalQuantity } from '../logic/cart.js';

export function createOrderCard(ctx) {
  const root = el('section', {
    class: 'order-card',
    attrs: { 'aria-label': ctx.t('a11y.order') }
  });
  let cache = { signature: null };

  function buildFree() {
    clear(root);
    root.appendChild(
      el('div', { class: 'order-card__free' }, [
        el('span', { class: 'order-card__free-emoji', text: '🛍️', attrs: { 'aria-hidden': 'true' } }),
        el('p', { class: 'order-card__free-text', text: ctx.t('game.freeHint') }),
        el('p', { class: 'order-card__free-note', text: ctx.t('checkout.freeModeNoTotal') })
      ])
    );
  }

  function build(state, derived) {
    const order = derived.order;
    const rules = derived.rules;
    if (!order) {
      buildFree();
      return;
    }
    clear(root);

    const customer = getCustomer(order.customerId);
    root.appendChild(
      el('header', { class: 'order-card__head' }, [
        el('span', {
          class: 'customer-avatar',
          text: customer ? customer.emoji : '🙂',
          attrs: { 'aria-hidden': 'true' }
        }),
        el('div', { class: 'order-card__who' }, [
          el('strong', {
            class: 'order-card__name',
            text: ctx.t('game.customerArrives', { name: customer ? customer.name[ctx.language] : '' })
          }),
          el('span', { class: 'order-card__says', text: ctx.t('game.says') })
        ])
      ])
    );

    root.appendChild(
      el('div', { class: 'speech-bubble' }, [
        el('p', { class: 'speech-bubble__text', text: orderSentence(order, ctx.language) })
      ])
    );

    const badges = el('div', { class: 'order-badges' });
    if (order.constraint.type === 'color') {
      badges.appendChild(colorDot(order.constraint.value, ctx.language));
    }
    if (order.constraint.type === 'shape') {
      badges.appendChild(shapeBadge(order.constraint.value, ctx.language));
    }
    if (order.constraint.productId) {
      const product = getProduct(order.constraint.productId);
      if (product) {
        badges.appendChild(
          el('span', { class: 'order-badges__product' }, [
            productArt(product, { size: 40 }),
            el('span', { text: product.name[ctx.language] })
          ])
        );
      }
    }
    badges.appendChild(
      el('span', { class: 'order-badges__count' }, [
        el('span', { class: 'order-badges__num', text: String(order.quantity) }),
        el('span', { class: 'order-badges__unit', text: ctx.t('unit.items') })
      ])
    );
    root.appendChild(badges);

    // 清单型订单（算总价 / 找零钱）：把单价和数量都摆出来，孩子自己算总价
    if (order.fixedLines && order.lines.length) {
      const list = el('ul', { class: 'order-lines' });
      for (const line of order.lines) {
        const product = getProduct(line.productId);
        if (!product) continue;
        list.appendChild(
          el('li', { class: 'order-lines__item' }, [
            productArt(product, { size: 40 }),
            el('span', { class: 'order-lines__name', text: product.name[ctx.language] }),
            el('span', { class: 'order-lines__price' }, [
              el('span', { class: 'order-lines__unit', text: String(product.price) }),
              el('span', { class: 'order-lines__unit-label', text: ctx.t('money.unit') })
            ]),
            el('span', {
              class: 'order-lines__times',
              text: `× ${line.quantity}`,
              attrs: { 'aria-label': ctx.t('game.itemCount', { n: line.quantity }) }
            })
          ])
        );
      }
      root.appendChild(list);
    }

    // 约束型订单：显示「已拿 / 需要」的进度
    if (!order.fixedLines) {
      const have = cartTotalQuantity(state.cart);
      const need = order.quantity;
      root.appendChild(
        el('div', { class: 'order-card__progress' }, [
          el('span', { class: 'order-card__progress-text', text: ctx.t('game.progress', { have, need }) }),
          el('div', { class: 'order-card__progress-bar' }, [
            el('span', {
              class: 'order-card__progress-fill',
              style: { width: `${need ? Math.min(100, Math.round((have / need) * 100)) : 0}%` }
            })
          ])
        ])
      );
    }

    if (rules.timerSeconds > 0 && state.phase !== 'shopping' && state.phase !== 'result') {
      root.appendChild(
        el('p', {
          class: `order-card__timer ${state.session.timerLeft <= 10 ? 'is-low' : ''}`,
          attrs: { 'aria-label': ctx.t('a11y.timer', { n: state.session.timerLeft }) }
        }, [icon('refresh'), el('span', { text: ctx.t('game.timer', { n: state.session.timerLeft }) })])
      );
    }

    if (state.payment && state.phase !== 'shopping') {
      root.appendChild(
        el('p', { class: 'order-card__pay' }, [
          el('span', { class: 'order-card__pay-label', text: `${ctx.t('checkout.payment')}：` }),
          moneyText(state.payment.payment, ctx.language)
        ])
      );
    }
  }

  return {
    root,
    update(state, derived) {
      const order = derived.order;
      const signature = [
        order ? order.id : 'free',
        ctx.language,
        cartTotalQuantity(state.cart),
        state.phase,
        state.session.timerLeft,
        state.session.timerRunning ? 'run' : 'idle',
        state.payment ? state.payment.payment : 0
      ].join('|');
      if (cache.signature !== signature) {
        build(state, derived);
        cache = { signature };
      }
    }
  };
}
