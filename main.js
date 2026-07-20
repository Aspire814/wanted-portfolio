const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============ 营地终端后端地址 ============ */
// '' = 同源(由 server/camp-terminal.mjs 或 nginx 反代提供 /api/chat);
// 站点托管在别处(如 GitHub Pages)时,填后端完整地址,如 'https://api.example.com'。
// 后端不可达时终端自动降级为本地脚本回答,页面不会坏。
const CAMP_API = '';

/* ============ 时钟 ============ */
(function clock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false }); };
  tick();
  setInterval(tick, 1000);
})();

/* ============ 状态栏:经纬度 + 荣誉值 ============ */
(function statusbar() {
  const pos = document.getElementById('sb-pos');
  const scr = document.getElementById('sb-scroll');
  const bar = document.querySelector('#sb-honor-bar b');
  if (!pos || !scr) return;

  window.addEventListener('pointermove', (e) => {
    const lng = (e.clientX / window.innerWidth * 360 - 180).toFixed(1);
    const lat = (90 - e.clientY / window.innerHeight * 180).toFixed(1);
    pos.textContent = `LNG ${lng} · LAT ${lat}`;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.round((window.scrollY / max) * 100) : 0;
    scr.textContent = `${String(p).padStart(3, '0')}%`;
    if (bar) bar.style.width = p + '%';
  }, { passive: true });
})();

/* ============ Reveal + 刻度条 ============ */
function fillMeter(meter) {
  const target = parseInt(meter.dataset.meter, 10) || 0;
  const bar = meter.querySelector('i');
  const num = meter.querySelector('b');

  if (reduceMotion) {
    bar.style.setProperty('--fill', target);
    num.textContent = target;
    return;
  }

  const start = performance.now();
  const DURATION = 1100;
  (function tick(now) {
    const p = Math.min((now - start) / DURATION, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = Math.round(target * eased);
    bar.style.setProperty('--fill', v);
    num.textContent = v;
    if (p < 1) requestAnimationFrame(tick);
  })(start);
}

const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window && !reduceMotion) {
  const observer = new IntersectionObserver((entries) => {
    let stagger = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.style.setProperty('--reveal-delay', `${stagger * 70}ms`);
      entry.target.classList.add('visible');
      entry.target.querySelectorAll('.meter').forEach(fillMeter);
      observer.unobserve(entry.target);
      stagger++;
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  revealEls.forEach((el) => observer.observe(el));
} else {
  revealEls.forEach((el) => {
    el.classList.add('visible');
    el.querySelectorAll('.meter').forEach(fillMeter);
  });
}

/* ============ 开枪:弹孔 ============ */
(function gunfire() {
  if (reduceMotion) return;
  const holes = [];

  document.addEventListener('click', (e) => {
    // 交互元素、贴画和案卷不吃子弹
    if (e.target.closest('a, button, input, .term, .work, label, .paste, .dossier-overlay')) return;

    const hole = document.createElement('span');
    hole.className = 'bullet-hole';
    hole.style.left = `${e.pageX}px`;
    hole.style.top = `${e.pageY}px`;
    hole.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(hole);
    holes.push(hole);
    if (holes.length > 24) holes.shift().remove();

    document.body.classList.remove('shake');
    void document.body.offsetWidth;
    document.body.classList.add('shake');
  });
})();

/* ============ 页面动作:供终端 AI 副手调用 ============ */
function fireShots(n) {
  if (reduceMotion) return;
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const hole = document.createElement('span');
      hole.className = 'bullet-hole';
      hole.style.left = `${window.scrollX + 60 + Math.random() * (window.innerWidth - 120)}px`;
      hole.style.top = `${window.scrollY + 80 + Math.random() * (window.innerHeight - 200)}px`;
      hole.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(hole);
      setTimeout(() => hole.remove(), 30000);
      document.body.classList.remove('shake');
      void document.body.offsetWidth;
      document.body.classList.add('shake');
    }, i * 240);
  }
}

function gotoSection(id) {
  const el = /^(top|s[1-5])$/.test(id) ? document.getElementById(id) : null;
  if (!el) return;
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  el.classList.remove('mod-flash');
  void el.offsetWidth;
  el.classList.add('mod-flash');
  setTimeout(() => el.classList.remove('mod-flash'), 2000);
}

