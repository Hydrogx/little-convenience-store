/**
 * 顶部信息条：星星、金币、完成订单数、难度、语言、音效、帮助、家长设置。
 * 它在整个游戏过程中保持不变，只更新数字，避免切换界面时整条重建。
 */
import { el, clear } from './dom.js';
import { icon } from './icons.js';
import { languageSwitch, statChip } from './components.js';
import { difficultyLabel } from '../data/levels.js';

export function createTopBar(ctx) {
  const root = el('header', { class: 'topbar' });

  const homeButton = el('button', {
    class: 'topbar__home',
    type: 'button',
    on: { click: () => ctx.actions.goHome() }
  }, [el('span', { class: 'topbar__logo', text: '🏪', attrs: { 'aria-hidden': 'true' } })]);

  const title = el('h1', { class: 'topbar__title' });

  const stats = el('div', { class: 'topbar__stats' });
  const starChip = statChip('star', 0, '', '');
  const coinChip = statChip('coin', 0, '', '');
  const orderChip = statChip('basket', 0, '', '');
  stats.append(starChip, coinChip, orderChip);

  const difficultyChip = el('span', { class: 'topbar__difficulty' });

  const langHolder = el('div', { class: 'topbar__lang' });

  const soundButton = el('button', {
    class: 'icon-button',
    type: 'button',
    on: { click: () => ctx.actions.toggleSound() }
  }, [icon('sound')]);

  const helpButton = el('button', {
    class: 'icon-button',
    type: 'button',
    on: { click: () => ctx.actions.openHelp() }
  }, [icon('help')]);

  const settingsButton = el('button', {
    class: 'icon-button',
    type: 'button',
    on: { click: () => ctx.actions.openSettings() }
  }, [icon('gear')]);

  root.append(
    homeButton,
    title,
    stats,
    difficultyChip,
    el('div', { class: 'topbar__actions' }, [langHolder, soundButton, helpButton, settingsButton])
  );

  let lastLanguage = null;

  return {
    root,
    update(state) {
      title.textContent = ctx.t('app.title');
      title.setAttribute('lang', state.language === 'en' ? 'en' : 'zh-CN');
      homeButton.setAttribute('aria-label', ctx.t('result.home'));
      homeButton.hidden = state.screen === 'home';

      starChip.querySelector('.stat-chip__value').textContent = String(state.progress.stars);
      starChip.querySelector('.stat-chip__label').textContent = ctx.t('home.stars');
      starChip.setAttribute('aria-label', ctx.t('a11y.stars', { n: state.progress.stars }));

      coinChip.querySelector('.stat-chip__value').textContent = String(state.progress.coins);
      coinChip.querySelector('.stat-chip__label').textContent = ctx.t('home.coins');
      coinChip.setAttribute('aria-label', ctx.t('a11y.coins', { n: state.progress.coins }));

      orderChip.querySelector('.stat-chip__value').textContent = String(state.progress.ordersCompleted);
      orderChip.querySelector('.stat-chip__label').textContent = ctx.t('home.orders');
      orderChip.setAttribute('aria-label', `${ctx.t('home.orders')} ${state.progress.ordersCompleted}`);

      difficultyChip.textContent = difficultyLabel(state.difficulty, state.language);

      if (lastLanguage !== state.language) {
        lastLanguage = state.language;
        clear(langHolder);
        langHolder.appendChild(languageSwitch(ctx, state));
      }

      soundButton.replaceChildren(icon(state.soundEnabled ? 'sound' : 'mute'));
      soundButton.setAttribute('aria-label', ctx.t('a11y.soundToggle', { state: state.soundEnabled ? ctx.t('common.on') : ctx.t('common.off') }));
      soundButton.setAttribute('aria-pressed', String(state.soundEnabled));

      helpButton.setAttribute('aria-label', ctx.t('help.title'));
      settingsButton.setAttribute('aria-label', ctx.t('settings.title'));
    }
  };
}
