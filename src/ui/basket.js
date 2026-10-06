/**
 * 购物篮面板：商品行、加减数量、删除、清空、总价。
 * 每次状态变化重建行列表（行很少，重建比打补丁更不容易出错）。
 */
import { el, clear } from './dom.js';
import { icon } from './icons.js';
import { productArt, amountText } from './components.js';
import { getProduct } from '../data/products.js';
import { cartLines, cartTotal } from '../logic/cart.js';
import { registerDropZone } from './drag.js';

export function createBasket(ctx, { onCheckout } = {}) {
  const list = el('ul', { class: 'basket__list' });
  const footer = el('div', { class: 'basket__footer' });
  const empty = el('p', { class: 'basket__empty' });
  const titleText = el('span');
  const clearLabel = el('span', { class: 'button__label' });
  const checkoutLabel = el('span', { class: 'button__label' });

  const clearButton = el('button', {
    class: 'button button--ghost',
    type: 'button',
    on: { click: () => ctx.actions.emptyBasket() }
  }, [icon('trash'), clearLabel]);

  const checkoutButton = el('button', {
    class: 'button button--primary',
    type: 'button',
    on: { click: () => onCheckout && onCheckout() }
  }, [icon('basket'), checkoutLabel]);

  // 数字按钮：一下就能把数量改成 1-5（PRD 4.4）
  const quickRow = el('div', { class: 'quick-quantity' }, [
    el('span', { class: 'quick-quantity__label' }),
    el('div', { class: 'quick-quantity__buttons' }, [1, 2, 3, 4, 5].map((value) =>
      // 点击处理在 update() 里绑定，因为要作用到当前最后放进购物篮的商品上
      el('button', {
        class: 'quick-quantity__button',
        type: 'button',
        text: String(value)
      })
    ))
  ]);
  const quickLabel = quickRow.querySelector('.quick-quantity__label');
  const quickButtons = [...quickRow.querySelectorAll('.quick-quantity__button')];

  const root = el('section', {
    class: 'basket',
    attrs: { 'aria-label': ctx.t('a11y.basket', { n: 0 }) }
  }, [
    el('header', { class: 'basket__head' }, [
      el('h2', { class: 'basket__title' }, [icon('basket'), titleText]),
      el('span', { class: 'basket__count' })
    ]),
    empty,
    list,
    quickRow,
    el('div', { class: 'basket__total' }, [
      el('span', { class: 'basket__total-label', text: ctx.t('common.total') }),
      amountText(0, ctx.language, { className: 'amount amount--basket' })
    ]),
    footer
  ]);

  const amountNode = root.querySelector('.amount--basket');
  const countNode = root.querySelector('.basket__count');
  const totalLabel = root.querySelector('.basket__total-label');

  function renderRow(line) {
    const product = getProduct(line.productId);
    if (!product) return null;
    return el('li', { class: 'basket__row' }, [
      el('span', { class: 'basket__art' }, [productArt(product, { size: 48 })]),
      el('div', { class: 'basket__info' }, [
        el('span', { class: 'basket__name', text: product.name[ctx.language] }),
        el('span', {
          class: 'basket__unit',
          text: ctx.t('game.eachPrice', { price: `${product.price}` })
        })
      ]),
      el('div', { class: 'stepper stepper--basket', attrs: { role: 'group' } }, [
        el('button', {
          class: 'stepper__button',
          type: 'button',
          attrs: { 'aria-label': ctx.t('a11y.removeProduct', { product: product.name[ctx.language] }) },
          on: { click: () => ctx.actions.removeProduct(line.productId) }
        }, [icon('minus')]),
        el('span', { class: 'stepper__value', text: String(line.quantity) }),
        el('button', {
          class: 'stepper__button',
          type: 'button',
          attrs: { 'aria-label': ctx.t('a11y.addProduct', { product: product.name[ctx.language], price: product.price }) },
          on: { click: () => ctx.actions.addProduct(line.productId) }
        }, [icon('plus')])
      ]),
      el('span', { class: 'basket__subtotal' }, [
        el('span', { class: 'basket__subtotal-value', text: String(line.subtotal) }),
        el('span', { class: 'basket__subtotal-unit', text: ctx.t('money.unit') })
      ]),
      el('button', {
        class: 'icon-button icon-button--danger',
        type: 'button',
        attrs: { 'aria-label': ctx.t('a11y.deleteProduct', { product: product.name[ctx.language] }) },
        on: { click: () => ctx.actions.removeProductLine(line.productId) }
      }, [icon('trash')])
    ]);
  }

  // 把商品拖到购物篮上 = 放进购物篮
  const unregisterDrop = registerDropZone({
    element: root,
    accepts: (data) => data && data.type === 'product',
    onDrop: (data) => ctx.actions.addProduct(data.productId)
  });

  return {
    root,
    update(state, derived = {}) {
      const lines = cartLines(state.cart, ctx.language);
      const total = cartTotal(state.cart);
      const revealTotal = derived.revealTotal !== false;
      clear(list);
      for (const line of lines) {
        const row = renderRow(line);
        if (row) list.appendChild(row);
      }
      const isEmpty = lines.length === 0;
      empty.hidden = !isEmpty;
      list.hidden = isEmpty;
      root.classList.toggle('is-empty', isEmpty);

      // 语言切换后这些文字都要跟着变
      titleText.textContent = ctx.t('game.basket');
      empty.textContent = ctx.t('game.basketEmpty');
      clearLabel.textContent = ctx.t('game.clearBasket');
      checkoutLabel.textContent = ctx.t('game.checkout');
      clearButton.setAttribute('aria-label', ctx.t('game.clearBasket'));
      checkoutButton.setAttribute('aria-label', ctx.t('game.checkout'));

      const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
      countNode.textContent = ctx.t('game.itemCount', { n: quantity });
      totalLabel.textContent = ctx.t('common.total');
      amountNode.textContent = '';
      root.classList.toggle('is-hidden-total', !revealTotal);
      if (revealTotal) {
        amountNode.appendChild(el('span', { class: 'amount__value', text: String(total) }));
        amountNode.appendChild(el('span', { class: 'amount__unit', text: ctx.language === 'en' ? 'yuan' : '元' }));
        totalLabel.setAttribute('aria-label', `${ctx.t('common.total')} ${total}`);
      } else {
        amountNode.appendChild(el('span', { class: 'amount__value amount__value--hidden', text: '?' }));
        totalLabel.setAttribute('aria-label', ctx.t('checkout.totalQuestion'));
      }
      root.setAttribute('aria-label', ctx.t('a11y.basket', { n: quantity }));

      // 快速数量按钮作用于最后放进购物篮的那样商品
      const target = lines.length ? lines[lines.length - 1] : null;
      quickRow.hidden = !target;
      if (target) {
        const product = getProduct(target.productId);
        quickLabel.textContent = ctx.t('game.quickQuantityFor', {
          product: product ? product.name[ctx.language] : target.name
        });
        for (const button of quickButtons) {
          const value = Number(button.textContent);
          const capped = product ? Math.min(value, product.maxQty) : value;
          const active = target.quantity === value;
          button.classList.toggle('is-active', active);
          button.disabled = capped !== value;
          button.setAttribute(
            'aria-label',
            ctx.t('a11y.setQuantity', { product: target.name, n: value })
          );
          button.setAttribute('aria-pressed', String(active));
          button.onclick = () => ctx.actions.setProductQuantity(target.productId, value);
        }
      }

      clear(footer);
      if (!isEmpty) {
        footer.append(clearButton, checkoutButton);
      }
      checkoutButton.disabled = isEmpty;
      clearButton.disabled = isEmpty;
    },
    destroy() {
      unregisterDrop();
    }
  };
}
