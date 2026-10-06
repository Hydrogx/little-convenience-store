/**
 * 便利店主场景：顾客订单 + 货架 + 购物篮 + 收银台。
 * 桌面端左右分栏，手机端按「订单 → 货架 → 购物篮 → 收银台」上下排列（PRD 7.2）。
 */
import { el } from '../dom.js';
import { createOrderCard } from '../order.js';
import { createShelf } from '../shelf.js';
import { createBasket } from '../basket.js';
import { createCheckout } from '../checkout.js';

export function createGameScreen(ctx) {
  const orderCard = createOrderCard(ctx);
  const shelf = createShelf(ctx);
  const basket = createBasket(ctx, { onCheckout: () => ctx.actions.goToCheckout() });
  const checkout = createCheckout(ctx);

  const root = el('main', {
    class: 'game',
    id: 'main-region',
    attrs: { 'aria-label': ctx.t('a11y.mainRegion') }
  }, [
    el('div', { class: 'game__area game__area--order' }, [orderCard.root]),
    el('div', { class: 'game__area game__area--shelf' }, [shelf.root]),
    el('div', { class: 'game__area game__area--basket' }, [basket.root]),
    el('div', { class: 'game__area game__area--checkout' }, [checkout.root])
  ]);

  const background = el('span', { class: 'game__awning', attrs: { 'aria-hidden': 'true' } });
  root.prepend(background);

  return {
    root,
    update(state, derived) {
      orderCard.update(state, derived);
      shelf.update(state, derived);
      basket.update(state, derived);
      checkout.update(state, derived);
    },
    destroy() {
      checkout.destroy();
      basket.destroy();
    }
  };
}