/* ============ 死眼模式 ============ */
const deadeye = (function () {
  const btn = document.getElementById('deadeye-btn');
  const mode = document.getElementById('sb-mode');
  let on = false;
  let marks = [];

  function markTargets() {
    document.querySelectorAll('[data-mark]').forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const m = document.createElement('div');
      m.className = 'de-mark';
      const pad = 10;
      m.style.left = `${r.left + window.scrollX - pad}px`;
      m.style.top = `${r.top + window.scrollY - pad}px`;
      m.style.width = `${r.width + pad * 2}px`;
      m.style.height = `${r.height + pad * 2}px`;
      m.style.animationDelay = `${i * 90}ms`;
      document.body.appendChild(m);
      marks.push(m);
    });
  }

  function toggle(force) {
    on = force !== undefined ? force : !on;
    document.body.classList.toggle('deadeye', on);
    btn.classList.toggle('active', on);
    if (mode) mode.textContent = on ? '◉ DEAD EYE' : '◎ NORMAL';
    if (mode) mode.style.color = on ? '#E06C5B' : '';
    marks.forEach((m) => m.remove());
    marks = [];
    if (on) markTargets();
  }

  btn.addEventListener('click', () => toggle());

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'e' || e.key === 'E') toggle();
    if (e.key === 'Escape') toggle(false);
  });

  // 滚动 / 缩放后标记会漂移,直接重算
  let raf = null;
  ['scroll', 'resize'].forEach((ev) =>
    window.addEventListener(ev, () => {
      if (!on || raf) return;
      raf = requestAnimationFrame(() => {
        marks.forEach((m) => m.remove());
        marks = [];
        markTargets();
        raf = null;
      });
    }, { passive: true })
  );

  return { toggle };
})();

/* ============ 案卷浮层 ============ */
const dossierBox = (function () {
  const overlay = document.getElementById('dossier');
  if (!overlay) return { open() {}, close() {} };
  const cases = overlay.querySelectorAll('.dossier');
  let opened = null;

  function open(id) {
    const el = document.getElementById(id);
    if (!el || !el.classList.contains('dossier')) return;
    cases.forEach((c) => c.classList.remove('active'));
    el.classList.add('active');
    overlay.classList.add('open');
    overlay.scrollTop = 0;
    document.body.classList.add('no-scroll');
    opened = id;
    history.replaceState(null, '', '#' + id);
  }

  function close() {
    if (!opened) return;
    overlay.classList.remove('open');
    document.body.classList.remove('no-scroll');
    opened = null;
    history.replaceState(null, '', location.pathname + location.search);
  }

  document.querySelectorAll('[data-case]').forEach((card) =>
    card.addEventListener('click', (e) => {
      e.preventDefault();
      open(card.dataset.case);
    })
  );

  // 点浮层空白或"合上案卷"关闭;Esc 优先合案卷(capture 抢在死眼前面)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.dos-close')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && opened) {
      close();
      e.stopPropagation();
    }
  }, true);

  if (/^#case-/.test(location.hash)) open(location.hash.slice(1));

  return { open, close };
})();

/* ============ 贴画拖拽 ============ */
(function dragPaste() {
  let zTop = 90;

  document.querySelectorAll('[data-drag]').forEach((el) => {
    let startX = 0, startY = 0, baseX = 0, baseY = 0, dragging = false;
    const pos = { x: 0, y: 0 };

    el.addEventListener('pointerdown', (e) => {
      dragging = true;
      el.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      baseX = pos.x;
      baseY = pos.y;
      el.style.zIndex = ++zTop;
      el.classList.add('dragging');
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      pos.x = baseX + e.clientX - startX;
      pos.y = baseY + e.clientY - startY;
      el.style.setProperty('--dx', pos.x + 'px');
      el.style.setProperty('--dy', pos.y + 'px');
    });

    const drop = () => { dragging = false; el.classList.remove('dragging'); };
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
  });
})();

