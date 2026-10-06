/**
 * 帮助界面：怎么玩、五种玩法说明、键盘操作、以及「答错也没关系」的友好说明。
 */
import { el } from '../dom.js';
import { icon } from '../icons.js';
import { MATH_MODES } from '../../data/modes.js';

export function createHelpScreen(ctx) {
  const root = el('main', { class: 'help', id: 'main-region' });
  const title = el('h2', { class: 'help__title' });
  const stepsTitle = el('h3', { class: 'help__subtitle' });
  const list = el('ol', { class: 'help__steps' });
  const noteTitle = el('h3', { class: 'help__subtitle' });
  const note = el('p', { class: 'help__note' });
  const keyboard = el('p', { class: 'help__note' });
  const modesTitle = el('h3', { class: 'help__subtitle' });
  const modes = el('ul', { class: 'help__modes' });
  const closeButton = el('button', {
    class: 'button button--primary button--big',
    type: 'button',
    on: { click: () => ctx.actions.goHome() }
  }, [icon('check'), el('span', { class: 'button__label' })]);

  root.append(
    title,
    stepsTitle,
    list,
    noteTitle,
    note,
    keyboard,
    modesTitle,
    modes,
    el('div', { class: 'help__actions' }, [closeButton])
  );

  return {
    root,
    update(state) {
      title.textContent = ctx.t('help.title');
      stepsTitle.textContent = ctx.t('app.tagline');
      noteTitle.textContent = ctx.t('result.encourage');

      list.replaceChildren();
      for (let index = 1; index <= 5; index += 1) {
        list.appendChild(
          el('li', { class: 'help__step' }, [
            el('span', { class: 'help__step-number', text: String(index) }),
            el('span', { class: 'help__step-text', text: ctx.t(`help.step${index}`) })
          ])
        );
      }

      note.textContent = ctx.t('help.note');
      keyboard.textContent = ctx.t('help.keyboard');

      modesTitle.textContent = ctx.t('help.modes');
      modes.replaceChildren();
      for (const mode of MATH_MODES) {
        modes.appendChild(
          el('li', { class: 'help__mode' }, [
            el('span', { class: 'help__mode-emoji', text: mode.emoji, attrs: { 'aria-hidden': 'true' } }),
            el('span', { class: 'help__mode-title', text: ctx.t(mode.label) }),
            el('span', { class: 'help__mode-desc', text: ctx.t(mode.desc) })
          ])
        );
      }

      closeButton.querySelector('.button__label').textContent = ctx.t('common.done');
    }
  };
}
