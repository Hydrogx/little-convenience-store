/**
 * 内联 SVG 图标（全部原创几何图形，不使用任何品牌素材）。
 * 图标本身对屏幕阅读器隐藏，可访问名称由按钮上的文字或 aria-label 提供。
 */
import { svgEl } from './dom.js';

const ICONS = {
  star:
    '<svg viewBox="0 0 24 24" class="icon icon--star" focusable="false"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9z" fill="currentColor"/></svg>',
  coin:
    '<svg viewBox="0 0 24 24" class="icon icon--coin" focusable="false"><circle cx="12" cy="12" r="9.4" fill="currentColor"/><circle cx="12" cy="12" r="6.4" fill="rgba(255,255,255,.55)"/><path d="M12 7.6v8.8M9.6 10.2h4.8M9.6 13.8h4.8" stroke="rgba(120,80,0,.75)" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>',
  sound:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4z" fill="currentColor"/><path d="M15.6 8.6a5 5 0 010 6.8M18.2 6a8.6 8.6 0 010 12" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>',
  mute:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4z" fill="currentColor"/><path d="M16 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>',
  gear:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M12 8.4a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2z" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 2.8v2.6M12 18.6v2.6M4.5 4.5l1.9 1.9M17.6 17.6l1.9 1.9M2.8 12h2.6M18.6 12h2.6M4.5 19.5l1.9-1.9M17.6 6.4l1.9-1.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  help:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M9.4 9.2a2.7 2.7 0 015.3.7c0 1.8-2.7 2.2-2.7 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="17.1" r="1.15" fill="currentColor"/></svg>',
  plus:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M12 5.5v13M5.5 12h13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  minus:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M5.5 12h13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M5.6 7.4h12.8M9.6 7.4V5.2h4.8v2.2M7.4 7.4l.9 11.2h7.4l.9-11.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  basket:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M3.4 8.6h17.2l-1.8 10.2a1.6 1.6 0 01-1.6 1.3H6.8a1.6 1.6 0 01-1.6-1.3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.4 8.6L11 3.6M15.6 8.6L13 3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  back:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M14.6 5.4L8 12l6.6 6.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M5 12.8l4.6 4.4L19 6.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M19.4 12a7.4 7.4 0 11-2.2-5.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19.8 4.4v4.4h-4.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><rect x="5.2" y="10.4" width="13.6" height="9.4" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M8.6 10.4V8.2a3.4 3.4 0 016.8 0v2.2" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>',
  speaker:
    '<svg viewBox="0 0 24 24" class="icon" focusable="false"><path d="M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4z" fill="currentColor"/></svg>'
};

/** 返回图标的 DOM 元素（每次调用都是新节点，可以安全地插入多处）。 */
export function icon(name) {
  const markup = ICONS[name] || ICONS.help;
  return svgEl(markup);
}

export const ICON_NAMES = Object.keys(ICONS);
