/*
 * 独立的小脚本（classic script，非模块）。
 * 作用：如果直接双击 index.html 用 file:// 打开，浏览器会因为 CORS 拒绝加载 ES 模块，
 * 页面就会停留在“正在打开便利店…”。这里检测启动结果并给出可操作的提示。
 */
(function () {
  'use strict';

  var MESSAGES = {
    zh: {
      title: '需要本地服务器才能启动',
      body: '这个游戏把脚本、样式和图片分开载入，浏览器用 file:// 打开时会拒绝加载它们。请在项目文件夹里运行下面任意一条命令，然后打开提示的网址：',
      hint: '运行后访问 http://127.0.0.1:5173/'
    },
    en: {
      title: 'A local server is required',
      body: 'This game loads its scripts, styles and images as separate files, and browsers block that over file://. Run either command below inside the project folder, then open the printed URL:',
      hint: 'Then open http://127.0.0.1:5173/'
    }
  };

  function language() {
    try {
      var saved = window.localStorage.getItem('lcs.save.v1');
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed && parsed.language === 'en') return 'en';
      }
    } catch (error) {
      /* localStorage 不可用时退回中文 */
    }
    return 'zh';
  }

  function showNotice() {
    if (window.__LCS_BOOTED__) return;
    var app = document.getElementById('app');
    if (!app) return;
    var text = MESSAGES[language()];

    app.innerHTML = '';
    var panel = document.createElement('div');
    panel.className = 'boot-error';

    var emoji = document.createElement('span');
    emoji.className = 'boot-error__emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = '🔌';

    var title = document.createElement('h1');
    title.textContent = text.title;

    var body = document.createElement('p');
    body.textContent = text.body;

    var pre = document.createElement('pre');
    pre.className = 'boot-error__code';
    pre.textContent = 'node server.mjs\n# 或者 / or\npython3 -m http.server 5173';

    var hint = document.createElement('p');
    hint.className = 'boot-error__hint';
    hint.textContent = text.hint;

    panel.append(emoji, title, body, pre, hint);
    app.appendChild(panel);
  }

  window.addEventListener('load', function () {
    window.setTimeout(showNotice, 1200);
  });
})();