/* ============ Claude Code 风格终端 ============ */
(function claudeTerm() {
  const out = document.getElementById('term-out');
  const input = document.getElementById('term-input');
  const term = document.getElementById('term');
  if (!out || !input) return;

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function print(html, cls) {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.innerHTML = html;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
    return div;
  }

  /* —— 欢迎框 —— */
  print(
    [
      '<span class="t-claude">╭──────────────────────────────────────────╮</span>',
      '<span class="t-claude">│</span> <span class="t-claude">✳ Welcome to Claude Code!</span>                 <span class="t-claude">│</span>',
      '<span class="t-claude">│</span>                                           <span class="t-claude">│</span>',
      '<span class="t-claude">│</span>   /help for help · /duel for a duel       <span class="t-claude">│</span>',
      '<span class="t-claude">│</span>   cwd: <span class="t-dim">/home/lisi/camp</span>                   <span class="t-claude">│</span>',
      '<span class="t-claude">╰──────────────────────────────────────────╯</span>',
      '',
      '<span class="t-dim">※ 营地限定版 — 由赏金猎人 李斯 私人部署。可以用 / 命令,也可以直接说人话。</span>',
      '',
    ].join('\n'),
    't-box'
  );

  /* —— 会话状态:真实 token 消耗(后端回传) —— */
  const usage = { in: 0, out: 0 };

  /* —— 数据 —— */
  const SLASH = {
    '/help': () =>
      [
        '<span class="t-gold">可用命令 / COMMANDS</span>',
        '  <span class="t-claude">/whoami</span>    通缉犯档案',
        '  <span class="t-claude">/skills</span>    随身军械',
        '  <span class="t-claude">/exp</span>       八年足迹',
        '  <span class="t-claude">/work</span>      已收赏金',
        '  <span class="t-claude">/contact</span>   发电报',
        '  <span class="t-claude">/duel</span>      ⚡ 拔枪决斗(测试你的手速)',
        '  <span class="t-claude">/deadeye</span>   开关死眼模式',
        '  <span class="t-claude">/cost</span>      本次会话花费',
        '  <span class="t-claude">/clear</span>     清屏',
        '',
        '<span class="t-dim">或者直接输入任何问题,比如:他厉害吗 / 会 AI 吗 / 薪资多少</span>',
      ].join('\n'),
    '/whoami': () =>
      [
        '<span class="t-gold">★ WANTED — 李斯 / LI SI</span>',
        '  P7 全栈工程师 · 研发经理 · 8 年经验',
        '  中南大学 信息与计算科学(985)',
        '  现任 Tiger EV 研发经理,统领 15 人 AI 帮派',
        '  <span class="t-red">危险等级:极高(对 bug 而言)</span>',
      ].join('\n'),
    '/skills': () =>
      [
        '<span class="t-claude">⏺</span> <span class="t-user">Read(arsenal.json)</span>',
        '  <span class="t-dim">⎿ 读取 4 个武器槽…</span>',
        '',
        '  <span class="t-gold">主武器</span>  Java · Go · Spring Cloud · 微服务 · 单元化',
        '  <span class="t-gold">弹药库</span>  MySQL · MongoDB · Redis · Kafka · Hadoop',
        '  <span class="t-gold">副武器</span>  React · TypeScript · Next.js · NestJS',
        '  <span class="t-gold">死眼</span>    Claude Code · MCP · AI Agent · SDD',
      ].join('\n'),
    '/exp': () =>
      [
        '<span class="t-claude">⏺</span> <span class="t-user">Search(trail/ , pattern: "*")</span>',
        '  <span class="t-dim">⎿ 找到 4 段足迹</span>',
        '',
        '  2024-2026  Tiger EV         <span class="t-dim">研发经理 · AI SDD 帮派 +300%</span>',
        '  2024       自由职业         <span class="t-dim">日产官网 · DeepSeek Agent</span>',
        '  2020-2023  Webull 总部      <span class="t-dim">千万级证券平台核心开发</span>',
        '  2018-2020  草花互动         <span class="t-dim">百万级投放系统 · PV 峰值 7000W</span>',
      ].join('\n'),
    '/work': () =>
      [
        '<span class="t-claude">⏺</span> <span class="t-user">Search(bounties/)</span>',
        '  <span class="t-dim">⎿ 4 张赏金单已兑现</span>',
        '',
        '  №1  AI SDD 研发工作流    <span class="t-ok">$+300% · SLA 99%</span>',
        '  №2  Webull 交易平台      <span class="t-ok">10M+ users · 7×24</span>',
        '  №3  日产中国官网         <a href="https://www.nissan.com.cn/" target="_blank" rel="noopener">nissan.com.cn ↗</a>',
        '  №4  东南亚换电平台       <span class="t-ok">周期 6→3mo · 0 事故</span>',
        '  №5  草花投放监测系统     <span class="t-ok">PV 峰值 7000W+ · DMP</span>',
        '',
        '<span class="t-dim">※ FIG.3 的赏金卡都能点开 — 完整案卷:背景 / 架构图 / 关键决策</span>',
      ].join('\n'),
    '/contact': () =>
      [
        '<span class="t-gold">✉ TELEGRAPH — 电报线路已接通</span>',
        '  <a href="mailto:aspirelisi@gmail.com">aspirelisi@gmail.com</a>',
        '  <span class="t-dim">对有意思的项目,枪随时上膛。</span>',
      ].join('\n'),
    '/cost': () => {
      // deepseek-chat 参考牌价:¥2/M 输入 · ¥8/M 输出(改价了就改这两个数)
      const est = (usage.in * 2 + usage.out * 8) / 1e6;
      const live = usage.in + usage.out > 0;
      return [
        'Total cost:            ' + (live
          ? `<span class="t-gold">≈ ¥${est.toFixed(4)}</span> <span class="t-dim">— 比一颗子弹便宜</span>`
          : '<span class="t-gold">$0.00(本店免费)</span>'),
        'Total duration (wall): 你已停留 ' + Math.round(performance.now() / 1000) + 's',
        'Token usage:           ' + (live
          ? `<span class="t-gold">${usage.in} in · ${usage.out} out</span>`
          : '<span class="t-dim">∞ 诚意</span>'),
      ].join('\n');
    },
    '/model': () => '当前模型:<span class="t-claude">claude-gunslinger-5</span> <span class="t-dim">(西部特调,不支持切换)</span>',
    '/resume': () => '<span class="t-dim">resume.pdf 是二进制文件 — 完整版请发电报索取:</span><a href="mailto:aspirelisi@gmail.com">aspirelisi@gmail.com</a>',
  };

  /* —— 自然语言回复池 —— */
  const BRAIN = [
    { re: /(厉害|牛|强|行不行|水平)/, a: '我读完了他的档案:8 年、千万级金融系统、AI SDD 团队 +300% 效率。<span class="t-gold">这么说吧,他的枪比我的补全还快。</span>' },
    { re: /(ai|人工智能|claude|agent|sdd)/i, a: '他从零搭过 AI SDD 研发体系 — 需求到运维全链路。我平时就给他打工,<span class="t-claude">工作体验:老板很懂行,prompt 从不含糊。</span>' },
    { re: /(薪资|工资|钱|报价|价格|多少k)/, a: '<span class="t-red">这个赏金数额需要面议。</span>发电报:<a href="mailto:aspirelisi@gmail.com">aspirelisi@gmail.com</a> — 他说了,谈钱不伤感情。' },
    { re: /(java|spring|微服务|架构)/i, a: 'Java 是他的主武器:Spring Cloud 全家桶、系统单元化、JVM 调优。Webull 千万级交易平台就是战绩之一。<span class="t-dim">建议直接 /work 查看赏金单。</span>' },
    { re: /(前端|react|next|全栈)/i, a: '副武器也不含糊:React / Next.js / NestJS,日产中国官网就是他一个人全栈交付的。<span class="t-dim">"一个人是一支队伍"不是修辞。</span>' },
    { re: /(招聘|合作|入伙|offer|工作)/, a: '<span class="t-gold">档案显示:STATUS = OPEN TO WORK。</span>下一票大的还缺个军师?发电报:<a href="mailto:aspirelisi@gmail.com">aspirelisi@gmail.com</a>' },
    { re: /(你好|hello|hi|在吗|嗨)/i, a: '你好,陌生人。营地欢迎你。<span class="t-dim">输入 /help 看看能做什么,或者 /duel 来一场决斗。</span>' },
    { re: /(是谁|什么人|介绍)/, a: '通缉令上写着呢:李斯,人称 THE DEAD-EYE CODER。要完整档案就输 /whoami。' },
    { re: /(案卷|详情|细节|架构图)/, a: 'FIG.3 布告栏上的四张赏金卡都能点开 — 里面是完整案卷:背景、架构图、关键决策。<span class="t-dim">建议从 №2 Webull 那张看起。</span>' },
    { re: /(飞盘|摄影|旅行|爱好)/, a: '卷宗备注:此人出没于旅行途中、取景框后,以及极限飞盘场上。<span class="t-dim">抓捕时请注意,他跑得很快。</span>' },
  ];

  const FALLBACK = [
    '有意思的问题。不过我的知识范围只覆盖这张通缉令 — 试试 /help,或者问问他的技术、经历、赏金。',
    '<span class="t-dim">(翻了翻卷宗)</span>这个没查到。但我可以告诉你:他的效率 +300% 是真的,我亲眼看着跑出来的。',
    '这超出了营地终端的权限。要不来一局 /duel?赢了我把老板的邮箱给你 <span class="t-dim">(输了也给)</span>。',
  ];

  const SPIN_VERBS = ['Thinking', 'Wrangling', 'Lassoing', 'Brewing', 'Pondering', 'Sharpening'];

  /* —— 决斗状态 —— */
  let duel = null; // {phase:'wait'|'draw', timer, t0}

  function startDuel() {
    print('<span class="t-gold">⚡ 决斗开始。</span>看到 <span class="t-red">DRAW!</span> 立刻按回车 — 提前动手者,死。', '');
    print('<span class="t-dim">对手正在盯着你……</span>');
    duel = { phase: 'wait' };
    duel.timer = setTimeout(() => {
      duel.phase = 'draw';
      duel.t0 = performance.now();
      print('DRAW!', 't-draw');
    }, 1600 + Math.random() * 2600);
  }

  function resolveDuel() {
    if (duel.phase === 'wait') {
      clearTimeout(duel.timer);
      print('<span class="t-red">☠ 你提前拔枪了。</span>对手一枪撂倒了你。<span class="t-dim">(输入 /duel 再来)</span>');
      duel = null;
      return;
    }
    const ms = Math.round(performance.now() - duel.t0);
    let rank;
    if (ms < 220) rank = '<span class="t-gold">★★★ 传奇枪手 — 比 Claude 的首 token 还快</span>';
    else if (ms < 320) rank = '<span class="t-ok">★★ 亡命之徒 — 够格入伙</span>';
    else if (ms < 500) rank = '★ 农场新手 — 再练练';
    else rank = '<span class="t-dim">☠ 你已经死了 — 对手都收枪了</span>';
    print(`<span class="t-claude">⏺</span> 反应时间 <span class="t-gold">${ms}ms</span>\n  ⎿ ${rank}`);
    duel = null;
  }

  /* —— 思考动画 —— */
  function spinner() {
    const verb = SPIN_VERBS[Math.floor(Math.random() * SPIN_VERBS.length)];
    const line = print(`<span class="t-claude">✳</span> <span class="t-dim">${verb}…</span>`);
    const frames = ['✳', '✶', '✷', '✸', '✷', '✶'];
    let i = 0;
    const iv = setInterval(() => {
      i++;
      line.innerHTML = `<span class="t-claude">${frames[i % frames.length]}</span> <span class="t-dim">${verb}… <i>(${(i * 0.12).toFixed(1)}s)</i></span>`;
    }, 120);
    let stopped = false;
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        clearInterval(iv);
        line.remove();
      },
    };
  }

  function think(done) {
    const spin = spinner();
    setTimeout(() => { spin.stop(); done(); }, reduceMotion ? 10 : 700 + Math.random() * 800);
  }

  /* —— 本地脑:后端不在线时的降级回答 —— */
  function localAnswer(q) {
    const hit = BRAIN.find((b) => b.re.test(q));
    const text = hit ? hit.a : FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
    think(() => print(`<span class="t-claude">⏺</span> ${text}\n`));
  }

  /* —— 真 LLM 接线:SSE 流式问答 —— */
  const CHAT_URL = CAMP_API + '/api/chat';
  const chatLog = [];
  let apiDown = false;

  // LLM 输出协议:[gold]/[red]/[dim]/[claude] 高亮标记 + [action:*] 页面动作。
  // 先转义再翻译标记 — 模型输出永远不直接进 innerHTML。
  function renderCamp(raw) {
    return esc(raw.replace(/\[action:[a-z]+(?::[a-z0-9]+)?\]/gi, '').trimEnd())
      .replace(/\[(gold|red|dim|claude)\]/g, '<span class="t-$1">')
      .replace(/\[\/(gold|red|dim|claude)\]/g, '</span>')
      .replace(/aspirelisi@gmail\.com/g, '<a href="mailto:aspirelisi@gmail.com">aspirelisi@gmail.com</a>');
  }

  function runActions(raw) {
    const seen = new Set();
    for (const m of raw.matchAll(/\[action:([a-z]+)(?::([a-z0-9]+))?\]/gi)) {
      const name = m[1].toLowerCase();
      const arg = (m[2] || '').toLowerCase();
      if (seen.has(name + arg)) continue;
      seen.add(name + arg);
      if (name === 'deadeye') deadeye.toggle();
      else if (name === 'duel') startDuel();
      else if (name === 'shoot') fireShots(2 + Math.floor(Math.random() * 3));
      else if (name === 'goto') gotoSection(arg);
      else if (name === 'case') dossierBox.open('case-' + arg);
    }
  }

  async function answer(q) {
    if (apiDown) return localAnswer(q);
    chatLog.push({ role: 'user', content: q });
    const spin = spinner();

    let resp = null;
    try {
      resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatLog.slice(-8) }),
        signal: AbortSignal.timeout(45000),
      });
    } catch { /* 网络不通,下面统一处理 */ }

    if (!resp || !resp.ok || !resp.body) {
      spin.stop();
      chatLog.pop();
      if (resp && (resp.status === 429 || resp.status === 503)) {
        const info = await resp.json().catch(() => null);
        print(`<span class="t-red">⏺ ${esc(info?.message || '电报线路拥挤,稍后再试。')}</span>\n`);
        return;
      }
      apiDown = true; // 后端不存在或不可达:本次会话直接走本地脑
      return localAnswer(q);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let sse = '';
    let text = '';
    let line = null;
    const flush = () => {
      if (!line) { spin.stop(); line = print(''); }
      line.innerHTML = `<span class="t-claude">⏺</span> ${renderCamp(text)}\n`;
      out.scrollTop = out.scrollHeight;
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        sse += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = sse.indexOf('\n')) >= 0) {
          const l = sse.slice(0, idx).trim();
          sse = sse.slice(idx + 1);
          if (!l.startsWith('data:')) continue;
          const payload = l.slice(5).trim();
          if (payload === '[DONE]') continue;
          let msg;
          try { msg = JSON.parse(payload); } catch { continue; }
          if (msg.delta) { text += msg.delta; flush(); }
          if (msg.usage) {
            usage.in += msg.usage.prompt_tokens || 0;
            usage.out += msg.usage.completion_tokens || 0;
          }
        }
      }
    } catch { /* 半路断流:保留已收到的部分 */ }

    spin.stop();
    if (!text) { chatLog.pop(); return localAnswer(q); }
    chatLog.push({ role: 'assistant', content: text });
    runActions(text);
  }

  /* —— 主循环 —— */
  const NAMES = Object.keys(SLASH).concat(['/deadeye', '/duel', '/clear']);
  const history = [];
  let hIndex = 0;

  function run(raw) {
    const cmd = raw.trim();

    if (duel) { resolveDuel(); return; }
    if (!cmd) return;

    print(`<span class="t-dim">›</span> <span class="t-user">${esc(cmd)}</span>`);

    if (cmd === '/clear') { out.innerHTML = ''; return; }
    if (cmd === '/duel') { startDuel(); return; }
    if (cmd === '/deadeye') {
      deadeye.toggle();
      print('<span class="t-claude">⏺</span> 死眼模式已切换。<span class="t-dim">时间变慢了……目标已标记。按 [E] 或 Esc 退出。</span>\n');
      return;
    }

    const fn = SLASH[cmd.toLowerCase()];
    if (fn) { print(fn() + '\n'); return; }

    if (cmd.startsWith('/')) {
      print(`<span class="t-red">Unknown command:</span> ${esc(cmd)} — 输入 <span class="t-claude">/help</span>\n`);
      return;
    }

    answer(cmd);
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = input.value;
      if (v.trim()) { history.push(v); hIndex = history.length; }
      input.value = '';
      run(v);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      const matches = NAMES.filter((n) => n.startsWith(v.toLowerCase()));
      if (matches.length === 1) input.value = matches[0];
      else if (matches.length > 1) print(matches.map((m) => `<span class="t-claude">${m}</span>`).join('  '));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIndex > 0) { hIndex--; input.value = history[hIndex]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIndex < history.length - 1) { hIndex++; input.value = history[hIndex]; }
      else { hIndex = history.length; input.value = ''; }
    } else if (e.key === 'Escape') {
      input.value = '';
    }
  });

  term.addEventListener('click', () => input.focus());
})();
