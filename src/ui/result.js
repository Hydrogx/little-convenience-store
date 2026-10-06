/**
 * 结果面板：答对后的庆祝、星星奖励、以及完整的计算过程。
 * 计算过程是「教学时刻」——把 3 × 2 = 6 也就是 3 + 3 = 6 这种关系摆出来。
 */
import { el, clear } from './dom.js';
import { icon } from './icons.js';
import { starRow, confetti, moneyText } from './components.js';
import { getProduct } from '../data/products.js';
import { decorationLabel } from '../logic/progress.js';

export function createResultPanel(ctx) {
  const root = el('section', { class: 'result', attrs: { 'aria-live': 'polite' } });
  let cache = { rewardKey: null };

  function renderSteps(steps) {
    const list = el('ul', { class: 'result__steps' });
    for (const step of steps) {
      if (step.type === 'total') {
        list.appendChild(
          el('li', { class: 'result__step result__step--total' }, [
            el('span', { class: 'result__step-label', text: ctx.t('common.total') }),
            el('span', { class: 'result__step-math', text: `${step.total}` })
          ])
        );
        continue;
      }
      const product = getProduct(step.productId);
      list.appendChild(
        el('li', { class: 'result__step' }, [
          el('span', { class: 'result__step-label', text: product ? product.name[ctx.language] : step.productId }),
          el('span', { class: 'result__step-math', text: step.multiplyText }),
          step.showMultiply
            ? el('span', { class: 'result__step-note', text: `→ ${step.repeatedText}` })
            : null
        ])
      );
    }
    return list;
  }

  function build(state, derived) {
    const reward = state.reward || { stars: 0, coins: 0, steps: [], skipped: false };
    clear(root);
    root.classList.toggle('result--skipped', Boolean(reward.skipped));

    const header = el('div', { class: 'result__head' }, [
      el('span', {
        class: 'result__emoji',
        text: reward.skipped ? '🙂' : reward.stars >= 3 ? '🎉' : '😊',
        attrs: { 'aria-hidden': 'true' }
      }),
      el('h2', { class: 'result__title', text: reward.skipped ? ctx.t('result.encourage') : ctx.t('result.greatJob') })
    ]);
    root.appendChild(header);

    if (!reward.skipped) {
      root.appendChild(starRow(reward.stars));
      root.appendChild(
        el('p', {
          class: 'result__reward',
          attrs: { 'aria-label': ctx.t('a11y.stars', { n: reward.stars }) }
        }, [icon('star'), el('span', { text: ctx.t('result.stars', { n: reward.stars }) })])
      );
      root.appendChild(
        el('p', { class: 'result__reward' }, [icon('coin'), el('span', { text: ctx.t('result.coins', { n: reward.coins }) })])
      );
      if (reward.streak >= 2) {
        root.appendChild(el('p', { class: 'result__streak', text: ctx.t('result.streak', { n: reward.streak }) }));
      }
      if (reward.newlyUnlocked && reward.newlyUnlocked.length) {
        root.appendChild(
          el('p', { class: 'result__unlock' }, [
            el('span', { text: '🎁', attrs: { 'aria-hidden': 'true' } }),
            el('span', { text: ctx.t('result.unlock', { name: decorationLabel(reward.newlyUnlocked[0], ctx.language) }) })
          ])
        );
      }
    }

    if (reward.steps && reward.steps.length) {
      root.appendChild(el('h3', { class: 'result__subtitle', text: ctx.t('result.process') }));
      root.appendChild(renderSteps(reward.steps));
    }

    if (reward.changeLine) {
      root.appendChild(
        el('p', { class: 'result__change' }, [
          el('span', { class: 'result__step-label', text: ctx.t('checkout.change') }),
          el('span', { class: 'result__step-math', text: reward.changeLine })
        ])
      );
    }

    if (state.payment && reward.changeLine) {
      root.appendChild(
        el('p', { class: 'result__paid' }, [
          el('span', { text: `${ctx.t('checkout.received', { money: '' })}`.trim() }),
          moneyText(state.payment.payment, ctx.language)
        ])
      );
    }

    const actions = el('div', { class: 'result__actions' });
    if (derived.order && ctx.actions.hasNextCustomer()) {
      actions.appendChild(
        el('button', {
          class: 'button button--primary button--big',
          type: 'button',
          on: { click: () => ctx.actions.nextCustomer() }
        }, [icon('basket'), el('span', { class: 'button__label', text: ctx.t('result.next') })])
      );
    }
    actions.appendChild(
      el('button', {
        class: 'button button--ghost button--big',
        type: 'button',
        on: { click: () => ctx.actions.goHome() }
      }, [icon('back'), el('span', { class: 'button__label', text: ctx.t('result.home') })])
    );
    root.appendChild(actions);
  }

  return {
    root,
    update(state, derived) {
      const reward = state.reward;
      const key = reward
        ? `${state.session.orderCount}|${reward.stars}|${reward.coins}|${reward.skipped ? 'skip' : 'done'}|${ctx.language}`
        : null;
      if (cache.rewardKey === key) return;
      cache = { rewardKey: key };
      if (!reward) {
        clear(root);
        return;
      }
      build(state, derived);
      if (!reward.skipped) confetti(root, { enabled: ctx.animate });
    },
    /** 离开结果页时清空，避免下一位顾客看到上一单的成绩。 */
    clear() {
      cache = { rewardKey: null };
      clear(root);
    }
  };
}
