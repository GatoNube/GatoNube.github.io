/* 当前网络状况
   全部检测在浏览器本地发起,反映的是「访问者当前网络」的连通性。 */
(function () {
  'use strict';

  var host = document.getElementById('probeGroups');
  if (!host) { return; }

  /* ================= 待检测的服务(按分组) ================= */
  var GROUPS = [
    {
      title: '海外 AI 厂商',
      items: [
        { n: 'OpenAI',              u: 'https://api.openai.com/' },
        { n: 'Anthropic Claude',    u: 'https://api.anthropic.com/' },
        { n: 'Google Gemini',       u: 'https://generativelanguage.googleapis.com/' },
        { n: 'Google AI Studio',    u: 'https://aistudio.google.com/' },
        { n: 'xAI Grok',            u: 'https://api.x.ai/' },
        { n: 'Mistral AI',          u: 'https://api.mistral.ai/' },
        { n: 'Cohere',              u: 'https://api.cohere.com/' },
        { n: 'Groq',                u: 'https://api.groq.com/' },
        { n: 'Together AI',         u: 'https://api.together.xyz/' },
        { n: 'Fireworks AI',        u: 'https://api.fireworks.ai/' },
        { n: 'Perplexity',          u: 'https://api.perplexity.ai/' },
        { n: 'NVIDIA NIM',          u: 'https://integrate.api.nvidia.com/' },
        { n: 'Hugging Face',        u: 'https://huggingface.co/' },
        { n: 'Replicate',           u: 'https://api.replicate.com/' },
        { n: 'Stability AI',        u: 'https://api.stability.ai/' },
        { n: 'OpenRouter',          u: 'https://openrouter.ai/' }
      ]
    },
    {
      title: '国内 AI 厂商',
      items: [
        { n: 'DeepSeek 深度求索',     u: 'https://api.deepseek.com/' },
        { n: '月之暗面 Kimi',        u: 'https://api.moonshot.cn/' },
        { n: '阿里通义千问',          u: 'https://dashscope.aliyuncs.com/' },
        { n: '智谱 GLM',            u: 'https://open.bigmodel.cn/' },
        { n: '百度文心一言',          u: 'https://aip.baidubce.com/' },
        { n: '腾讯混元',             u: 'https://hunyuan.tencentcloudapi.com/' },
        { n: '字节豆包 Doubao',      u: 'https://ark.cn-beijing.volces.com/' },
        { n: '讯飞星火',             u: 'https://spark-api-open.xf-yun.com/' },
        { n: 'MiniMax',             u: 'https://api.minimaxi.com/' },
        { n: '零一万物 Yi',          u: 'https://api.lingyiwanwu.com/' },
        { n: '硅基流动 SiliconFlow', u: 'https://api.siliconflow.cn/' },
        { n: '阶跃星辰 StepFun',      u: 'https://api.stepfun.com/' },
        { n: '百川智能',             u: 'https://api.baichuan-ai.com/' }
      ]
    },
    {
      title: '基础服务',
      items: [
        { n: 'Cloudflare',          u: 'https://www.cloudflare.com/cdn-cgi/trace' },
        { n: 'Vercel',              u: 'https://vercel.com/' },
        { n: 'GitHub',              u: 'https://github.com/' },
        { n: 'Vercel Demo(我的)',    u: 'https://my-openai-gemini-demo.vercel.app/' }
      ]
    }
  ];

  var TIMEOUT = 6000;   /* 单次探测超时(毫秒) */

  /* ================= 探测 ================= */
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

  /* ================= 渲染骨架 ================= */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderSkeleton() {
    var html = '';
    GROUPS.forEach(function (g, gi) {
      html += '<h3 class="sub-h">' + esc(g.title) + '</h3>';
      html += '<div class="probe-grid">';
      g.items.forEach(function (it, ii) {
        html += '<div class="probe-item pending" id="p_' + gi + '_' + ii + '" title="' + esc(it.u) + '">' +
                  '<span class="nm">' + esc(it.n) + '</span>' +
                  '<span class="st">···</span>' +
                '</div>';
      });
      html += '</div>';
    });
    host.innerHTML = html;
  }

  function setItem(gi, ii, res) {
    var el = document.getElementById('p_' + gi + '_' + ii);
    if (!el) { return; }
    el.classList.remove('pending', 'ok', 'fail');
    el.classList.add(res.ok ? 'ok' : 'fail');
    el.querySelector('.st').textContent = res.ok ? (res.ms + ' ms') : (res.reason || '不可达');
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

    var total = GROUPS.reduce(function (a, g) { return a + g.items.length; }, 0);

    renderSkeleton();
    setSummary('正在检测 ' + total + ' 个服务的可达性…', 'busy');

    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();

    loadGeo();
    loadTz();

    var done = 0, okCount = 0, unreachable = [];

    GROUPS.forEach(function (g, gi) {
      g.items.forEach(function (it, ii) {
        probe(it.u).then(function (res) {
          setItem(gi, ii, res);
          done++;
          if (res.ok) { okCount++; } else { unreachable.push(it.n); }
          if (done === total) {
            var now = (window.performance && performance.now) ? performance.now() : Date.now();
            var secs = ((now - t0) / 1000).toFixed(1);
            var allOk = okCount === total;
            var noneOk = okCount === 0;
            var extra = allOk ? ' · 全部可达'
                      : (noneOk ? ' · 当前网络无法直连这些服务' : ' · 部分不可达,可能需要代理');
            setSummary(okCount + ' / ' + total + ' 个服务可达 · 耗时 ' + secs + ' 秒' + extra,
                       allOk ? 'ok' : (noneOk ? 'fail' : 'busy'));
            if (btn) { btn.disabled = false; }
            host.setAttribute('data-unreachable', unreachable.join('|'));
          }
        });
      });
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
