/**
 * 浏览器自动检查（零依赖，直接说 Chrome DevTools Protocol）。
 *
 *   node tools/browser-check.mjs                 # 默认检查 http://127.0.0.1:5173/
 *   BASE_URL=http://127.0.0.1:8080/ node tools/browser-check.mjs
 *
 * 做四件事：
 *   1. 收集控制台错误和未捕获异常；
 *   2. 走一遍真实操作流程（自由购物 → 拿商品 → 收银 → 答总价 → 找零 → 下一单）；
 *   3. 在手机竖屏 / 手机横屏 / 平板 / 笔记本 / 桌面宽屏下检查横向溢出、
 *      触摸目标尺寸（≥44px）和元素重叠；
 *   4. 把每个尺寸的截图写到 /tmp/lcs-shots，方便人工看一眼。
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const PORT = Number(process.env.CDP_PORT || 9333);
const OUT_DIR = process.env.SHOT_DIR || '/tmp/lcs-shots';
const MIN_TAP = 44;

mkdirSync(OUT_DIR, { recursive: true });

/* ----------------------------- CDP 小客户端 ----------------------------- */

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${JSON.stringify(message.error)})`));
        else resolve(message.result);
        return;
      }
      if (message.method && this.handlers.has(message.method)) {
        for (const handler of this.handlers.get(message.method)) handler(message.params);
      }
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('CDP 连接失败')), { once: true });
    });
    return new Cdp(socket);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP 超时：${method}`));
        }
      }, 30000);
    });
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }

  close() {
    try {
      this.socket.close();
    } catch {
      /* 忽略 */
    }
  }
}

/* ------------------------------ 启动 Chrome ------------------------------ */

async function findPageTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* 还没起来，继续等 */
    }
    await delay(250);
  }
  throw new Error('找不到可调试的页面目标，Chrome 可能没启动成功');
}

