/**
 * 店铺装饰奖励。
 * 完成订单累积到 unlockAt 指定的数量时解锁，只影响外观，不影响玩法，也不涉及真实支付。
 */
export const DECORATIONS = [
  { id: 'flag', unlockAt: 1, emoji: '🚩', name: { zh: '门口小旗子', en: 'Door flag' } },
  { id: 'basketGreen', unlockAt: 3, emoji: '🧺', name: { zh: '绿色购物篮', en: 'Green basket' } },
  { id: 'sign', unlockAt: 5, emoji: '🪧', name: { zh: '新招牌', en: 'New sign' } },
  { id: 'plant', unlockAt: 8, emoji: '🪴', name: { zh: '门口小盆栽', en: 'Little plant' } },
  { id: 'stickerWall', unlockAt: 12, emoji: '🌈', name: { zh: '彩虹贴纸墙', en: 'Rainbow sticker wall' } },
  { id: 'cat', unlockAt: 16, emoji: '🐈', name: { zh: '店里的猫', en: 'Shop cat' } },
  { id: 'balloon', unlockAt: 20, emoji: '🎈', name: { zh: '庆祝气球', en: 'Party balloon' } },
  { id: 'crown', unlockAt: 30, emoji: '👑', name: { zh: '金牌店长', en: 'Star manager badge' } }
];

export function unlockedDecorations(ordersCompleted) {
  return DECORATIONS.filter((item) => ordersCompleted >= item.unlockAt).map((item) => item.id);
}

export function decorationById(id) {
  return DECORATIONS.find((item) => item.id === id) || null;
}

/** 距离下一个装饰还差多少单；全部解锁时返回 null。 */
export function nextDecoration(ordersCompleted) {
  return DECORATIONS.find((item) => ordersCompleted < item.unlockAt) || null;
}
