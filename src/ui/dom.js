/**
 * DOM 小工具。
 * 全部界面都用这几个函数拼出来，避免散落的 innerHTML 字符串拼接，
 * 也保证文本节点一律走 textContent（不会把用户/数据内容当成 HTML 解析）。
 */

function appendChildren(node, children) {
  if (children === null || children === undefined || children === false) return;
  if (Array.isArray(children)) {
    for (const child of children) appendChildren(node, child);
    return;
  }
  if (children instanceof Node) {
    node.appendChild(children);
    return;
  }
  node.appendChild(document.createTextNode(String(children)));
}

/**
 * 创建元素。
 *   el('button', { class: 'btn', text: '开始', on: { click: fn } }, [el('span', ...)])
 * 支持：class/className、text、html（仅限内部可信标记）、style、dataset、on、attrs，其余走 setAttribute。
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class' || key === 'className') {
      node.className = String(value);
    } else if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'html') {
      node.innerHTML = String(value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else if (key === 'on' && typeof value === 'object') {
      for (const [type, handler] of Object.entries(value)) {
        if (typeof handler === 'function') node.addEventListener(type, handler);
      }
    } else if (key === 'attrs' && typeof value === 'object') {
      for (const [attr, attrValue] of Object.entries(value)) {
        if (attrValue === false || attrValue === null || attrValue === undefined) continue;
        node.setAttribute(attr, attrValue === true ? '' : String(attrValue));
      }
    } else {
      node.setAttribute(key, String(value));
    }
  }
  appendChildren(node, children);
  return node;
}

/** 文档片段，把多个节点一次挂上，减少重排。 */
export function frag(children = []) {
  const fragment = document.createDocumentFragment();
  appendChildren(fragment, children);
  return fragment;
}

/** 把 SVG 字符串变成真正的 SVG 元素（图标用）。 */
export function svgEl(markup) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = markup.trim();
  const node = wrapper.firstElementChild;
  if (node && !node.getAttribute('aria-hidden')) node.setAttribute('aria-hidden', 'true');
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function replace(node, ...children) {
  clear(node);
  appendChildren(node, children);
  return node;
}

/** 只在内容变化时写 textContent，避免无意义的重排和动画重置。 */
export function setText(node, value) {
  const next = value === null || value === undefined ? '' : String(value);
  if (node.textContent !== next) node.textContent = next;
  return node;
}

export function toggleClass(node, name, enabled) {
  node.classList.toggle(name, Boolean(enabled));
  return node;
}

/** 屏幕阅读器播报。 */
export function announce(message) {
  if (typeof document === 'undefined') return;
  const region = document.getElementById('live-region');
  if (!region || !message) return;
  region.textContent = '';
  window.setTimeout(() => {
    region.textContent = message;
  }, 30);
}

/** 可点击元素：鼠标、触摸、键盘都能用（Enter / Space）。 */
export function pressable(node, handler) {
  node.addEventListener('click', (event) => {
    event.preventDefault();
    handler(event);
  });
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      handler(event);
    }
  });
  return node;
}
