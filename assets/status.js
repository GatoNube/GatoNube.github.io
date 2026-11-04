/* 当前网络状况 —— 只读取出口 IP 信息。
   可达性/风控探测已迁移到 ip.html(assets/ip.js)。 */
(function () {
  'use strict';

  var TIMEOUT = 9000;

  var GEO_APIS = [
    {
      url: 'https://ipwho.is/',
      map: function (d) {
        var c = d.connection || {};
        return {
          ip: d.ip,
          loc: [d.country, d.region, d.city].filter(Boolean).join(' · '),
          isp: [c.isp || c.org || '', c.asn ? ('AS' + c.asn) : ''].filter(Boolean).join(' ')
        };
      }
    },
    {
      url: 'https://ipapi.co/json/',
      map: function (d) {
        return {
          ip: d.ip,
          loc: [d.country_name, d.region, d.city].filter(Boolean).join(' · '),
          isp: [d.org || '', d.asn || ''].filter(Boolean).join(' ')
        };
      }
    },
    {
      url: 'https://ipinfo.io/json',
      map: function (d) {
        return {
          ip: d.ip,
          loc: [d.country, d.region, d.city].filter(Boolean).join(' · '),
          isp: d.org || ''
        };
      }
    }
  ];

  function setText(id, v) {
    var el = document.getElementById(id);
    if (el) { el.textContent = (v && String(v).trim()) ? v : '—'; }
  }

  function setSummary(text, state) {
    var msg = document.getElementById('statusMsg');
    var dot = document.getElementById('statusDot');
    if (msg) { msg.textContent = text; }
    if (dot) {
      dot.classList.remove('ok', 'fail', 'busy');
      dot.classList.add(state || 'busy');
    }
  }

  function loadGeo(done) {
    var idx = 0;
    function tryNext() {
      if (idx >= GEO_APIS.length) {
        setText('netIp', '获取失败');
        setText('netLoc', '—');
        setText('netIsp', '—');
        done(null);
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
        setText('netIsp', info.isp);
        done(info);
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

  function run() {
    var btn = document.getElementById('statusRefresh');
    if (btn) { btn.disabled = true; }
    setSummary('正在获取你的出口 IP…', 'busy');
    loadTz();

    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    loadGeo(function (info) {
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      var secs = ((now - t0) / 1000).toFixed(1);
      if (info) {
        setSummary('出口 IP ' + info.ip + ' · ' + (info.loc || '未知地区') + ' · 耗时 ' + secs + ' 秒', 'ok');
      } else {
        setSummary('无法获取出口 IP,可能被浏览器扩展或网络拦截', 'fail');
      }
      if (btn) { btn.disabled = false; }
    });
  }

  var btn = document.getElementById('statusRefresh');
  if (btn) { btn.addEventListener('click', run); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
