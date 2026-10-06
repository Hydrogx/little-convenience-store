/**
 * 首页：直接展示便利店场景，不放营销长页面（PRD 7.1）。
 * 标题、开始按钮、自由购物、数学练习（五种玩法）、设置、语言、音效、家长入口全在这里。
 */
import { el, clear } from '../dom.js';
import { icon } from '../icons.js';
import { languageSwitch, statChip } from '../components.js';
import { createHoldButton } from '../holdbutton.js';
import { MATH_MODES } from '../../data/modes.js';
import { DIFFICULTY_IDS, getDifficulty, MIX_MODES } from '../../data/levels.js';
import { DECORATIONS, nextDecoration } from '../../data/decorations.js';

export function createHomeScreen(ctx) {
  const root = el('main', { class: 'home', id: 'main-region' });

  /* ------------------------------ 场景 ------------------------------ */
  const decorLayer = el('div', { class: 'storefront__decor', attrs: { 'aria-hidden': 'true' } });
  const signTitle = el('span', { class: 'storefront__title' });
  const signSub = el('span', { class: 'storefront__subtitle' });

  const scene = el('section', { class: 'storefront' }, [
    decorLayer,
    el('div', { class: 'storefront__awning', attrs: { 'aria-hidden': 'true' } }),
    el('div', { class: 'storefront__sign' }, [signTitle, signSub]),
    el('div', { class: 'storefront__window', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { class: 'storefront__shelf', text: '🍎🍌🍪' }),
      el('span', { class: 'storefront__shelf', text: '🥤🥛🧃' }),
      el('span', { class: 'storefront__shelf', text: '🥪🧀🍫' })
    ]),
    el('div', { class: 'storefront__door', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { class: 'storefront__door-sign', text: 'OPEN' })
    ]),
    el('div', { class: 'storefront__ground', attrs: { 'aria-hidden': 'true' } })
  ]);

  /* ------------------------------ 数据 ------------------------------ */
  const statsRow = el('div', { class: 'home__stats' });
  const starChip = statChip('star', 0, '', '');
  const coinChip = statChip('coin', 0, '', '');
  const orderChip = statChip('basket', 0, '', '');
  const streakChip = statChip('check', 0, '', '');
  statsRow.append(starChip, coinChip, orderChip, streakChip);

  /* ------------------------------ 难度 ------------------------------ */
  const difficultyRow = el('div', { class: 'segmented', role: 'radiogroup' });
  const difficultyButtons = new Map();
  for (const id of DIFFICULTY_IDS) {
    const button = el('button', {
      class: 'segmented__button',
      type: 'button',
      role: 'radio',
      on: { click: () => ctx.actions.setDifficulty(id) }
    }, [
      el('span', { class: 'segmented__label' }),
      el('span', { class: 'segmented__blurb' })
    ]);
    difficultyButtons.set(id, button);
    difficultyRow.appendChild(button);
  }
  const difficultyHint = el('p', { class: 'home__hint' });

  /* ---------------------------- 主按钮 ----------------------------- */
  const startButton = el('button', {
    class: 'button button--primary button--huge',
    type: 'button',
    on: { click: () => ctx.actions.startMixed() }
  }, [el('span', { class: 'button__emoji', text: '🎬', attrs: { 'aria-hidden': 'true' } }), el('span', { class: 'button__label' })]);
  const freeButton = el('button', {
    class: 'button button--secondary button--huge',
    type: 'button',
    on: { click: () => ctx.actions.startGame('free') }
  }, [el('span', { class: 'button__emoji', text: '🛍️', attrs: { 'aria-hidden': 'true' } }), el('span', { class: 'button__label' })]);

  /* ---------------------------- 玩法卡片 ---------------------------- */
  const modeGrid = el('div', { class: 'mode-grid', attrs: { 'aria-label': ctx.t('a11y.modeSelect') } });
  const modeCards = [];

  function buildModeCards() {
    clear(modeGrid);
    modeCards.length = 0;
    for (const mode of MATH_MODES) {
      const title = el('span', { class: 'mode-card__title' });
      const desc = el('span', { class: 'mode-card__desc' });
      const button = el('button', {
        class: 'mode-card',
        type: 'button',
        on: { click: () => ctx.actions.startGame(mode.id) }
      }, [
        el('span', { class: 'mode-card__emoji', text: mode.emoji, attrs: { 'aria-hidden': 'true' } }),
        title,
        desc
      ]);
      modeCards.push({ mode, button, title, desc });
      modeGrid.appendChild(button);
    }
  }

  /* ---------------------------- 装饰展示 ---------------------------- */
  const decorStrip = el('div', { class: 'decor-strip', attrs: { 'aria-label': ctx.t('a11y.decorList') } });
  const decorNext = el('p', { class: 'home__hint' });

  /* ---------------------------- 设置一行 ---------------------------- */
  const langHolder = el('div', { class: 'home__control' });
  const soundToggle = el('button', {
    class: 'button button--ghost',
    type: 'button',
    on: { click: () => ctx.actions.toggleSound() }
  }, [icon('sound'), el('span', { class: 'button__label' })]);

  const animationToggle = el('button', {
    class: 'button button--ghost',
    type: 'button',
    on: { click: () => ctx.actions.toggleAnimation() }
  }, [el('span', { class: 'button__emoji', text: '✨', attrs: { 'aria-hidden': 'true' } }), el('span', { class: 'button__label' })]);

  const helpButton = el('button', {
    class: 'button button--ghost',
    type: 'button',
    on: { click: () => ctx.actions.openHelp() }
  }, [icon('help'), el('span', { class: 'button__label' })]);

  const parentButton = createHoldButton(ctx, {
    labelKey: 'home.parentSettings',
    hintKey: 'home.holdHint',
    onUnlock: () => ctx.actions.openSettings()
  });

  const settingsRow = el('div', { class: 'home__settings' }, [
    langHolder,
    soundToggle,
    animationToggle,
    helpButton,
    parentButton.root
  ]);

  const footer = el('p', { class: 'home__footer' });

  const panel = el('section', { class: 'home__panel' }, [
    statsRow,
    el('h2', { class: 'home__section-title' }),
    difficultyRow,
    difficultyHint,
    el('div', { class: 'home__primary' }, [startButton, freeButton]),
    el('h2', { class: 'home__section-title' }),
    modeGrid,
    el('h2', { class: 'home__section-title' }),
    decorStrip,
    decorNext,
    settingsRow,
    footer
  ]);

  root.append(scene, panel);

  const sectionTitles = panel.querySelectorAll('.home__section-title');

  buildModeCards();

  return {
    root,
    update(state) {
      signTitle.textContent = ctx.t('app.title');
      signSub.textContent = ctx.t('app.tagline');

      starChip.querySelector('.stat-chip__value').textContent = String(state.progress.stars);
      starChip.querySelector('.stat-chip__label').textContent = ctx.t('home.stars');
      starChip.setAttribute('aria-label', ctx.t('a11y.stars', { n: state.progress.stars }));
      coinChip.querySelector('.stat-chip__value').textContent = String(state.progress.coins);
      coinChip.querySelector('.stat-chip__label').textContent = ctx.t('home.coins');
      coinChip.setAttribute('aria-label', ctx.t('a11y.coins', { n: state.progress.coins }));
      orderChip.querySelector('.stat-chip__value').textContent = String(state.progress.ordersCompleted);
      orderChip.querySelector('.stat-chip__label').textContent = ctx.t('home.orders');
      streakChip.querySelector('.stat-chip__value').textContent = String(state.progress.bestStreak);
      streakChip.querySelector('.stat-chip__label').textContent = ctx.t('home.bestStreak');

      sectionTitles[0].textContent = ctx.t('home.difficulty');
      sectionTitles[1].textContent = ctx.t('home.mathPractice');
      sectionTitles[2].textContent = ctx.t('home.decor');

      for (const [id, button] of difficultyButtons) {
        const level = getDifficulty(id);
        button.querySelector('.segmented__label').textContent = level.label[state.language];
        button.querySelector('.segmented__blurb').textContent = level.blurb[state.language];
        const active = state.difficulty === id;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-checked', String(active));
      }
      difficultyHint.textContent = getDifficulty(state.difficulty).blurb[state.language];

      startButton.querySelector('.button__label').textContent = ctx.t('home.startGame');
      startButton.disabled = false;
      freeButton.querySelector('.button__label').textContent = ctx.t('home.freeShopping');

      for (const card of modeCards) {
        card.title.textContent = ctx.t(card.mode.label);
        card.desc.textContent = ctx.t(card.mode.desc);
        const supported = MIX_MODES[state.difficulty] || [];
        card.button.classList.toggle('is-muted', !supported.includes(card.mode.id));
        card.button.title = ctx.t(card.mode.desc);
      }

      clear(decorLayer);
      clear(decorStrip);
      const unlocked = DECORATIONS.filter((item) => state.progress.ordersCompleted >= item.unlockAt);
      for (const item of unlocked) {
        decorLayer.appendChild(el('span', { class: 'storefront__decor-item', text: item.emoji }));
        decorStrip.appendChild(
          el('span', { class: 'decor-chip', attrs: { 'aria-label': item.name[state.language] } }, [
            el('span', { class: 'decor-chip__emoji', text: item.emoji, attrs: { 'aria-hidden': 'true' } }),
            el('span', { class: 'decor-chip__name', text: item.name[state.language] })
          ])
        );
      }
      if (!unlocked.length) {
        decorStrip.appendChild(el('span', { class: 'decor-chip decor-chip--empty', text: ctx.t('home.decorNone') }));
      }
      const next = nextDecoration(state.progress.ordersCompleted);
      if (next) {
        const remaining = next.unlockAt - state.progress.ordersCompleted;
        decorNext.textContent = ctx.t('home.decorNext', { n: remaining, name: next.name[state.language] });
      } else {
        decorNext.textContent = ctx.t('home.decorAll');
      }

      clear(langHolder);
      langHolder.appendChild(el('span', { class: 'home__control-label', text: ctx.t('home.language') }));
      langHolder.appendChild(languageSwitch(ctx, state));

      soundToggle.querySelector('.button__label').textContent = `${ctx.t('home.sound')}：${ctx.t(
        state.soundEnabled ? 'common.on' : 'common.off'
      )}`;
      soundToggle.setAttribute('aria-pressed', String(state.soundEnabled));
      soundToggle.setAttribute(
        'aria-label',
        ctx.t('a11y.soundToggle', { state: state.soundEnabled ? ctx.t('common.on') : ctx.t('common.off') })
      );

      animationToggle.querySelector('.button__label').textContent = `${ctx.t('settings.animation')}：${ctx.t(
        state.animationEnabled ? 'common.on' : 'common.off'
      )}`;
      animationToggle.setAttribute('aria-pressed', String(state.animationEnabled));
      animationToggle.setAttribute(
        'aria-label',
        ctx.t('a11y.animationToggle', { state: state.animationEnabled ? ctx.t('common.on') : ctx.t('common.off') })
      );

      helpButton.querySelector('.button__label').textContent = ctx.t('common.help');
      parentButton.update(state);
      footer.textContent = ctx.t('home.footer');
    }
  };
}
