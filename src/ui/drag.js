/**
 * 拖拽（鼠标 / 触摸都能用）。
 *
 * 用途：
 *   1. 把货架上的商品拖进购物篮；
 *   2. 把零钱盒里的纸币硬币拖进找零盘。
 * 点击（tap）永远是可用的等价操作 —— 拖拽只是「多一种更自然的做法」，
 * 所以任何拖拽失败都不能影响点击（PRD 9.1 / 9.2 / 4.6）。
 *
 * 交互约定：
 *   - 鼠标/触控笔：按下后移动超过 6px 才开始拖；
 *   - 触摸：按住约 220ms 才开始拖（这样手指上下滑动仍然是滚动页面）；
 *   - 真正拖动过之后会吃掉这一次 click，避免商品被放两次。
 */
import { playSound } from '../audio.js';

const MOUSE_THRESHOLD = 6;
const TOUCH_HOLD_MS = 220;
const TOUCH_THRESHOLD = 10;

const zones = [];
let active = null;

/** 注册一个放置区；返回取消注册的函数。 */
export function registerDropZone({ element, accepts, onDrop, highlight = true }) {
  const zone = { element, accepts, onDrop, highlight };
  zones.push(zone);
  return () => {
    const index = zones.indexOf(zone);
    if (index !== -1) zones.splice(index, 1);
  };
}

function pruneZones() {
  for (let i = zones.length - 1; i >= 0; i -= 1) {
    if (!zones[i].element.isConnected) zones.splice(i, 1);
  }
}

function zoneAt(x, y, data) {
  const node = document.elementFromPoint(x, y);
  if (!node) return null;
  return (
    zones.find((zone) => zone.element.contains(node) && zone.accepts(data)) || null
  );
}

function setHighlight(zone, on) {
  if (!zone || !zone.highlight) return;
  zone.element.classList.toggle('is-drop-target', Boolean(on));
}

/**
 * 让一个元素可以拖拽。
 * @param {HTMLElement} element
 * @param {() => object|null} getData 返回要传递的数据；返回 null 表示这次不允许拖
 */
export function makeDraggable(element, getData, { ghostFrom = null, label = '' } = {}) {
  let press = null;
  let dragging = false;
  let ghost = null;
  let hoverZone = null;
  let holdTimer = null;

  element.classList.add('is-draggable');

  function createGhost(x, y) {
    const source = ghostFrom ? ghostFrom() : element;
    const node = source.cloneNode(true);
    node.classList.add('drag-ghost');
    node.removeAttribute('id');
    for (const child of node.querySelectorAll('[id]')) child.removeAttribute('id');
    if (label) node.setAttribute('aria-label', label);
    node.setAttribute('aria-hidden', 'true');
    document.body.appendChild(node);
    moveGhost(x, y);
    return node;
  }

  function moveGhost(x, y) {
    if (!ghost) return;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
  }

  function startDrag(event, data) {
    dragging = true;
    ghost = createGhost(event.clientX, event.clientY);
    document.body.classList.add('is-dragging');
    active = { data };
    if (element.setPointerCapture && event.pointerId !== undefined) {
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        /* 某些浏览器不支持，忽略即可 */
      }
    }
  }

  function cleanup() {
    if (holdTimer) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
    setHighlight(hoverZone, false);
    hoverZone = null;
    if (ghost) ghost.remove();
    ghost = null;
    document.body.classList.remove('is-dragging');
    active = null;
    press = null;
    dragging = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', cleanup);
  }

  function onMove(event) {
    if (!press) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    const distance = Math.hypot(dx, dy);

    if (!dragging) {
      if (press.touch) {
        // 触摸：按住不动才会变成拖拽；先滑动就是滚动页面，直接放弃这次按压
        if (distance > TOUCH_THRESHOLD) {
          cleanup();
          return;
        }
      } else if (distance > MOUSE_THRESHOLD) {
        startDrag(event, press.data);
      }
    }

    if (dragging) {
      event.preventDefault();
      moveGhost(event.clientX, event.clientY);
      const zone = zoneAt(event.clientX, event.clientY, press.data);
      if (zone !== hoverZone) {
        setHighlight(hoverZone, false);
        setHighlight(zone, true);
        hoverZone = zone;
      }
    }
  }

  function onUp(event) {
    if (!press) return;
    const wasDragging = dragging;
    const data = press.data;
    const zone = wasDragging ? zoneAt(event.clientX, event.clientY, data) : null;
    cleanup();

    if (wasDragging) {
      // 吃掉这次 click，避免同一个动作执行两次
      const swallow = (clickEvent) => {
        clickEvent.stopPropagation();
        clickEvent.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400);

      if (zone) {
        playSound('pop');
        zone.onDrop(data);
      }
    }
  }

  function onDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.isPrimary === false) return;
    const data = getData();
    if (!data) return;

    const touch = event.pointerType === 'touch' || event.pointerType === 'pen';
    press = { x: event.clientX, y: event.clientY, data, touch };

    if (touch) {
      holdTimer = window.setTimeout(() => {
        holdTimer = null;
        if (press) startDrag(event, press.data);
      }, TOUCH_HOLD_MS);
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cleanup);
  }

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('dragstart', (event) => event.preventDefault());

  return () => {
    cleanup();
    element.removeEventListener('pointerdown', onDown);
    element.classList.remove('is-draggable');
  };
}
