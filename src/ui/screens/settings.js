/**
 * 家长设置界面（需要从首页长按 2 秒才能进入）。
 * 只调整难度和显示方式，不收集任何个人信息，也不需要登录（PRD 12 / 13）。
 */
import { el, clear } from '../dom.js';
import { icon } from '../icons.js';
import { languageSwitch, openDialog } from '../components.js';
import { DIFFICULTY_IDS, MAX_NUMBER_OPTIONS, getDifficulty } from '../../data/levels.js';

function toggleRow(ctx, { labelKey, getValue, onToggle }) {
  const button = el('button', {
    class: 'toggle-row',
    type: 'button',
    on: { click: () => onToggle(!getValue()) }
  }, [
    el('span', { class: 'toggle-row__label' }),
    el('span', { class: 'toggle-row__switch', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { class: 'toggle-row__knob' })
    ])
  ]);
  return {
    root: button,
    update(state) {
      const value = getValue();
      button.querySelector('.toggle-row__label').textContent = ctx.t(labelKey);
      button.classList.toggle('is-on', value);
      button.setAttribute('role', 'switch');
      button.setAttribute('aria-checked', String(value));
      button.setAttribute('aria-label', `${ctx.t(labelKey)}: ${ctx.t(value ? 'common.on' : 'common.off')}`);
    }
  };
}

export function createSettingsScreen(ctx) {
  const root = el('main', { class: 'settings', id: 'main-region' });

  const title = el('h2', { class: 'settings__title' });
  const subtitle = el('p', { class: 'settings__subtitle' });

  /* 难度 */
  const difficultyRow = el('div', { class: 'segmented', role: 'radiogroup', attrs: { 'aria-label': ctx.t('a11y.difficultySelect') } });
  const difficultyButtons = new Map();
  for (const id of DIFFICULTY_IDS) {
    const button = el('button', {
      class: 'segmented__button',
      type: 'button',
      role: 'radio',
      on: { click: () => ctx.actions.setDifficulty(id) }
    }, [el('span', { class: 'segmented__label' }), el('span', { class: 'segmented__blurb' })]);
    difficultyButtons.set(id, button);
    difficultyRow.appendChild(button);
  }

  /* 数字范围 */
  const maxRow = el('div', { class: 'segmented segmented--compact', role: 'radiogroup' });
  const maxButtons = new Map();
  for (const value of MAX_NUMBER_OPTIONS) {
    const button = el('button', {
      class: 'segmented__button',
      type: 'button',
      role: 'radio',
      text: `${value}`,
      on: { click: () => ctx.actions.updateSettings({ maxNumber: value }) }
    });
    maxButtons.set(value, button);
    maxRow.appendChild(button);
  }

  /* 开关 */
  const toggles = [
    toggleRow(ctx, {
      labelKey: 'settings.allowChange',
      getValue: () => ctx.getState().settings.allowChange,
      onToggle: (value) => ctx.actions.updateSettings({ allowChange: value })
    }),
    toggleRow(ctx, {
      labelKey: 'settings.multiplication',
      getValue: () => ctx.getState().settings.multiplication,
      onToggle: (value) => ctx.actions.updateSettings({ multiplication: value })
    }),
    toggleRow(ctx, {
      labelKey: 'settings.timer',
      getValue: () => ctx.getState().settings.timer,
      onToggle: (value) => ctx.actions.updateSettings({ timer: value })
    }),
    toggleRow(ctx, {
      labelKey: 'settings.hints',
      getValue: () => ctx.getState().settings.hints,
      onToggle: (value) => ctx.actions.updateSettings({ hints: value })
    }),
    toggleRow(ctx, {
      labelKey: 'settings.sound',
      getValue: () => ctx.getState().soundEnabled,
      onToggle: () => ctx.actions.toggleSound()
    }),
    toggleRow(ctx, {
      labelKey: 'settings.animation',
      getValue: () => ctx.getState().animationEnabled,
      onToggle: () => ctx.actions.toggleAnimation()
    })
  ];

  /* 语言 */
  const langHolder = el('div', { class: 'settings__row' });

  /* 隐私与重置 */
  const privacy = el('p', { class: 'settings__privacy' });
  const resetButton = el('button', {
    class: 'button button--danger',
    type: 'button',
    on: {
      click: () => {
        let dialog = null;
        dialog = openDialog({
          title: ctx.t('settings.resetProgress'),
          body: el('p', { text: ctx.t('settings.resetConfirm') }),
          actions: [
            el('button', {
              class: 'button button--ghost',
              type: 'button',
              text: ctx.t('common.cancel'),
              on: { click: () => dialog && dialog.close() }
            }),
            el('button', {
              class: 'button button--danger',
              type: 'button',
              text: ctx.t('common.confirm'),
              on: {
                click: () => {
                  ctx.actions.resetProgress();
                  if (dialog) dialog.close();
                }
              }
            })
          ]
        });
      }
    }
  }, [icon('trash'), el('span', { class: 'button__label' })]);

  const closeButton = el('button', {
    class: 'button button--primary button--big',
    type: 'button',
    on: { click: () => ctx.actions.goHome() }
  }, [icon('check'), el('span', { class: 'button__label' })]);

  root.append(
    title,
    subtitle,
    el('section', { class: 'settings__group' }, [el('h3', { class: 'settings__group-title' }), difficultyRow]),
    el('section', { class: 'settings__group' }, [el('h3', { class: 'settings__group-title' }), maxRow]),
    el('section', { class: 'settings__group' }, [el('h3', { class: 'settings__group-title' }), ...toggles.map((t) => t.root)]),
    el('section', { class: 'settings__group' }, [el('h3', { class: 'settings__group-title' }), langHolder]),
    privacy,
    el('div', { class: 'settings__actions' }, [resetButton, closeButton])
  );

  const groupTitles = root.querySelectorAll('.settings__group-title');
  let lastLanguage = null;

  return {
    root,
    update(state) {
      title.textContent = ctx.t('settings.title');
      subtitle.textContent = ctx.t('settings.forGrownUps');
      groupTitles[0].textContent = ctx.t('settings.difficulty');
      groupTitles[1].textContent = ctx.t('settings.maxNumber');
      groupTitles[2].textContent = ctx.t('settings.rules');
      groupTitles[3].textContent = ctx.t('settings.language');

      for (const [id, button] of difficultyButtons) {
        const level = getDifficulty(id);
        button.querySelector('.segmented__label').textContent = level.label[state.language];
        button.querySelector('.segmented__blurb').textContent = level.blurb[state.language];
        const active = state.difficulty === id;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-checked', String(active));
      }

      for (const [value, button] of maxButtons) {
        const active = state.settings.maxNumber === value;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-checked', String(active));
      }

      for (const toggle of toggles) toggle.update(state);

      if (lastLanguage !== state.language) {
        lastLanguage = state.language;
        clear(langHolder);
        langHolder.appendChild(languageSwitch(ctx, state));
      }

      privacy.textContent = ctx.t('settings.privacy');
      resetButton.querySelector('.button__label').textContent = ctx.t('settings.resetProgress');
      closeButton.querySelector('.button__label').textContent = ctx.t('common.done');
      closeButton.setAttribute('aria-label', ctx.t('settings.close'));
    }
  };
}
