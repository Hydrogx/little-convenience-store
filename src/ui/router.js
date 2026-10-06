/**
 * 极简路由器：根据 state.screen 切换主界面。
 * 同一个界面内部只做增量更新 —— 这样点击商品时的动画、输入框里的数字都不会被重置。
 */
import { el } from './dom.js';
import { createTopBar } from './topbar.js';
import { createHomeScreen } from './screens/home.js';
import { createGameScreen } from './screens/game.js';
import { createSettingsScreen } from './screens/settings.js';
import { createHelpScreen } from './screens/help.js';
import { deriveGame } from '../game.js';

const SCREEN_FACTORIES = {
  home: createHomeScreen,
  game: createGameScreen,
  settings: createSettingsScreen,
  help: createHelpScreen
};

export function createApp(ctx) {
  const mount = document.getElementById('app');
  const topbar = createTopBar(ctx);
  const holder = el('div', { class: 'screen-holder' });
  const shell = el('div', { class: 'shell' }, [topbar.root, holder]);
  mount.replaceChildren(shell);
  mount.dataset.screen = 'home';

  let current = null;

  return {
    render(state) {
      const name = SCREEN_FACTORIES[state.screen] ? state.screen : 'home';
      if (!current || current.name !== name) {
        if (current && typeof current.instance.destroy === 'function') current.instance.destroy();
        const factory = SCREEN_FACTORIES[name];
        current = { name, instance: factory(ctx) };
        holder.replaceChildren(current.instance.root);
        mount.dataset.screen = name;
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      topbar.update(state);
      current.instance.update(state, deriveGame(state));
    },
    get currentScreen() {
      return current ? current.name : null;
    }
  };
}
