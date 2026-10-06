/**
 * 货架：商品卡片网格。
 * 卡片只在开局时创建一次，之后只更新数量角标 —— 这样点击时的弹跳动画不会被重置，
 * 商品插画（独立 SVG 文件）也不会被反复重新加载。
 */
import { el } from './dom.js';
import { icon } from './icons.js';
import { productArt, colorDot, shapeBadge } from './components.js';
import { unlockedProducts } from '../data/products.js';
import { cartQuantity } from '../logic/cart.js';
import { makeDraggable } from './drag.js';

export function createShelf(ctx) {
  const root = el('section', {
    class: 'shelf',
    attrs: { 'aria-label': ctx.t('game.shelf') }
  });
  const grid = el('div', { class: 'shelf__grid' });
  root.appendChild(grid);

  const cards = new Map();
  let renderedLanguage = null;

  function buildCard(product) {
    const card = el('div', { class: 'product-card', dataset: { product: product.id } });
    const addButton = el('button', {
      class: 'product-card__add',
      type: 'button',
      dataset: { sound: 'pop' },
      on: { click: () => ctx.actions.addProduct(product.id) }
    }, [
      el('span', { class: 'product-card__art' }, [productArt(product, { size: 96 })]),
      el('span', { class: 'product-card__name', text: product.name[ctx.language] }),
      el('span', { class: 'product-card__price' }, [
        el('span', { class: 'product-card__price-value', text: String(product.price) }),
        el('span', { class: 'product-card__price-unit', text: ctx.t('money.unit') })
      ]),
      el('span', { class: 'product-card__tags' }, [colorDot(product.color, ctx.language), shapeBadge(product.shape, ctx.language)])
    ]);

    const badge = el('span', { class: 'product-card__badge', attrs: { 'aria-hidden': 'true' } });
    const stepper = el('div', { class: 'stepper', attrs: { role: 'group' } });
    const minus = el('button', {
      class: 'stepper__button',
      type: 'button',
      dataset: { sound: 'none' },
      attrs: { 'aria-label': ctx.t('a11y.removeProduct', { product: product.name[ctx.language] }) },
      on: { click: () => ctx.actions.removeProduct(product.id) }
    }, [icon('minus')]);
    const qty = el('span', { class: 'stepper__value', text: '0' });
    const plus = el('button', {
      class: 'stepper__button',
      type: 'button',
      dataset: { sound: 'pop' },
      attrs: { 'aria-label': ctx.t('a11y.addProduct', { product: product.name[ctx.language], price: product.price }) },
      on: { click: () => ctx.actions.addProduct(product.id) }
    }, [icon('plus')]);
    stepper.append(minus, qty, plus);

    card.append(addButton, badge, stepper);

    // 商品卡片可以拖进购物篮（点一下同样是加入，两条路都保留）
    const stopDrag = makeDraggable(
      addButton,
      () => ({ type: 'product', productId: product.id }),
      { ghostFrom: () => card.querySelector('.product-card__art') }
    );

    return { card, addButton, badge, stepper, qty, product, stopDrag };
  }

  function buildAll() {
    for (const entry of cards.values()) entry.stopDrag();
    grid.replaceChildren();
    cards.clear();
    for (const product of unlockedProducts()) {
      const entry = buildCard(product);
      cards.set(product.id, entry);
      grid.appendChild(entry.card);
    }
    renderedLanguage = ctx.language;
  }

  buildAll();

  return {
    root,
    update(state) {
      // 商品名、颜色名、形状名都要跟着语言变，所以换语言时重建货架
      if (renderedLanguage !== ctx.language) buildAll();
      for (const [productId, entry] of cards) {
        const quantity = cartQuantity(state.cart, productId);
        const label = ctx.t('a11y.addProduct', {
          product: entry.product.name[ctx.language],
          price: `${entry.product.price}`
        });
        entry.addButton.setAttribute('aria-label', label);
        entry.qty.textContent = String(quantity);
        entry.badge.textContent = String(quantity);
        entry.card.classList.toggle('is-in-cart', quantity > 0);
        entry.badge.hidden = quantity === 0;
        entry.stepper.hidden = quantity === 0;
      }
    }
  };
}
