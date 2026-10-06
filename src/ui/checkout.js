/**
 * 收银台面板 —— 一单生意分三步走完：
 *   第 1 步 挑选商品 → 第 2 步 算总价 → 第 3 步 找零钱
 * 每一步都只把「需要孩子自己算」的部分留白，其余信息用文字、图案和数字一起呈现。
 */
import { el, clear } from './dom.js';
import { icon } from './icons.js';
import { productArt, moneyChip, moneyText, amountText, bigButton } from './components.js';
import { createKeypad } from './keypad.js';
import { createMoneyArea } from './moneytray.js';
import { createResultPanel } from './result.js';
import { getProduct } from '../data/products.js';
import { denominationsIn } from '../data/denominations.js';

const STEP_ORDER = { shopping: 1, total: 2, payment: 2, change: 3, result: 3 };

export function createCheckout(ctx) {
  const root = el('section', {
    class: 'checkout panel',
    attrs: { 'aria-label': ctx.t('checkout.title') }
  });

  let cache = { key: null };
  let keypad = null;
  let moneyArea = null;
  let feedbackNode = null;
  const resultPanel = createResultPanel(ctx);

  /* ---------------------------- 公共零件 ---------------------------- */

  function stepIndicator(state) {
    const current = STEP_ORDER[state.phase] || 1;
    const steps = [
      { n: 1, label: ctx.t('game.check') },
      { n: 2, label: ctx.t('common.total') },
      { n: 3, label: ctx.t('mode.change') }
    ];
    return el('ol', { class: 'steps', attrs: { 'aria-label': ctx.t('checkout.title') } },
      steps.map((step) =>
        el('li', {
          class: `steps__item ${step.n < current ? 'is-done' : ''} ${step.n === current ? 'is-current' : ''}`
        }, [
          el('span', { class: 'steps__dot', text: step.n < current ? '✓' : String(step.n) }),
          el('span', { class: 'steps__label', text: step.label })
        ])
      )
    );
  }

  function feedbackBanner(state) {
    feedbackNode = el('p', {
      class: `feedback feedback--${state.feedback ? state.feedback.kind : 'none'}`,
      attrs: { role: 'status', 'aria-live': 'polite' }
    });
    return feedbackNode;
  }

  function summaryList(derived, { showSubtotal = false } = {}) {
    const list = el('ul', { class: 'checkout__lines' });
    for (const line of derived.lines) {
      const product = getProduct(line.productId);
      if (!product) continue;
      list.appendChild(
        el('li', { class: 'checkout__line' }, [
          productArt(product, { size: 44 }),
          el('span', { class: 'checkout__line-name', text: product.name[ctx.language] }),
          el('span', { class: 'checkout__line-formula' }, [
            el('span', { class: 'checkout__line-unit', text: String(product.price) }),
            el('span', { class: 'checkout__line-x', text: '×', attrs: { 'aria-hidden': 'true' } }),
            el('span', { class: 'checkout__line-qty', text: String(line.quantity) })
          ]),
          showSubtotal
            ? el('span', { class: 'checkout__line-subtotal' }, [
                el('span', { text: '=' }),
                el('span', { class: 'checkout__line-subtotal-value', text: String(product.price * line.quantity) })
              ])
            : null
        ])
      );
    }
    return list;
  }

  function question(text) {
    return el('p', { class: 'checkout__question', text });
  }

  /* ------------------------------ 各阶段 ---------------------------- */

  function buildShopping(state, derived) {
    root.appendChild(stepIndicator(state));
    root.appendChild(
      el('div', { class: 'checkout__body' }, [
        el('h2', { class: 'checkout__title', text: ctx.t('checkout.stepShopping') }),
        el('p', { class: 'checkout__hint', text: ctx.t('help.step2') }),
        !derived.order
          ? el('p', { class: 'checkout__hint', text: ctx.t('game.freeHint') })
          : el('p', { class: 'checkout__hint', text: ctx.t('help.step3') })
      ])
    );
    const actions = el('div', { class: 'checkout__actions' });
    if (derived.order) {
      actions.appendChild(
        bigButton(ctx, {
          label: ctx.t('game.check'),
          iconName: 'check',
          variant: 'primary',
          onClick: () => ctx.actions.checkBasket()
        })
      );
    } else {
      actions.appendChild(
        bigButton(ctx, {
          label: ctx.t('game.freeCheckout'),
          iconName: 'basket',
          variant: 'primary',
          onClick: () => ctx.actions.goToCheckout()
        })
      );
    }
    root.appendChild(actions);
    root.appendChild(feedbackBanner(state));
  }

  function buildTotal(state, derived) {
    root.appendChild(stepIndicator(state));
    root.appendChild(
      el('div', { class: 'checkout__body' }, [
        el('h2', { class: 'checkout__title', text: ctx.t('checkout.basketList') }),
        summaryList(derived),
        question(ctx.t('checkout.totalQuestion'))
      ])
    );

    const rules = derived.rules;
    const answerArea = el('div', { class: 'checkout__answer' });

    if (rules.choices >= 2) {
      const choices = ctx.actions.totalChoices();
      const grid = el('div', { class: 'choices', attrs: { 'aria-label': ctx.t('checkout.chooseAnswer') } });
      for (const value of choices || []) {
        grid.appendChild(
          el('button', {
            class: 'choices__button',
            type: 'button',
            attrs: { 'aria-label': ctx.t('money.yuan', { n: value }) },
            on: { click: () => ctx.actions.submitTotal(value) }
          }, [el('span', { class: 'choices__value', text: String(value) }), el('span', { class: 'choices__unit', text: ctx.t('money.unit') })])
        );
      }
      answerArea.appendChild(grid);
    } else {
      keypad = createKeypad(ctx, {
        label: ctx.t('checkout.enterAmount'),
        submitLabel: ctx.t('checkout.submitTotal'),
        onSubmit: (value) => ctx.actions.submitTotal(value),
        maxLength: 3
      });
      if (state.totalInput) keypad.setValue(state.totalInput);
      answerArea.appendChild(keypad.root);
    }

    root.appendChild(answerArea);
    root.appendChild(feedbackBanner(state));
    root.appendChild(
      el('div', { class: 'checkout__actions' }, [
        bigButton(ctx, {
          label: ctx.t('checkout.backToShelf'),
          iconName: 'back',
          variant: 'ghost',
          onClick: () => ctx.actions.backToShopping()
        }),
        ctx.actions.hasNextCustomer()
          ? bigButton(ctx, {
              label: ctx.t('common.skip'),
              variant: 'ghost',
              onClick: () => ctx.actions.skipQuestion()
            })
          : null
      ])
    );
    if (keypad) ctx.actions.registerKeypad(keypad);
  }

  function buildPayment(state, derived) {
    const payment = state.payment || { payment: derived.total, notes: [] };
    root.appendChild(stepIndicator(state));
    root.appendChild(
      el('div', { class: 'checkout__body' }, [
        el('h2', { class: 'checkout__title', text: ctx.t('checkout.payment') }),
        el('p', { class: 'checkout__hint', text: ctx.t('checkout.payNotes') }),
        el('div', { class: 'payment-notes' }, payment.notes.map((note) => moneyChip(note.value, ctx.language, { count: note.count }))),
        el('p', { class: 'checkout__rowline' }, [
          el('span', { class: 'checkout__rowline-label', text: `${ctx.t('common.total')}：` }),
          amountText(derived.total, ctx.language, { className: 'amount amount--inline' })
        ]),
        el('p', { class: 'checkout__rowline' }, [
          el('span', { class: 'checkout__rowline-label', text: `${ctx.t('checkout.payment')}：` }),
          amountText(payment.payment, ctx.language, { className: 'amount amount--inline' })
        ])
      ])
    );
    root.appendChild(feedbackBanner(state));
    root.appendChild(
      el('div', { class: 'checkout__actions' }, [
        bigButton(ctx, {
          label: ctx.t('checkout.payNext'),
          iconName: 'coin',
          variant: 'primary',
          onClick: () => ctx.actions.acceptPayment()
        })
      ])
    );
  }

  function buildChange(state, derived) {
    const payment = state.payment || { payment: derived.total, change: 0 };
    const rules = derived.rules;
    const mode = state.answerMode === 'keypad' ? 'keypad' : 'money';

    root.appendChild(stepIndicator(state));
    root.appendChild(
      el('div', { class: 'checkout__body' }, [
        el('h2', { class: 'checkout__title', text: ctx.t('checkout.change') }),
        el('div', { class: 'change-recap' }, [
          el('span', { class: 'change-recap__item' }, [
            el('span', { class: 'change-recap__label', text: `${ctx.t('common.total')}：` }),
            amountText(derived.total, ctx.language, { className: 'amount amount--inline' })
          ]),
          el('span', { class: 'change-recap__item' }, [
            el('span', { class: 'change-recap__label', text: `${ctx.t('checkout.payment')}：` }),
            amountText(payment.payment, ctx.language, { className: 'amount amount--inline' })
          ])
        ]),
        question(ctx.t('checkout.changeQuestion')),
        el('div', { class: 'mode-toggle', attrs: { role: 'group' } }, [
          el('button', {
            class: `mode-toggle__button ${mode === 'money' ? 'is-active' : ''}`,
            type: 'button',
            text: ctx.t('checkout.useMoney'),
            attrs: { 'aria-pressed': String(mode === 'money') },
            on: { click: () => ctx.actions.setAnswerMode('money') }
          }),
          el('button', {
            class: `mode-toggle__button ${mode === 'keypad' ? 'is-active' : ''}`,
            type: 'button',
            text: ctx.t('checkout.useKeypad'),
            attrs: { 'aria-pressed': String(mode === 'keypad') },
            on: { click: () => ctx.actions.setAnswerMode('keypad') }
          })
        ])
      ])
    );

    const answerArea = el('div', { class: 'checkout__answer' });
    if (mode === 'keypad') {
      keypad = createKeypad(ctx, {
        label: ctx.t('checkout.enterAmount'),
        submitLabel: ctx.t('checkout.submitChange'),
        onSubmit: (value) => ctx.actions.submitChangeAmount(value),
        maxLength: 3
      });
      if (state.totalInput) keypad.setValue(state.totalInput);
      answerArea.appendChild(keypad.root);
    } else {
      moneyArea = createMoneyArea(ctx, {
        onPick: (value) => ctx.actions.addChangeMoney(value),
        onRemove: (value) => ctx.actions.removeChangeMoney(value),
        onReset: () => ctx.actions.resetChange(),
        onConfirm: () => ctx.actions.submitChange()
      });
      moneyArea.update({
        denominations: rules.denominations,
        selection: state.changeSelection,
        target: payment.change
      });
      answerArea.appendChild(moneyArea.root);
    }
    root.appendChild(answerArea);
    root.appendChild(feedbackBanner(state));
    if (keypad) ctx.actions.registerKeypad(keypad);
  }

  function build(state, derived) {
    clear(root);
    if (moneyArea && typeof moneyArea.destroy === 'function') moneyArea.destroy();
    keypad = null;
    moneyArea = null;
    ctx.actions.registerKeypad(null);

    if (state.phase === 'result') {
      root.appendChild(resultPanel.root);
      return;
    }
    if (state.phase === 'payment') return buildPayment(state, derived);
    if (state.phase === 'change') return buildChange(state, derived);
    if (state.phase === 'total') return buildTotal(state, derived);
    return buildShopping(state, derived);
  }

  function refreshDynamic(state, derived) {
    if (feedbackNode) {
      const feedback = state.feedback;
      feedbackNode.className = `feedback feedback--${feedback ? feedback.kind : 'none'}`;
      feedbackNode.textContent = feedback ? feedback.text : '';
    }
    if (state.feedback && state.feedback.kind === 'ok' && state.phase === 'shopping') {
      feedbackNode && feedbackNode.classList.add('is-pop');
    }
    if (moneyArea && state.phase === 'change') {
      const payment = state.payment || { change: 0 };
      moneyArea.update({
        denominations: derived.rules.denominations,
        selection: state.changeSelection,
        target: payment.change
      });
    }
  }

  return {
    root,
    update(state, derived) {
      const key = [
        state.phase,
        state.gameMode,
        derived.order ? derived.order.id : 'free',
        ctx.language,
        state.phase === 'change' ? state.answerMode : '',
        state.phase === 'result' ? (state.reward ? state.reward.stars : 0) : ''
      ].join('|');

      if (cache.key !== key) {
        cache = { key };
        build(state, derived);
      }
      resultPanel.update(state, derived);
      refreshDynamic(state, derived);
    },
    destroy() {
      if (moneyArea && typeof moneyArea.destroy === 'function') moneyArea.destroy();
      resultPanel.clear();
      ctx.actions.registerKeypad(null);
    }
  };
}
