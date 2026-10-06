/**
 * 需要长按 2 秒才能打开的按钮（家长设置入口）。
 * 防止儿童误触，同时提供键盘等价操作：按住 Enter / 空格 2 秒同样可以打开。
 */
import { el } from './dom.js';
import { icon } from './icons.js';

export function createHoldButton(ctx, { labelKey, hintKey, onUnlock, holdMs = 2000 } = {}) {
  const ring = el('span', { class: 'hold-button__ring', attrs: { 'aria-hidden': 'true' } });
  const hintNode = el('span', { class: 'hold-button__hint' });
  const button = el('button', {
    class: 'hold-button',
    type: 'button',
    style: { '--hold-progress': '0' },
    attrs: { 'aria-describedby': 'hold-hint' }
  }, [icon('lock'), el('span', { class: 'hold-button__label' }), ring, hintNode]);
  hintNode.id = 'hold-hint';

  let timer = null;
  let raf = null;
  let startedAt = 0;

  function paint() {
    const progress = Math.min(1, (performance.now() - startedAt) / holdMs);
    button.style.setProperty('--hold-progress', String(progress));
    button.classList.toggle('is-holding', progress > 0.02);
    if (progress < 1) raf = requestAnimationFrame(paint);
  }

  function cleanup() {
    if (timer) window.clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    timer = null;
    raf = null;
    button.style.setProperty('--hold-progress', '0');
    button.classList.remove('is-holding');
  }

  function start() {
    if (timer) return;
    startedAt = performance.now();
    paint();
    timer = window.setTimeout(() => {
      cleanup();
      if (typeof onUnlock === 'function') onUnlock();
    }, holdMs);
  }

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    start();
  });
  button.addEventListener('pointerup', cleanup);
  button.addEventListener('pointerleave', cleanup);
  button.addEventListener('pointercancel', cleanup);
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (!event.repeat) start();
    }
  });
  button.addEventListener('keyup', cleanup);
  button.addEventListener('blur', cleanup);
  button.addEventListener('click', (event) => event.preventDefault());

  return {
    root: button,
    update(state) {
      button.setAttribute('aria-label', ctx.t('a11y.pressAndHold'));
      button.querySelector('.hold-button__label').textContent = ctx.t(labelKey);
      hintNode.textContent = hintKey ? ctx.t(hintKey) : '';
    }
  };
}
