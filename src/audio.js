/**
 * 音效：用 Web Audio 现场合成，不加载任何音频文件 —— 离线也能响。
 * 所有音效都可以在设置里一键关闭；声音永远不是唯一的反馈方式（PRD 10.4）。
 */
let context = null;
let enabled = true;

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

export function isSoundEnabled() {
  return enabled;
}

/** 浏览器要求音频必须由用户操作触发，第一次点击时调用一次即可解锁。 */
export function unlockAudio() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    try {
      context = new Ctor();
    } catch (error) {
      context = null;
    }
  }
  if (context && context.state === 'suspended') {
    context.resume().catch(() => {});
  }
  return context;
}

function tone({ freq, start = 0, duration = 0.14, type = 'sine', gain = 0.16, sweepTo = null }) {
  if (!context) return;
  const now = context.currentTime + start;
  const oscillator = context.createOscillator();
  const amplifier = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, now);
  if (sweepTo) oscillator.frequency.linearRampToValueAtTime(sweepTo, now + duration);
  amplifier.gain.setValueAtTime(0.0001, now);
  amplifier.gain.exponentialRampToValueAtTime(gain, now + 0.02);
  amplifier.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(amplifier).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

const SOUNDS = {
  // 轻轻一点
  click: () => tone({ freq: 660, duration: 0.07, type: 'triangle', gain: 0.1 }),
  // 商品放进购物篮
  pop: () => {
    tone({ freq: 420, duration: 0.1, type: 'sine', gain: 0.14, sweepTo: 720 });
  },
  // 收银机
  cash: () => {
    tone({ freq: 880, duration: 0.09, type: 'square', gain: 0.1 });
    tone({ freq: 1320, start: 0.09, duration: 0.16, type: 'square', gain: 0.09 });
  },
  // 顾客进店
  welcome: () => {
    tone({ freq: 523, duration: 0.12, type: 'sine', gain: 0.12 });
    tone({ freq: 659, start: 0.12, duration: 0.12, type: 'sine', gain: 0.12 });
  },
  // 答对
  correct: () => {
    tone({ freq: 659, duration: 0.12, type: 'sine', gain: 0.15 });
    tone({ freq: 784, start: 0.11, duration: 0.12, type: 'sine', gain: 0.15 });
    tone({ freq: 1047, start: 0.22, duration: 0.22, type: 'sine', gain: 0.14 });
  },
  // 需要再试一次：柔和的低音，不做刺耳的蜂鸣
  gentle: () => {
    tone({ freq: 392, duration: 0.18, type: 'sine', gain: 0.11, sweepTo: 330 });
  },
  // 得到星星
  star: () => {
    tone({ freq: 988, duration: 0.1, type: 'triangle', gain: 0.12 });
    tone({ freq: 1319, start: 0.1, duration: 0.18, type: 'triangle', gain: 0.11 });
  },
  // 解锁装饰
  unlock: () => {
    tone({ freq: 587, duration: 0.14, type: 'triangle', gain: 0.12 });
    tone({ freq: 784, start: 0.13, duration: 0.14, type: 'triangle', gain: 0.12 });
    tone({ freq: 1175, start: 0.26, duration: 0.24, type: 'triangle', gain: 0.11 });
  }
};

/**
 * 播放一个音效。
 * 关闭音效、浏览器不支持、还没被用户手势解锁时都安静地什么都不做。
 */
export function playSound(name) {
  if (!enabled) return;
  if (!context) return;
  const player = SOUNDS[name];
  if (!player) return;
  try {
    player();
  } catch (error) {
    /* 音效失败不能影响游戏 */
  }
}

export const SOUND_NAMES = Object.keys(SOUNDS);
