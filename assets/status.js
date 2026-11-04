/* Je0on · 当前网络状况
   全部检测在浏览器本地发起,反映的是「访问者当前网络」的连通性。 */
(function () {
  'use strict';

  var grid = document.getElementById('probeGrid');
  if (!grid) { return; }

  /* ================= 待检测的服务 ================= */
  var SERVICES = [
    { name: 'Google Gemini API', url: 'https://generativelanguage.googleapis.com/', tag: 'Gemini' },
    { name: 'Google AI Studio',  url: 'https://aistudio.google.com/',                tag: 'Gemini' },
    { name: 'OpenAI API',        url: 'https://api.openai.com/',                     tag: 'OpenAI' },
    { name: 'Groq API',          url: 'https://api.groq.com/',                       tag: 'Groq' },
    { name: 'OpenRouter',        url: 'https://openrouter.ai/',                      tag: '聚合网关' },
    { name: 'Cloudflare',        url: 'https://www.cloudflare.com/cdn-cgi/trace',    tag: 'CDN' },
    { name: 'Vercel',            url: 'https://vercel.com/',                         tag: '部署' },
    { name: 'GitHub',            url: 'https://github.com/',                         tag: '代码托管' },
    { name: 'Vercel Demo',       url: 'https://my-openai-gemini-demo.vercel.app/',   tag: '我的项目' }
  ];

  var TIMEOUT = 7000;   /* 单次探测超时(毫秒) */

  /* ================= 工具函数 ================= */
  function probe(url) {
    return new Promise(function (resolve) {
      var ctrl = ('AbortController' in window) ? new AbortController() : null;
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) { return; }
        settled = true;
        if (ctrl) { try { ctrl.abort(); } catch (e) {} }
        resolve({ ok: false, ms: null, reason: '超时' });
      }, TIMEOUT);

      var opts = { mode: 'no-cors', cache: 'no-store', redirect: 'follow', credentials: 'omit' };
      if (ctrl) { opts.signal = ctrl.signal; }

      fetch(url, opts).then(function () {
        if (settled) { return; }
        settled = true; clearTimeout(timer);
        var now = (window.performance && performance.now) ? performance.now() : Date.now();
        resolve({ ok: true, ms: Math.round(now - t0) });
      }).catch(function () {
        if (settled) { return; }
        settled = true; clearTimeout(timer);
        resolve({ ok: false, ms: null, reason: '不可达' });
      });
    });
  }

  /* ================= 渲染:服务可达性 ================= */
  function renderSkeleton() {
    grid.innerHTML = SERVICES.map(function (s, i) {
      return '<article class="card probe" id="probe-' + i + '">' +
               '<h3>' + s.name + '</h3>' +
               '<p class="probe-host">' + s.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '') + '</p>' +
               '<div class="card-foot">' +
                 '<div class="tags">' +
                   '<span class="tag">' + s.tag + '</span>' +
                   '<span class="tag badge pending" id="badge-' + i + '">检测中…</span>' +
                 '</div>' +
               '</div>' +
             '</article>';
    }).join('');
  }

  function setBadge(i, res) {
    var el = document.getElementById('badge-' + i);
    var card = document.getElementById('probe-' + i);
    if (!el) { return; }
    el.classList.remove('pending', 'ok', 'fail');
    if (res.ok) {
      el.classList.add('ok');
      el.textContent = '可达 · ' + res.ms + ' ms';
    } else {
      el.classList.add('fail');
      el.textContent = res.reason || '不可达';
    }
    if (card) {
      card.classList.remove('is-ok', 'is-fail');
      card.classList.add(res.ok ? 'is-ok' : 'is-fail');
    }
  }

  /* ================= 访问者网络信息 ================= */
  var GEO_APIS = [
    {
      url: 'https://ipwho.is/',
      map: function (d) {
        var cn = d.connection || {};
        return {
          ip: d.ip,
          loc: [d.country, d.region, d.city].filter(Boolean).join(' · '),
          isp: cn.isp || cn.org || '',
          asn: cn.asn ? ('AS' + cn.asn) : ''
        };
      }
    },
    {
      url: 'https://ipapi.co/json/',
      map: function (d) {
        return {
          ip: d.ip,
          loc: [d.country_name, d.region, d.city].filter(Boolean).join(' · '),
          isp: d.org || '',
          asn: d.asn || ''
        };
      }
    },
    {
      url: 'https://ipinfo.io/json',
      map: function (d) {
        return {
          ip: d.ip,
          loc: [d.country, d.region, d.city].filter(Boolean).join(' · '),
          isp: d.org || '',
          asn: ''
        };
      }
    }
  ];

  function setText(id, v) {
    var el = document.getElementById(id);
    if (el) { el.textContent = (v && String(v).trim()) ? v : '—'; }
  }

  function loadGeo() {
    var idx = 0;
    function tryNext() {
      if (idx >= GEO_APIS.length) {
        setText('netIp', '获取失败');
        setText('netLoc', '—'); setText('netIsp', '—');
        return;
      }
      var api = GEO_APIS[idx++];
      var ctrl = ('AbortController' in window) ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) { try { ctrl.abort(); } catch (e) {} } }, TIMEOUT);
      var opts = { cache: 'no-store', credentials: 'omit', headers: { 'Accept': 'application/json' } };
      if (ctrl) { opts.signal = ctrl.signal; }

      fetch(api.url, opts).then(function (r) { return r.json(); }).then(function (d) {
        clearTimeout(timer);
        if (!d || d.success === false || d.error) { throw new Error('bad payload'); }
        var info = api.map(d);
        if (!info.ip) { throw new Error('no ip'); }
        setText('netIp', info.ip);
        setText('netLoc', info.loc);
        setText('netIsp', [info.isp, info.asn].filter(Boolean).join(' '));
      }).catch(function () {
        clearTimeout(timer);
        tryNext();
      });
    }
    tryNext();
  }

  function loadTz() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      var off = -new Date().getTimezoneOffset() / 60;
      var sign = off >= 0 ? '+' : '-';
      var abs = Math.abs(off);
      var hh = Math.floor(abs);
      var mm = Math.round((abs - hh) * 60);
      var label = 'UTC' + sign + hh + (mm ? ':' + (mm < 10 ? '0' + mm : mm) : '');
      setText('netTz', (tz ? tz + ' ' : '') + '(' + label + ')');
    } catch (e) { setText('netTz', '—'); }
  }

  /* ================= 总状态 ================= */
  function setSummary(text, state) {
    var msg = document.getElementById('statusMsg');
    var dot = document.getElementById('statusDot');
    if (msg) { msg.textContent = text; }
    if (dot) {
      dot.classList.remove('ok', 'fail', 'busy');
      dot.classList.add(state || 'busy');
    }
  }

  /* ================= 主流程 ================= */
  function run() {
    var btn = document.getElementById('statusRefresh');
    if (btn) { btn.disabled = true; }

    renderSkeleton();
    setSummary('正在检测 ' + SERVICES.length + ' 个服务的可达性…', 'busy');

    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();

    loadGeo();
    loadTz();

    var done = 0, okCount = 0;
    SERVICES.forEach(function (s, i) {
      probe(s.url).then(function (res) {
        setBadge(i, res);
        done++;
        if (res.ok) { okCount++; }
        if (done === SERVICES.length) {
          var now = (window.performance && performance.now) ? performance.now() : Date.now();
          var total = ((now - t0) / 1000).toFixed(1);
          var allOk = okCount === SERVICES.length;
          var noneOk = okCount === 0;
          setSummary(
            okCount + ' / ' + SERVICES.length + ' 个服务可达 · 总耗时 ' + total + ' 秒' +
            (noneOk ? ' · 当前网络似乎无法直连这些服务' :
             (!allOk ? ' · 部分服务不可达,可能需要代理' : ' · 全部可达')),
            allOk ? 'ok' : (noneOk ? 'fail' : 'busy')
          );
          if (btn) { btn.disabled = false; }
        }
      });
    });
  }

  var btn = document.getElementById('statusRefresh');
  if (btn) { btn.addEventListener('click', run); }

  /* 页面加载后自动检测一次 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
