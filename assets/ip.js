/* IP 纯净度检测 —— 参照 ip.net.coffee/claude 的功能自行实现。
   全部请求由浏览器直接发起,不经任何中间服务器;检测结果不存储、不上传。 */
(function () {
  'use strict';

  var TIMEOUT = 9000;

  /* Claude 不支持地区(高置信度子集)。完整名单以 Anthropic 官方为准。 */
  var CLAUDE_BLOCKED = {
    CN: '中国大陆', HK: '中国香港', MO: '中国澳门',
    RU: '俄罗斯', BY: '白俄罗斯',
    KP: '朝鲜', IR: '伊朗', SY: '叙利亚', CU: '古巴', VE: '委内瑞拉',
    AF: '阿富汗', MM: '缅甸', LY: '利比亚', SD: '苏丹',
    SO: '索马里', YE: '也门', SS: '南苏丹', ER: '厄立特里亚'
  };

  var P = {};                                   /* 收集到的全部数据 */
  var GEO_CHAIN = ['https://ipwho.is/', 'https://ipinfo.io/json'];

  /* ==================== 工具 ==================== */
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setText(id, v) {
    var e = $(id);
    if (e) { e.textContent = (v === undefined || v === null || v === '') ? '—' : v; }
  }

  function timed(ms) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms) : null;
    return {
      signal: ctrl ? ctrl.signal : undefined,
      clear: function () { if (timer) { clearTimeout(timer); } }
    };
  }

  function fetchJSON(url, ms) {
    var t = timed(ms || TIMEOUT);
    var o = { cache: 'no-store', credentials: 'omit', headers: { 'Accept': 'application/json' } };
    if (t.signal) { o.signal = t.signal; }
    return fetch(url, o).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    }).then(function (d) { t.clear(); return d; },
            function (e) { t.clear(); throw e; });
  }

  function fetchText(url, ms) {
    var t = timed(ms || TIMEOUT);
    var o = { cache: 'no-store', credentials: 'omit' };
    if (t.signal) { o.signal = t.signal; }
    return fetch(url, o).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.text();
    }).then(function (d) { t.clear(); return d; },
            function (e) { t.clear(); throw e; });
  }

  function kv(containerId, rows) {
    var c = $(containerId);
    if (!c) { return; }
    c.innerHTML = rows.map(function (r) {
      return '<div class="kv-item ' + (r[2] || '') + '"><span class="k">' + esc(r[0]) +
             '</span><span class="v">' + esc(r[1]) + '</span></div>';
    }).join('');
  }

  function isV6(ip) { return /:/.test(ip || ''); }

  /* ==================== 1. 出口 IP 概览 ==================== */
  function loadIP() {
    var i = 0;
    function next() {
      if (i >= GEO_CHAIN.length) { throw new Error('all geo apis failed'); }
      var url = GEO_CHAIN[i++];
      return fetchJSON(url).then(function (d) {
        if (!d || d.success === false || d.error) { throw new Error('bad'); }
        if (!d.ip) { throw new Error('no ip'); }
        P.ip = d.ip;
        P.isV6Addr = isV6(d.ip);
        P.countryCode = d.country_code || d.country || '';
        P.country = d.country || d.country_name || '';
        P.region = d.region || '';
        P.city = d.city || '';
        if (d.connection) {
          P.asnNum = d.connection.asn;
          P.org = d.connection.org || d.connection.isp || '';
          P.isp = d.connection.isp || '';
          P.asnDomain = d.connection.domain || '';
        } else if (d.org) {
          P.org = d.org;
          var m = /^AS(\d+)\s+(.*)$/.exec(d.org);
          if (m) { P.asnNum = m[1]; P.org = m[2]; }
        }
        P.tzFromApi = (d.timezone && d.timezone.id) || d.timezone || '';
        renderIP();
        return P.ip;
      }).catch(function () { return next(); });
    }
    return Promise.resolve().then(next);
  }

  function renderIP() {
    var cc = (P.countryCode || '').toUpperCase();
    var blocked = cc && CLAUDE_BLOCKED[cc];
    kv('ipOverview', [
      ['出口 IP', P.ip, ''],
      ['IP 版本', P.isV6Addr ? 'IPv6' : 'IPv4', P.isV6Addr ? 'warn' : 'ok'],
      ['国家 / 地区', (P.country || '未知') + (cc ? ' (' + cc + ')' : ''),
        cc ? (blocked ? 'bad' : 'ok') : ''],
      ['城市 / 区域', [P.region, P.city].filter(Boolean).join(' · ') || '未知', ''],
      ['ASN', P.asnNum ? ('AS' + P.asnNum) : '未知', ''],
      ['运营商 / 组织', P.org || '未知', '']
    ]);
  }

  /* ==================== 2. 风控标记 ==================== */
  function loadRisk(ip) {
    return fetchJSON('https://ipinfo.io/widget/demo/' + encodeURIComponent(ip)).then(function (d) {
      var v = (d && d.data) ? d.data : d;
      if (!v) { throw new Error('bad'); }
      P.privacy = v.privacy || {};
      P.asnType = (v.asn && v.asn.type) || '';
      P.asnName = (v.asn && v.asn.name) || '';
      P.asnRoute = (v.asn && v.asn.route) || '';
      P.company = v.company || null;
      P.abuse = v.abuse || null;
      P.isAnycast = v.is_anycast;
      P.isMobile = v.is_mobile;
      P.isAnonymous = v.is_anonymous;
      P.isHosting = v.is_hosting;
      renderRisk();
      renderAttr();
    });
  }

  function chip(label, state) {
    return '<span class="chip ' + (state || 'mute') + '">' + esc(label) + '</span>';
  }

  function renderRisk() {
    var p = P.privacy || {};
    var e = $('riskChips');
    if (!e) { return; }
    var has = false;
    var out = [];
    if (p.vpn) { out.push(chip('VPN', 'bad')); has = true; } else { out.push(chip('VPN 未检出', 'ok')); }
    if (p.proxy) { out.push(chip('代理 Proxy', 'bad')); has = true; } else { out.push(chip('代理 未检出', 'ok')); }
    if (p.tor) { out.push(chip('Tor', 'bad')); has = true; } else { out.push(chip('Tor 未检出', 'ok')); }
    if (p.relay) { out.push(chip('中继 Relay', 'warn')); has = true; } else { out.push(chip('中继 未检出', 'ok')); }
    if (p.hosting || P.isHosting) { out.push(chip('机房 Hosting', 'bad')); has = true; }
    else { out.push(chip('非机房 IP', 'ok')); }
    if (P.isAnonymous) { out.push(chip('匿名访问', 'bad')); has = true; }
    if (P.isAnycast) { out.push(chip('Anycast', 'warn')); }
    if (P.isMobile) { out.push(chip('移动网络', 'mute')); }
    if (p.service) { out.push(chip('识别为 ' + p.service, 'warn')); }
    e.innerHTML = out.join('');
    P.riskHit = has;
  }

  function renderAttr() {
    var abuse = P.abuse || {};
    kv('attrGrid', [
      ['ASN 类型', P.asnType || '未知',
        P.asnType === 'isp' ? 'ok' : (P.asnType === 'hosting' ? 'bad' : '')],
      ['ASN 路由段', P.asnRoute || '未知', ''],
      ['公司主体', (P.company && P.company.name) || P.asnName || '未知', ''],
      ['是否 Anycast', P.isAnycast ? '是' : '否', P.isAnycast ? 'warn' : ''],
      ['是否移动网络', P.isMobile ? '是' : '否', ''],
      ['滥用联系邮箱', abuse.email || '未知', ''],
      ['滥用联系网络', abuse.network || '未知', '']
    ]);
  }

  /* ==================== 3. Cloudflare 痕迹 ==================== */
  function loadCF() {
    return fetchText('https://www.cloudflare.com/cdn-cgi/trace').then(function (txt) {
      var o = {};
      txt.trim().split('\n').forEach(function (line) {
        var i = line.indexOf('=');
        if (i > 0) { o[line.slice(0, i)] = line.slice(i + 1); }
      });
      P.cf = o;
      var warp = o.warp || '', gw = o.gateway || '';
      kv('cfGrid', [
        ['WARP', warp === 'on' ? '已开启' : (warp === 'plus' ? 'WARP+' : '未开启'),
          warp === 'on' || warp === 'plus' ? 'warn' : 'ok'],
        ['Gateway', gw === 'on' ? '已开启' : '未开启', ''],
        ['落地机房 (colo)', o.colo || '未知', ''],
        ['CF 判定地区', o.loc || '未知', ''],
        ['TLS 版本', o.tls || '未知', ''],
        ['SNI', o.sni === 'plaintext' ? '明文可见' : (o.sni || '未知'), ''],
        ['HTTP 版本', (o.http || '').replace('http/', 'HTTP/') || '未知', ''],
        ['密钥交换', o.kex || '未知', '']
      ]);
    });
  }

  /* ==================== 4. DNS 出口 ==================== */
  function loadDNS() {
    return fetchJSON('https://edns.ip-api.com/json').then(function (d) {
      P.dnsExit = d.dns || {};
      P.edns = d.edns || {};
      var leak = '';
      if (P.dnsExit.geo && P.country && P.dnsExit.geo.indexOf(P.country) < 0) {
        leak = 'warn';
      } else { leak = 'ok'; }
      kv('dnsGrid', [
        ['DNS 解析器 IP', P.dnsExit.ip || '未知', ''],
        ['DNS 解析器归属', P.dnsExit.geo || '未知', leak],
        ['EDNS 客户端子网', P.edns.ip || '未知', ''],
        ['EDNS 归属', P.edns.geo || '未知', '']
      ]);
    });
  }

  /* ==================== 5. Claude 可用性 ==================== */
  var CLAUDE_TARGETS = [
    { n: 'claude.ai', u: 'https://claude.ai/' },
    { n: 'api.anthropic.com', u: 'https://api.anthropic.com/' },
    { n: 'console.anthropic.com', u: 'https://console.anthropic.com/' },
    { n: 'docs.claude.com', u: 'https://docs.claude.com/' }
  ];

  function probeTiming(url) {
    return new Promise(function (resolve) {
      var ctrl = ('AbortController' in window) ? new AbortController() : null;
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      var done = false;
      var timer = setTimeout(function () {
        if (done) { return; }
        done = true;
        if (ctrl) { try { ctrl.abort(); } catch (e) {} }
        resolve({ ok: false, ms: null });
      }, TIMEOUT);
      var o = { mode: 'no-cors', cache: 'no-store', redirect: 'follow', credentials: 'omit' };
      if (ctrl) { o.signal = ctrl.signal; }
      fetch(url, o).then(function () {
        if (done) { return; }
        done = true; clearTimeout(timer);
        var now = (window.performance && performance.now) ? performance.now() : Date.now();
        resolve({ ok: true, ms: Math.round(now - t0) });
      }).catch(function () {
        if (done) { return; }
        done = true; clearTimeout(timer);
        resolve({ ok: false, ms: null });
      });
    });
  }

  function loadAvail() {
    var c = $('availGrid');
    if (c) {
      c.innerHTML = CLAUDE_TARGETS.map(function (t) {
        return '<div class="kv-item"><span class="k">' + esc(t.n) +
               '</span><span class="v">检测中…</span></div>';
      }).join('');
    }
    return Promise.all(CLAUDE_TARGETS.map(function (t) {
      return probeTiming(t.u).then(function (r) { return { n: t.n, r: r }; });
    })).then(function (list) {
      P.claudeReach = list;
      if (!c) { return; }
      c.innerHTML = list.map(function (x) {
        var state = x.r.ok ? 'ok' : 'bad';
        var val = x.r.ok ? (x.r.ms + ' ms') : '不可达';
        return '<div class="kv-item ' + state + '"><span class="k">' + esc(x.n) +
               '</span><span class="v">' + esc(val) + '</span></div>';
      }).join('');
    });
  }

  /* ==================== 6. WebRTC 泄漏 ==================== */
  function loadWebRTC() {
    return new Promise(function (resolve) {
      if (!window.RTCPeerConnection) {
        kv('leakGrid', [['WebRTC', '浏览器不支持', 'mute']]);
        resolve(); return;
      }
      var found = { local: [], pub: [] };
      var pc;
      try {
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.nextcloud.com:443' }
          ]
        });
      } catch (e) {
        kv('leakGrid', [['WebRTC', '初始化失败', 'warn']]);
        resolve(); return;
      }
      var done = false;
      function finish() {
        try { pc.close(); } catch (e) {}
        var leaked = found.pub.filter(function (ip) {
          return P.ip && ip !== P.ip;
        });
        kv('leakGrid', [
          ['WebRTC 本地地址', found.local.join(', ') || '未暴露(已保护)',
            found.local.length ? 'warn' : 'ok'],
          ['WebRTC 公网地址', found.pub.join(', ') || '未获取到', ''],
          ['与 HTTP 出口是否一致',
            found.pub.length ? (leaked.length ? '不一致,存在泄漏' : '一致') : '无法判断',
            found.pub.length ? (leaked.length ? 'bad' : 'ok') : '']
        ]);
        resolve();
      }
      var guard = setTimeout(function () {
        if (!done) { done = true; finish(); }
      }, 6000);

      pc.onicecandidate = function (e) {
        if (!e || !e.candidate) {
          if (!done) { done = true; clearTimeout(guard); finish(); }
          return;
        }
        var s = e.candidate.candidate || '';
        var m = /([0-9a-fA-F:.]+)\s+\d+\s+typ\s+(host|srflx|prflx|relay)/i.exec(s);
        if (m) {
          var ip = m[1], kind = m[2].toLowerCase();
          if (kind === 'host' && found.local.indexOf(ip) < 0) { found.local.push(ip); }
          if ((kind === 'srflx' || kind === 'prflx') && found.pub.indexOf(ip) < 0) { found.pub.push(ip); }
        } else if (/\.local/i.test(s) && found.local.indexOf('mDNS 已隐藏') < 0) {
          found.local.push('mDNS 已隐藏');
        }
      };
      try {
        pc.createDataChannel('gn');
        pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
          .catch(function () { if (!done) { done = true; clearTimeout(guard); finish(); } });
      } catch (e) {
        if (!done) { done = true; clearTimeout(guard); finish(); }
      }
    });
  }

  /* ==================== 7. 浏览器指纹 ==================== */
  function canvasHash() {
    try {
      var c = document.createElement('canvas');
      c.width = 220; c.height = 40;
      var x = c.getContext('2d');
      x.fillStyle = '#f60'; x.fillRect(0, 0, 220, 40);
      x.fillStyle = '#069'; x.font = '16px Arial';
      x.fillText('GatoNube IP Check 检测', 6, 26);
      x.strokeStyle = 'rgba(30,120,200,.6)';
      x.beginPath(); x.arc(62, 20, 15, 0, Math.PI * 1.6); x.stroke();
      var d = c.toDataURL();
      var h = 2166136261;
      for (var i = 0; i < d.length; i++) {
        h ^= d.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ('00000000' + (h >>> 0).toString(16)).slice(-8);
    } catch (e) { return ''; }
  }

  function webglInfo() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) { return null; }
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : (gl.getParameter(gl.VENDOR) || ''),
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl.getParameter(gl.RENDERER) || '')
      };
    } catch (e) { return null; }
  }

  function renderFingerprint() {
    var gl = webglInfo();
    var tz = '';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {}
    var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || '';
    var scr = (screen.width || 0) + '×' + (screen.height || 0);
    var uaData = navigator.userAgentData;
    var platform = (uaData && uaData.platform) || navigator.platform || '未知';

    var rows = [
      ['时区', tz || '未知', P.tzFromApi && tz === P.tzFromApi ? 'ok' : 'warn'],
      ['时区是否与 IP 匹配', (P.tzFromApi && tz) ? (tz === P.tzFromApi ? '一致' : '不一致(建议对齐)') : '无法判断',
        (P.tzFromApi && tz) ? (tz === P.tzFromApi ? 'ok' : 'warn') : ''],
      ['语言', (navigator.language || '未知') + ' / ' + ((navigator.languages || []).join(', ') || '-'), ''],
      ['平台', platform, ''],
      ['CPU 核心数', navigator.hardwareConcurrency ? (navigator.hardwareConcurrency + ' 核') : '未知', ''],
      ['内存(参考)', navigator.deviceMemory ? (navigator.deviceMemory + ' GB') : '未提供', ''],
      ['屏幕分辨率', scr, ''],
      ['像素比 DPR', window.devicePixelRatio || 1, ''],
      ['触屏支持', (navigator.maxTouchPoints > 0) ? ('是 (' + navigator.maxTouchPoints + ' 点)') : '否', ''],
      ['Do Not Track', dnt === '1' || dnt === 'yes' ? '已开启' : '未开启', dnt === '1' || dnt === 'yes' ? 'ok' : ''],
      ['WebGL 厂商', gl && gl.vendor ? gl.vendor : '不可用', ''],
      ['WebGL 渲染器', gl && gl.renderer ? gl.renderer : '不可用', ''],
      ['Canvas 指纹', canvasHash() || '不可用', '']
    ];
    kv('fpGrid', rows);
  }

  /* ==================== 8. 信任评分 ==================== */
  function computeScore() {
    var score = 100;
    var rows = [];

    function cut(label, delta, why, state) {
      score += delta;
      rows.push([label, (delta > 0 ? '+' : '') + delta, state || 'bad', why]);
    }
    function keep(label, why, state) {
      rows.push([label, '0', state || 'ok', why]);
    }

    var cc = (P.countryCode || '').toUpperCase();
    if (cc) {
      if (CLAUDE_BLOCKED[cc]) {
        cut('出口地区不在 Claude 支持名单', -55, P.country + ' (' + cc + ')', 'bad');
      } else {
        keep('出口地区在 Claude 支持名单内', P.country + ' (' + cc + ')', 'ok');
      }
    }

    var p = P.privacy || {};
    if (p.tor) { cut('Tor 出口', -40, 'Tor 基本无法通过 Claude 风控', 'bad'); }
    if (p.vpn) { cut('VPN 出口', -18, '被识别为 VPN', 'bad'); }
    if (p.proxy) { cut('代理出口', -18, '被识别为代理', 'bad'); }
    if (p.relay) { cut('中继 / 隐私网络出口', -10, p.service || 'Apple Private Relay 等', 'warn'); }
    if (p.hosting || P.isHosting) { cut('机房 / 数据中心 IP', -28, '非住宅 IP,风控更严', 'bad'); }
    if (P.isAnonymous) { cut('被标记为匿名访问', -10, '', 'bad'); }
    if (P.asnType === 'hosting') { cut('ASN 类型为 hosting', -12, P.asnRoute || '', 'bad'); }
    if (P.asnType === 'isp') { keep('ASN 类型为运营商 (isp)', P.asnName || '', 'ok'); }
    if (P.isV6Addr) { cut('使用 IPv6 出口', -6, 'Claude Code 官方建议走 IPv4', 'warn'); }
    if (P.isAnycast) { cut('Anycast 地址', -5, '地理位置判定可能不准', 'warn'); }

    if (!p.tor && !p.vpn && !p.proxy && !p.relay && !p.hosting && !P.isHosting) {
      keep('未检出代理 / VPN / 机房特征', '', 'ok');
    }

    if (P.claudeReach) {
      var bad = P.claudeReach.filter(function (x) { return !x.r.ok; }).length;
      if (bad === P.claudeReach.length) {
        cut('Claude 全部域名不可达', -30, '当前网络无法直连 claude.ai', 'bad');
      } else if (bad > 0) {
        cut('部分 Claude 域名不可达', -8, bad + ' / ' + P.claudeReach.length + ' 个失败', 'warn');
      } else {
        keep('Claude 全部域名可达', P.claudeReach.length + ' 个', 'ok');
      }
    }

    if (score < 0) { score = 0; }
    if (score > 100) { score = 100; }

    var label, cls;
    if (score >= 76) { label = '良好 · 大概率可正常使用 Claude'; cls = 'ok'; }
    else if (score >= 51) { label = '可用 · 可能触发风控或需要验证'; cls = 'warn'; }
    else if (score >= 26) { label = '中等风险 · 较容易被限制'; cls = 'warn'; }
    else { label = '高风险 · 很可能无法使用 Claude'; cls = 'bad'; }

    P.score = score;

    var numEl = $('scoreNum');
    if (numEl) {
      numEl.textContent = score;
      numEl.className = 'score-num ' + cls;
    }
    var bar = $('scoreBar');
    if (bar) {
      bar.style.width = score + '%';
      bar.className = cls;
    }
    setText('scoreLabel', label);

    var list = $('scoreList');
    if (list) {
      list.innerHTML = rows.map(function (r) {
        return '<li class="' + r[2] + '"><span>' + esc(r[0]) +
               (r[3] ? '<em>' + esc(r[3]) + '</em>' : '') +
               '</span><span class="d">' + esc(r[1]) + '</span></li>';
      }).join('');
    }
    return score;
  }

  /* ==================== 主流程 ==================== */
  function setStatus(text, state) {
    var m = $('ipMsg'), d = $('ipDot');
    if (m) { m.textContent = text; }
    if (d) { d.className = 'dot-live ' + (state || 'busy'); }
  }

  function run() {
    var btn = $('ipRefresh');
    if (btn) { btn.disabled = true; }
    setStatus('正在检测…', 'busy');

    ['ipOverview', 'attrGrid', 'cfGrid', 'dnsGrid'].forEach(function (id) {
      var c = $(id);
      if (c) { c.innerHTML = '<div class="kv-item"><span class="k">检测中</span><span class="v">…</span></div>'; }
    });
    var rc = $('riskChips');
    if (rc) { rc.innerHTML = '<span class="chip mute">检测中…</span>'; }

    /* 指纹是同步的,立刻渲染 */
    renderFingerprint();

    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();

    var tasks = [];

    var pIP = loadIP().then(function (ip) {
      if (!ip) { throw new Error('no ip'); }
      return Promise.all([
        loadRisk(ip).catch(function () {
          P.privacy = P.privacy || {};
          kv('riskChips', []); /* noop */
          var e = $('riskChips');
          if (e) { e.innerHTML = '<span class="chip warn">风控数据获取失败(接口不可达)</span>'; }
          var a = $('attrGrid');
          if (a) { a.innerHTML = '<div class="kv-item warn"><span class="k">IP 属性</span><span class="v">获取失败</span></div>'; }
        }),
        loadCF().catch(function () {
          var c = $('cfGrid');
          if (c) { c.innerHTML = '<div class="kv-item warn"><span class="k">Cloudflare 痕迹</span><span class="v">不可达(可能未走 CF)</span></div>'; }
        }),
        loadDNS().catch(function () {
          var c = $('dnsGrid');
          if (c) { c.innerHTML = '<div class="kv-item warn"><span class="k">DNS 出口</span><span class="v">获取失败</span></div>'; }
        })
      ]);
    });
    tasks.push(pIP);

    tasks.push(loadAvail());
    tasks.push(loadWebRTC());

    return Promise.all(tasks).then(function () {
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      var secs = ((now - t0) / 1000).toFixed(1);
      var s = computeScore();
      setStatus('检测完成 · 信任评分 ' + s + ' / 100 · 耗时 ' + secs + ' 秒',
                s >= 76 ? 'ok' : (s >= 26 ? 'warn' : 'fail'));
      if (btn) { btn.disabled = false; }
    }).catch(function (e) {
      setStatus('检测失败:' + (e && e.message ? e.message : '未知错误'), 'fail');
      if (btn) { btn.disabled = false; }
    });
  }

  var btn = $('ipRefresh');
  if (btn) { btn.addEventListener('click', run); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
