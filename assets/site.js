/* GatoNube · 个人主页 共享脚本 */
(function () {
  'use strict';

  /* ================= 1. 主题切换 ================= */
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
  var theme = (saved === 'dark' || saved === 'light')
    ? saved
    : (systemPrefersDark() ? 'dark' : 'light');
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

  /* ================= 2. 滚动定位导航高亮 ================= */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  var hashLinks = links.filter(function (a) {
    var h = a.getAttribute('href') || '';
    return h.charAt(0) === '#' && h.length > 1;
  });

  function activate(el) {
    links.forEach(function (a) {
      a.classList.remove('active');
      a.removeAttribute('aria-current');
    });
    if (el) {
      el.classList.add('active');
      el.setAttribute('aria-current', 'true');
    }
  }

  if (hashLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    var targets = [];
    hashLinks.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if (el) { byId[id] = a; targets.push(el); }
    });

    var visible = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { visible[en.target.id] = en.intersectionRatio; }
        else { delete visible[en.target.id]; }
      });
      var bestId = null, bestRatio = -1;
      Object.keys(visible).forEach(function (id) {
        if (visible[id] > bestRatio) { bestRatio = visible[id]; bestId = id; }
      });
      if (bestId) {
        activate(byId[bestId]);
      } else if (window.scrollY < 120) {
        activate(null);
      }
    }, {
      rootMargin: '-80px 0px -55% 0px',
      threshold: [0, 0.15, 0.35, 0.6, 1]
    });

    targets.forEach(function (t) { spy.observe(t); });

    /* 点击时立刻高亮 */
    hashLinks.forEach(function (a) {
      a.addEventListener('click', function () { activate(a); });
    });
  }

  /* ================= 3. 年份 ================= */
  var y = document.getElementById('year');
  if (y) { y.textContent = String(new Date().getFullYear()); }
})();
