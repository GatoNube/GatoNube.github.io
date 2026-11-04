/* Je0on · 个人主页 共享脚本 */
(function () {
  'use strict';

  /* ---------- 1. 主题切换 ---------- */
  var root = document.documentElement;
  var btn = document.getElementById('themeBtn');

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    if (btn) {
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', t === 'dark' ? '切换到浅色' : '切换到深色');
    }
  }

  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) { saved = null; }
  var theme = (saved === 'dark' || saved === 'light') ? saved : (systemPrefersDark() ? 'dark' : 'light');
  applyTheme(theme);

  if (btn) {
    btn.addEventListener('click', function () {
      theme = (theme === 'dark') ? 'light' : 'dark';
      applyTheme(theme);
      try { localStorage.setItem('theme', theme); } catch (e) {}
    });
  }

  /* 用户没手动选过时,跟随系统变化 */
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function (e) {
      var s = null;
      try { s = localStorage.getItem('theme'); } catch (err) { s = null; }
      if (s !== 'dark' && s !== 'light') {
        theme = e.matches ? 'dark' : 'light';
        applyTheme(theme);
      }
    };
    if (mq.addEventListener) { mq.addEventListener('change', onChange); }
    else if (mq.addListener) { mq.addListener(onChange); }
  }

  /* ---------- 2. 导航高亮 ---------- */
  var path = window.location.pathname.replace(/\/+$/, '');
  var last = path.substring(path.lastIndexOf('/') + 1);
  if (last === '') { last = 'index.html'; }
  var links = document.querySelectorAll('.nav-links a');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href') || '';
    var target = href.replace(/^\.\//, '').replace(/^\/+/, '');
    if (target === last) {
      links[i].classList.add('active');
      links[i].setAttribute('aria-current', 'page');
    }
  }

  /* ---------- 3. 年份 ---------- */
  var y = document.getElementById('year');
  if (y) { y.textContent = String(new Date().getFullYear()); }
})();