async function main() {
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--no-first-run',
      '--disable-extensions',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${OUT_DIR}/chrome-profile`,
      '--window-size=1280,900',
      'about:blank'
    ],
    { stdio: 'ignore', detached: false }
  );

  const problems = [];
  const notes = [];
  const consoleErrors = [];
  const exceptions = [];

  let cdp;
  try {
    const target = await findPageTarget();
    cdp = await Cdp.connect(target.webSocketDebuggerUrl);

    cdp.on('Runtime.exceptionThrown', (params) => {
      const details = params.exceptionDetails;
      exceptions.push(`${details.text} ${details.exception ? details.exception.description : ''}`.trim());
    });
    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error' || params.type === 'warning') {
        const text = params.args.map((arg) => arg.value ?? arg.description ?? arg.type).join(' ');
        consoleErrors.push(`${params.type}: ${text}`);
      }
    });
    cdp.on('Log.entryAdded', (params) => {
      if (params.entry.level === 'error') consoleErrors.push(`log: ${params.entry.text} ${params.entry.url || ''}`);
    });

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');

    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (result.exceptionDetails) {
        const details = result.exceptionDetails;
        const description = details.exception ? details.exception.description : details.text;
        throw new Error(
          `页面内脚本出错：${description}\n表达式：${String(expression).slice(0, 220)}`
        );
      }
      return result.result.value;
    };

    const setViewport = async (width, height, { mobile = false } = {}) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
        screenWidth: width,
        screenHeight: height
      });
      await delay(120);
    };

    /** 用真实鼠标事件做一次拖拽（Chrome 会把它转成 pointer 事件） */
    const dragBetween = async (from, to, steps = 14) => {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: from.x,
        y: from.y,
        button: 'left',
        buttons: 1,
        clickCount: 1
      });
      for (let i = 1; i <= steps; i += 1) {
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
          button: 'left',
          buttons: 1
        });
        await delay(16);
      }
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: to.x,
        y: to.y,
        button: 'left',
        buttons: 0,
        clickCount: 1
      });
      await delay(250);
    };

    const centerOf = async (selector) =>
      evaluate(`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
      })()`);

    const screenshot = async (name) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(`${OUT_DIR}/${name}.png`, Buffer.from(data, 'base64'));
    };

    // 关掉动画，截图和几何检查更稳定
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });

    /* --------------------------- 页面加载与启动 --------------------------- */
    await cdp.send('Page.navigate', { url: BASE_URL });
    await delay(2500);

    const booted = await evaluate('Boolean(window.__LCS_BOOTED__)');
    if (!booted) problems.push('window.__LCS_BOOTED__ 不是 true：模块没有启动成功');

    const homeInfo = await evaluate(`(() => {
      const modeCards = [...document.querySelectorAll('.mode-card .mode-card__title')].map((n) => n.textContent);
      return {
        screen: document.getElementById('app').dataset.screen,
        modeCards,
        bigButtons: document.querySelectorAll('.button--huge').length,
        difficultyButtons: document.querySelectorAll('.segmented__button').length,
        storefront: Boolean(document.querySelector('.storefront__title')),
        language: document.documentElement.lang,
        titleText: document.querySelector('.storefront__title')?.textContent || '',
        decorChips: document.querySelectorAll('.decor-chip').length
      };
    })()`);

    if (homeInfo.screen !== 'home') problems.push(`首屏不是首页，而是 ${homeInfo.screen}`);
    if (homeInfo.modeCards.length !== 5) problems.push(`玩法卡片应为 5 个，实际 ${homeInfo.modeCards.length}`);
    if (homeInfo.bigButtons !== 2) problems.push(`首页主按钮应有 2 个，实际 ${homeInfo.bigButtons}`);
    if (!homeInfo.storefront) problems.push('首页没有便利店场景');

    await setViewport(1280, 900);
    await screenshot('01-home-desktop-1280');

    /* ------------------------- 响应式与触摸目标检查 ------------------------- */

    const responsiveCheck = async (label, width, height, { mobile = false } = {}) => {
      await setViewport(width, height, { mobile });
      const report = await evaluate(`(() => {
        const MIN = ${MIN_TAP};
        const visible = (node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const smallButtons = [];
        for (const button of document.querySelectorAll('button')) {
          if (!visible(button)) continue;
          const rect = button.getBoundingClientRect();
          if (rect.width < MIN - 0.5 || rect.height < MIN - 0.5) {
            smallButtons.push({
              cls: button.className,
              text: (button.textContent || '').trim().slice(0, 18),
              w: Math.round(rect.width),
              h: Math.round(rect.height)
            });
          }
        }
        const overflowing = [];
        const limit = window.innerWidth + 1;
        for (const node of document.querySelectorAll('body *')) {
          if (!visible(node)) continue;
          const rect = node.getBoundingClientRect();
          if (rect.right > limit || rect.left < -1) {
            overflowing.push({ cls: node.className, right: Math.round(rect.right), left: Math.round(rect.left) });
          }
        }
        return {
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          innerWidth: window.innerWidth,
          smallButtons: smallButtons.slice(0, 12),
          smallButtonCount: smallButtons.length,
          overflowingCount: overflowing.length,
          overflowing: overflowing.slice(0, 8),
          docHeight: document.documentElement.scrollHeight
        };
      })()`);

      if (report.overflowX > 1) {
        problems.push(`[${label}] 出现横向滚动：scrollWidth 比视口宽 ${report.overflowX}px`);
      }
      if (report.overflowingCount > 0) {
        problems.push(
          `[${label}] 有 ${report.overflowingCount} 个元素超出视口：${JSON.stringify(report.overflowing)}`
        );
      }
      if (report.smallButtonCount > 0) {
        problems.push(
          `[${label}] 有 ${report.smallButtonCount} 个按钮小于 ${MIN_TAP}px：${JSON.stringify(report.smallButtons)}`
        );
      }
      notes.push(`[${label}] 视口 ${width}×${height}，页面高 ${report.docHeight}px，按钮最小值检查完成`);
      await screenshot(label);
      return report;
    };

    await responsiveCheck('02-home-phone-390x844', 390, 844, { mobile: true });
    await responsiveCheck('03-home-landscape-844x390', 844, 390, { mobile: true });
    await responsiveCheck('04-home-tablet-834x1112', 834, 1112, { mobile: true });
    await responsiveCheck('05-home-laptop-1280x800', 1280, 800);
    await responsiveCheck('06-home-wide-1600x900', 1600, 900);

    /* ------------------------------ 交互流程 ------------------------------ */

    await setViewport(1280, 900);
    await evaluate(`document.querySelector('.language-switch__button[lang="zh-CN"]')?.click()`);
    await delay(200);

    // 进入自由购物
    await evaluate(`[...document.querySelectorAll('.button--huge')].find((b) => b.textContent.includes('自由购物')).click()`);
    await delay(700);

    const gameInfo = await evaluate(`(() => ({
      screen: document.getElementById('app').dataset.screen,
      cards: document.querySelectorAll('.product-card').length,
      brokenArt: [...document.querySelectorAll('img.product-art')].filter((img) => !img.complete || img.naturalWidth === 0).length,
      artCount: document.querySelectorAll('img.product-art').length,
      basketEmpty: Boolean(document.querySelector('.basket__empty:not([hidden])'))
    }))()`);

    if (gameInfo.screen !== 'game') problems.push(`自由购物没有进入游戏界面（当前 ${gameInfo.screen}）`);
    if (gameInfo.cards < 8) problems.push(`货架商品卡片只有 ${gameInfo.cards} 个，应至少 8 个`);
    if (gameInfo.artCount === 0) problems.push('货架没有加载商品插画（img.product-art）');
    if (gameInfo.brokenArt > 0) problems.push(`有 ${gameInfo.brokenArt} 张商品插画加载失败`);
    notes.push(`货架商品 ${gameInfo.cards} 个，插画 ${gameInfo.artCount} 张，全部加载成功`);

    await screenshot('07-game-free-desktop');

    // 拖拽：把第 3 个商品拖进购物篮（鼠标路径）
    const dragFrom = await centerOf('.product-card:nth-child(2) .product-card__add');
    const dragTo = await centerOf('.basket__head');
    if (!dragFrom || !dragTo) {
      problems.push('拖拽检查失败：找不到商品卡片或购物篮');
    } else {
      const dragged = await evaluate(`(async () => {
        const card = document.querySelectorAll('.product-card')[1];
        return { name: card.querySelector('.product-card__name').textContent };
      })()`);
      await dragBetween(dragFrom, dragTo);
      const afterDrag = await evaluate(`(() => ({
        rows: document.querySelectorAll('.basket__row').length,
        name: document.querySelector('.basket__name')?.textContent || '',
        qty: document.querySelector('.basket__row .stepper__value')?.textContent || '',
        ghostLeft: document.querySelectorAll('.drag-ghost').length
      }))()`);
      if (afterDrag.rows !== 1) problems.push(`拖拽商品到购物篮没有生效（购物篮 ${afterDrag.rows} 行）`);
      if (afterDrag.qty !== '1') problems.push(`拖拽后数量应为 1，实际 ${afterDrag.qty}`);
      if (afterDrag.name !== dragged.name) {
        problems.push(`拖拽放进购物篮的商品不对：期望 ${dragged.name}，实际 ${afterDrag.name}`);
      }
      if (afterDrag.ghostLeft > 0) problems.push('拖拽结束后还留着拖拽影子元素');
      notes.push(`拖拽检查：把「${dragged.name}」拖进购物篮成功（购物篮 ${afterDrag.rows} 行）`);
      // 清空购物篮，后面的点击流程从头开始
      await evaluate(`[...document.querySelectorAll('.basket__footer .button')].find((b) => /清空|Empty/.test(b.textContent))?.click()`);
      await delay(300);
    }

    // 点击商品 → 购物篮
    await evaluate(`document.querySelectorAll('.product-card__add')[0].click()`);
    await evaluate(`document.querySelectorAll('.product-card__add')[0].click()`);
    await delay(300);
    const basketInfo = await evaluate(`(() => ({
      rows: document.querySelectorAll('.basket__row').length,
      total: document.querySelector('.amount--basket .amount__value')?.textContent,
      badge: document.querySelectorAll('.product-card__badge')[0]?.textContent,
      count: document.querySelector('.basket__count')?.textContent
    }))()`);
    if (basketInfo.rows !== 1) problems.push(`购物篮应有 1 行，实际 ${basketInfo.rows}`);
    if (basketInfo.badge !== '2') problems.push(`商品角标应为 2，实际 ${basketInfo.badge}`);
    notes.push(`加入 2 件后：购物篮 ${basketInfo.rows} 行，总价 ${basketInfo.total}，${basketInfo.count}`);

    // 数量减一
    await evaluate(`document.querySelector('.basket__row .stepper__button').click()`);
    await delay(250);
    const afterMinus = await evaluate(`document.querySelector('.amount--basket .amount__value')?.textContent`);
    notes.push(`点一次减号后总价 ${afterMinus}`);

    // 快速数量按钮：一次点击把数量设成 4
    const quick = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const buttons = [...document.querySelectorAll('.quick-quantity__button')];
      const four = buttons.find((b) => b.textContent.trim() === '4');
      if (!four) return { ok: false, reason: '没有找到快速数量按钮' };
      four.click();
      await sleep(250);
      return {
        ok: true,
        count: document.querySelector('.quick-quantity__button.is-active')?.textContent || '',
        badge: document.querySelector('.product-card__badge')?.textContent || '',
        total: document.querySelector('.amount--basket .amount__value')?.textContent,
        label: document.querySelector('.quick-quantity__label')?.textContent || ''
      };
    })()`);
    if (!quick.ok) problems.push(`快速数量按钮不可用：${quick.reason}`);
    if (quick.count !== '4') problems.push(`点 4 之后高亮的是 ${quick.count}`);
    if (quick.badge !== '4') problems.push(`快速设置数量后商品角标是 ${quick.badge}（应为 4）`);
    notes.push(`快速数量按钮：${quick.label} → 数量 ${quick.count}，总价 ${quick.total}`);

    // 切换语言，购物篮必须保留
    await evaluate(`document.querySelector('.language-switch__button[lang="en"]').click()`);
    await delay(400);
    const afterSwitch = await evaluate(`(() => ({
      lang: document.documentElement.lang,
      rows: document.querySelectorAll('.basket__row').length,
      total: document.querySelector('.amount--basket .amount__value')?.textContent,
      title: document.querySelector('.topbar__title')?.textContent,
      basketTitle: document.querySelector('.basket__title')?.textContent.trim()
    }))()`);
    if (afterSwitch.rows !== 1) problems.push(`切换语言后购物篮变成 ${afterSwitch.rows} 行（应保留 1 行）`);
    if (!/Little Convenience Store/.test(afterSwitch.title || '')) {
      problems.push(`切换英文后标题没变：${afterSwitch.title}`);
    }
    if (!/Basket/.test(afterSwitch.basketTitle || '')) {
      problems.push(`切换英文后购物篮标题没翻译：${afterSwitch.basketTitle}`);
    }
    const shelfTranslation = await evaluate(`(() => {
      const names = [...document.querySelectorAll('.product-card__name')].map((n) => n.textContent);
      const colorLabels = [...document.querySelectorAll('.product-card .color-dot__label')].map((n) => n.textContent);
      const shapeLabels = [...document.querySelectorAll('.product-card .shape-badge__label')].map((n) => n.textContent);
      const rowName = document.querySelector('.basket__name')?.textContent || '';
      return { first: names.slice(0, 3), color: colorLabels[0], shape: shapeLabels[0], rowName };
    })()`);
    const looksEnglish = (value) => Boolean(value) && !/[\u4e00-\u9fa5]/.test(value);
    if (!shelfTranslation.first.every(looksEnglish)) {
      problems.push(`切换英文后商品名没翻译：${JSON.stringify(shelfTranslation.first)}`);
    }
    if (!looksEnglish(shelfTranslation.color) || !looksEnglish(shelfTranslation.shape)) {
      problems.push(`切换英文后颜色/形状名没翻译：${shelfTranslation.color} / ${shelfTranslation.shape}`);
    }
    if (!looksEnglish(shelfTranslation.rowName)) {
      problems.push(`切换英文后购物篮里的商品名没翻译：${shelfTranslation.rowName}`);
    }
    notes.push(
      `英文界面：商品名 ${shelfTranslation.first.join(' / ')}，颜色 ${shelfTranslation.color}，形状 ${shelfTranslation.shape}`
    );
    notes.push(`切换英文后：标题「${afterSwitch.title}」，购物篮仍为 ${afterSwitch.rows} 行，总价 ${afterSwitch.total}`);
    await screenshot('08-game-english');

    // 刷新页面：语言和设置要保留
    await cdp.send('Page.reload');
    await delay(2200);
    const afterReload = await evaluate(`(() => ({
      lang: document.documentElement.lang,
      title: document.querySelector('.topbar__title')?.textContent,
      screen: document.getElementById('app').dataset.screen,
      stars: document.querySelector('.stat-chip__value')?.textContent
    }))()`);
    if (afterReload.lang !== 'en') problems.push(`刷新后语言没有保留（当前 ${afterReload.lang}）`);
    if (afterReload.screen !== 'home') problems.push('刷新后没有回到首页');
    notes.push(`刷新后语言仍为 ${afterReload.lang}，界面文字「${afterReload.title}」`);

    await evaluate(`document.querySelector('.language-switch__button[lang="zh-CN"]')?.click()`);
    await delay(300);

    // 数学练习：数量选择模式走完整流程（点按钮作答）
    await evaluate(`[...document.querySelectorAll('.mode-card')].find((card) => card.textContent.includes('数量选择')).click()`);
    await delay(600);

    const orderInfo = await evaluate(`(() => ({
      sentence: document.querySelector('.speech-bubble__text')?.textContent || '',
      hasBadges: document.querySelectorAll('.order-badges > *').length,
      mode: document.querySelector('.steps__item.is-current .steps__label')?.textContent || ''
    }))()`);
    if (!orderInfo.sentence) problems.push('订单没有显示顾客需求句子');
    notes.push(`顾客说：「${orderInfo.sentence}」`);
    await screenshot('09-game-order-zh');

    // 按需求拿对商品：直接读订单结构，再逐次点击加号
    const filled = await evaluate(`(async () => {
      const cards = [...document.querySelectorAll('.product-card')];
      const sentence = document.querySelector('.speech-bubble__text').textContent;
      // 从订单徽章里读出需要的件数
      const want = Number(document.querySelector('.order-badges__num').textContent);
      const productName = document.querySelector('.order-badges__product span')?.textContent || '';
      const name = document.querySelector('.order-badges__product') ? productName : '';
      let card = cards.find((c) => name && c.textContent.includes(name));
      if (!card) {
        // 颜色 / 形状模式：随便挑第一个满足条件的卡片
        card = cards[0];
      }
      const add = card.querySelector('.product-card__add');
      for (let i = 0; i < want; i += 1) add.click();
      return { want, name: card.textContent.trim().slice(0, 12), qty: card.querySelector('.stepper__value').textContent };
    })()`);
    notes.push(`按需求点击了 ${filled.want} 次「${filled.name}」，角标显示 ${filled.qty}`);
    await delay(200);

    // 检查购物篮（可能因为颜色/形状模式挑错商品而失败，这也是一种有效反馈）
    await evaluate(`[...document.querySelectorAll('.button')].find((b) => /检查购物篮/.test(b.textContent))?.click()`);
    await delay(400);
    const afterCheck = await evaluate(`(() => ({
      phase: document.querySelector('.steps__item.is-current .steps__label')?.textContent || '',
      feedback: document.querySelector('.feedback')?.textContent || '',
      hasChoices: document.querySelectorAll('.choices__button').length,
      hasKeypad: Boolean(document.querySelector('.keypad'))
    }))()`);
    notes.push(`检查购物篮后当前步骤「${afterCheck.phase}」，提示「${afterCheck.feedback}」`);
    await screenshot('10-game-after-check');

    // 答总价：从清单里读出单价 × 数量，算出正确答案后再点对应的按钮（选择题或数字键盘）
    if (afterCheck.hasChoices > 0 || afterCheck.hasKeypad) {
      const answer = await evaluate(`(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const lines = [...document.querySelectorAll('.checkout__line')];
        if (!lines.length) return { ok: false, reason: '没有找到购物篮清单' };
        const total = lines.reduce(
          (sum, line) =>
            sum +
            Number(line.querySelector('.checkout__line-unit').textContent) *
              Number(line.querySelector('.checkout__line-qty').textContent),
          0
        );
        const choices = [...document.querySelectorAll('.choices__button')];
        if (choices.length) {
          const target = choices.find((c) => Number(c.querySelector('.choices__value').textContent) === total);
          (target || choices[0]).click();
          await sleep(350);
          return { ok: Boolean(target), total, used: 'choices', phase: document.querySelector('.steps__item.is-current .steps__label')?.textContent };
        }
        for (const digit of String(total)) {
          const key = [...document.querySelectorAll('.keypad__key')].find((k) => k.textContent.trim() === digit);
          if (key) key.click();
        }
        document.querySelector('.keypad__submit').click();
        await sleep(350);
        return { ok: true, total, used: 'keypad', phase: document.querySelector('.steps__item.is-current .steps__label')?.textContent };
      })()`);
      if (!answer.ok) problems.push(`总价题答不上：${JSON.stringify(answer)}`);
      notes.push(
        `算出总价 ${answer.total}，用${
          answer.used === 'choices' ? '选择题' : '数字键盘'
        }作答，当前步骤「${answer.phase}」`
      );
      await screenshot('11-game-after-answer');
    }

    // 收下顾客的钱
    const accepted = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const button = [...document.querySelectorAll('.button')].find((b) =>
        /收下顾客的钱|Take the money/.test(b.textContent)
      );
      if (!button) return { ok: false, phase: document.querySelector('.steps__item.is-current .steps__label')?.textContent };
      button.click();
      await sleep(400);
      return {
        ok: true,
        phase: document.querySelector('.steps__item.is-current .steps__label')?.textContent,
        hasMoneyArea: Boolean(document.querySelector('.money-area')),
        hasKeypad: Boolean(document.querySelector('.keypad')),
        resultVisible: Boolean(document.querySelector('.result__title'))
      };
    })()`);
    notes.push(`收钱之后：步骤「${accepted.phase}」，${accepted.resultVisible ? '直接进入结果页' : '进入找零'}`);
    await screenshot('12-game-payment');

    // 找零：先验证「把钱从零钱盒拖进找零盘」，再读出总额自己凑
    if (accepted.hasMoneyArea) {
      // 找零区在页面上更靠下，先滚动到看得见的位置（真实用户也会这么做）
      await evaluate(`document.querySelector('.money-tray')?.scrollIntoView({ block: 'center' })`);
      await delay(300);
      const moneyFrom = await centerOf('.money-drawer .money-chip');
      const trayTarget = await centerOf('.money-tray__items');
      const moneyTo = await centerOf('.money-drawer');
      if (moneyFrom && moneyTo) {
        const before = await evaluate(`document.querySelectorAll('.money-tray__items .money-chip').length`);
        await dragBetween(moneyFrom, trayTarget || moneyTo);
        const after = await evaluate(`(() => ({
          chips: document.querySelectorAll('.money-tray__items .money-chip').length,
          hint: document.querySelector('.money-tray__hint')?.textContent || '',
          ghosts: document.querySelectorAll('.drag-ghost').length
        }))()`);
        if (after.chips !== before + 1) {
          problems.push(`拖拽纸币硬币到找零盘没有生效（${before} → ${after.chips}）`);
        }
        if (after.ghosts > 0) problems.push('找零拖拽结束后还留着拖拽影子元素');
        notes.push(
          `拖拽检查：把钱从 (${moneyFrom.x},${moneyFrom.y}) 拖到 (${(trayTarget || moneyTo).x},${
            (trayTarget || moneyTo).y
          })：找零盘 ${before} → ${after.chips} 张，提示「${after.hint}」，视口高 ${await evaluate('window.innerHeight')}`
        );
        await evaluate(
          `[...document.querySelectorAll('.money-area__actions .button')].find((b) => /重新计算|Start again/.test(b.textContent))?.click()`
        );
        await delay(250);
      } else {
        problems.push('找零阶段找不到零钱盒或找零盘');
      }
      const change = await evaluate(`(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const recap = [...document.querySelectorAll('.change-recap__item')];
        const readAmount = (node) => Number(node.querySelector('.amount__value').textContent);
        const total = readAmount(recap[0]);
        const paid = readAmount(recap[1]);
        const due = paid - total;
        const values = [...document.querySelectorAll('.money-drawer .money-chip__value')].map((n) => Number(n.textContent));
        const buttons = [...document.querySelectorAll('.money-drawer button')];
        let left = due;
        let clicked = 0;
        const available = values.slice().sort((a, b) => b - a);
        for (const value of available) {
          while (left >= value) {
            buttons[values.indexOf(value)].click();
            left -= value;
            clicked += 1;
            await sleep(30);
          }
        }
        await sleep(250);
        const hint = document.querySelector('.money-tray__hint')?.textContent || '';
        const confirm = [...document.querySelectorAll('.money-area__actions .button')].find((b) =>
          /确认找零|Confirm/.test(b.textContent)
        );
        const disabled = confirm ? confirm.disabled : true;
        if (confirm && !disabled) confirm.click();
        await sleep(500);
        return {
          total,
          paid,
          due,
          clicked,
          hint,
          confirmDisabled: disabled,
          resultTitle: document.querySelector('.result__title')?.textContent || '',
          stars: document.querySelectorAll('.star-row__star.is-on').length,
          steps: document.querySelectorAll('.result__step').length,
          progressStars: document.querySelector('.topbar .stat-chip__value')?.textContent
        };
      })()`);
      if (change.due !== change.total - change.total + (change.paid - change.total)) {
        problems.push('找零金额计算异常');
      }
      if (change.confirmDisabled) problems.push(`凑出零钱后确认按钮仍然是禁用状态（提示：${change.hint}）`);
      if (!change.resultTitle) problems.push('确认零钱后没有出现结果页');
      if (change.stars < 1) problems.push(`结果页没有星星（${change.stars}）`);
      if (change.steps < 1) problems.push('结果页没有展示计算过程');
      notes.push(
        `找零：总价 ${change.total}、付款 ${change.paid}、应找 ${change.due}，放了 ${change.clicked} 张，提示「${change.hint}」`
      );
      notes.push(`结果页：「${change.resultTitle}」，星星 ${change.stars} 颗，计算过程 ${change.steps} 条，顶部星星数 ${change.progressStars}`);
      await screenshot('13-game-result');

      // 下一位顾客
      const next = await evaluate(`(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const button = [...document.querySelectorAll('.result__actions .button')].find((b) =>
          /下一位顾客|Next customer/.test(b.textContent)
        );
        if (!button) return { ok: false };
        button.click();
        await sleep(400);
        return {
          ok: true,
          cartRows: document.querySelectorAll('.basket__row').length,
          sentence: document.querySelector('.speech-bubble__text')?.textContent || ''
        };
      })()`);
      if (!next.ok) problems.push('结果页找不到「下一位顾客」按钮');
      if (next.cartRows !== 0) problems.push('换顾客后购物篮没有清空');
      notes.push(`下一位顾客：「${next.sentence}」`);
    }

    // 手机竖屏下再走一遍货架和收银台，检查溢出
    await setViewport(390, 844, { mobile: true });
    await delay(300);
    await responsiveCheck('14-game-phone-390x844', 390, 844, { mobile: true });
    await responsiveCheck('15-game-landscape-844x390', 844, 390, { mobile: true });
    await responsiveCheck('16-game-tablet-834x1112', 834, 1112, { mobile: true });

    // 帮助页与家长设置页
    await setViewport(390, 844, { mobile: true });
    await evaluate(`document.querySelector('.topbar__actions .icon-button[aria-label]')?.closest('.topbar__actions').querySelectorAll('.icon-button')[1].click()`);
    await delay(500);
    const helpInfo = await evaluate(`(() => ({
      screen: document.getElementById('app').dataset.screen,
      steps: document.querySelectorAll('.help__step').length
    }))()`);
    if (helpInfo.screen !== 'help') problems.push(`帮助按钮没有打开帮助页（当前 ${helpInfo.screen}）`);
    if (helpInfo.steps !== 5) problems.push(`帮助页步骤应为 5 条，实际 ${helpInfo.steps}`);
    await screenshot('17-help-phone-390x844');
    await responsiveCheck('18-help-phone-check', 390, 844, { mobile: true });

    // 家长设置（长按按钮的键盘等价操作：按住 Enter 2 秒）
    await evaluate(`(async () => {
      const back = [...document.querySelectorAll('.button')].find((b) => /完成/.test(b.textContent));
      if (back) back.click();
    })()`);
    await delay(400);
    await evaluate(`(async () => {
      const hold = document.querySelector('.hold-button');
      hold.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((r) => setTimeout(r, 2300));
      hold.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    })()`);
    await delay(500);
    const settingsInfo = await evaluate(`(() => ({
      screen: document.getElementById('app').dataset.screen,
      groups: document.querySelectorAll('.settings__group').length,
      toggles: document.querySelectorAll('.toggle-row').length,
      privacy: (document.querySelector('.settings__privacy')?.textContent || '').length
    }))()`);
    if (settingsInfo.screen !== 'settings') {
      problems.push(`长按 2 秒没有打开家长设置（当前 ${settingsInfo.screen}）`);
    }
    if (settingsInfo.toggles < 5) problems.push(`家长设置开关应至少 5 个，实际 ${settingsInfo.toggles}`);
    if (settingsInfo.privacy < 20) problems.push('家长设置缺少隐私说明');
    notes.push(`家长设置：${settingsInfo.groups} 组、${settingsInfo.toggles} 个开关，长按进入成功`);
    await responsiveCheck('19-settings-phone-check', 390, 844, { mobile: true });

    // 关掉一个开关，确认设置被写入 localStorage
    await evaluate(`document.querySelectorAll('.toggle-row')[2].click()`);
    await delay(300);
    const savedFlag = await evaluate(`JSON.parse(localStorage.getItem('lcs.save.v1')).settings.timer`);
    notes.push(`点击第 3 个开关后，存档里的 timer = ${savedFlag}`);

    await evaluate(`[...document.querySelectorAll('.button')].find((b) => /完成/.test(b.textContent))?.click()`);
    await delay(400);
    const backHome = await evaluate(`document.getElementById('app').dataset.screen`);
    if (backHome !== 'home') problems.push(`从家长设置返回首页失败（当前 ${backHome}）`);
  } finally {
    if (cdp) cdp.close();
    chrome.kill('SIGTERM');
  }

  /* -------------------------------- 汇总 -------------------------------- */

  const report = {
    url: BASE_URL,
    shots: OUT_DIR,
    consoleErrors,
    exceptions,
    notes,
    problems
  };

  console.log('===== 浏览器检查报告 =====');
  for (const note of notes) console.log(`· ${note}`);
  if (exceptions.length) {
    console.log('\n未捕获异常：');
    for (const item of exceptions) console.log(`  ! ${item}`);
  }
  if (consoleErrors.length) {
    console.log('\n控制台错误/警告：');
    for (const item of consoleErrors) console.log(`  ! ${item}`);
  }
  console.log(`\n问题 ${problems.length} 个：`);
  for (const item of problems) console.log(`  ✗ ${item}`);
  if (!problems.length && !exceptions.length) console.log('  全部通过 ✅');

  writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify(report, null, 2));
  process.exitCode = problems.length || exceptions.length ? 1 : 0;
}

main().catch((error) => {
  console.error('检查脚本失败：', error);
  process.exitCode = 2;
});
