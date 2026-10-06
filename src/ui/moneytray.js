/**
 * 找零区：零钱盒（可点的纸币硬币）+ 找零盘（已经放进去的钱）+ 实时提示。
 * 提示同时给出「还差多少 / 多了多少」，颜色和图标都只是辅助，文字才是主要信息。
 */
import { el, clear } from './dom.js';
import { icon } from './icons.js';
import { moneyChip, amountText } from './components.js';
import { selectionCounts, selectionTotal } from '../logic/money.js';
import { makeDraggable, registerDropZone } from './drag.js';

export function createMoneyArea(ctx, { onPick, onRemove, onReset, onConfirm } = {}) {
  const drawer = el('div', { class: 'money-drawer', role: 'group' });
  const tray = el('div', { class: 'money-tray__items' });
  const trayHint = el('p', { class: 'money-tray__hint', attrs: { role: 'status', 'aria-live': 'polite' } });
  const resetButton = el('button', {
    class: 'button button--ghost',
    type: 'button',
    on: { click: () => onReset && onReset() }
  }, [icon('refresh'), el('span', { class: 'button__label', text: ctx.t('checkout.resetChange') })]);
  const confirmButton = el('button', {
    class: 'button button--primary',
    type: 'button',
    on: { click: () => onConfirm && onConfirm() }
  }, [icon('check'), el('span', { class: 'button__label', text: ctx.t('checkout.confirmChange') })]);

  const root = el('div', { class: 'money-area' }, [
    el('p', { class: 'money-area__label', text: ctx.t('checkout.changeBox') }),
    drawer,
    el('div', { class: 'money-tray' }, [
      el('p', { class: 'money-area__label', text: ctx.t('checkout.changeTray') }),
      tray,
      trayHint
    ]),
    el('div', { class: 'money-area__actions' }, [resetButton, confirmButton])
  ]);

  let drawerKey = null;

  const stopDragging = [];

  function buildDrawer(denominations) {
    const key = `${denominations.join(',')}|${ctx.language}`;
    if (key === drawerKey) return;
    drawerKey = key;
    while (stopDragging.length) stopDragging.pop()();
    clear(drawer);
    for (const value of denominations) {
      const chip = moneyChip(value, ctx.language, {
        onClick: (picked) => onPick && onPick(picked)
      });
      // 也可以直接把钱拖进找零盘
      stopDragging.push(
        makeDraggable(chip, () => ({ type: 'money', value }), { ghostFrom: () => chip })
      );
      drawer.appendChild(chip);
    }
  }

  // 把纸币硬币拖到找零盘上 = 放进找零盘
  const unregisterDrop = registerDropZone({
    element: tray,
    accepts: (data) => data && data.type === 'money',
    onDrop: (data) => onPick && onPick(data.value)
  });

  function update({ denominations, selection, target }) {
    buildDrawer(denominations || []);    const counts = selectionCounts(selection);
    clear(tray);
    if (!counts.length) {
      tray.appendChild(el('span', { class: 'money-tray__empty', text: ctx.t('checkout.trayEmpty') }));
    } else {
      for (const item of counts) {
        tray.appendChild(
          moneyChip(item.value, ctx.language, {
            count: item.count,
            onClick: (picked) => onRemove && onRemove(picked),
            small: true
          })
        );
      }
    }

    const total = selectionTotal(selection);
    const wanted = Math.max(0, Math.round(target || 0));
    const diff = wanted - total;
    clear(trayHint);
    if (diff === 0) {
      trayHint.classList.remove('is-over', 'is-under');
      trayHint.classList.add('is-exact');
      trayHint.appendChild(icon('check'));
      trayHint.appendChild(el('span', { text: ctx.t('checkout.exactEnough') }));
    } else if (diff > 0) {
      trayHint.classList.remove('is-over', 'is-exact');
      trayHint.classList.add('is-under');
      trayHint.appendChild(el('span', { text: ctx.t('checkout.remaining', { money: ctx.moneyLabel(diff) }) }));
    } else {
      trayHint.classList.remove('is-under', 'is-exact');
      trayHint.classList.add('is-over');
      trayHint.appendChild(el('span', { text: ctx.t('checkout.excess', { money: ctx.moneyLabel(-diff) }) }));
    }
    trayHint.appendChild(el('span', { class: 'money-tray__total', text: ctx.t('checkout.received', { money: ctx.moneyLabel(total) }) }));
    trayHint.setAttribute('aria-label', `${ctx.t('a11y.changeTray', { money: ctx.moneyLabel(total) })}`);
    confirmButton.disabled = diff !== 0;
    return { total, diff };
  }

  return {
    root,
    update,
    destroy() {
      unregisterDrop();
      while (stopDragging.length) stopDragging.pop()();
    }
  };
}

export { amountText };
