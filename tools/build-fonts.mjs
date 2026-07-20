#!/usr/bin/env node
/**
 * 字体自托管构建 — 按页面实际用到的字符生成子集 woff2,输出到 fonts/。
 *
 * 为什么:Google Fonts 在国内被墙;且全量中文字体 ~4MB,子集化后 ~600KB。
 * 何时跑:index.html 的文案变更后(新增汉字不在子集里会退化为系统字体)。
 *
 * 依赖:Node 18+;pip install fonttools brotli(提供 pyftsubset 命令)
 * 用法:node tools/build-fonts.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'fonts');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wanted-fonts-'));
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* ---- 字符收集 ---- */
// Noto Serif SC:页面正文(终端是等宽字体栈,CJK 走系统字体,无需覆盖)
const notoChars = [...new Set(html)].join('');
// Long Cang:仅手写元素(便签贴画 + 涂鸦标注)
const hand = [...html.matchAll(/<[^>]*class="[^"]*(?:paste-memo|works-scribble)[^"]*"[\s\S]*?<\/(?:article|span)>/g)]
  .map((m) => m[0]).join('');
const handChars = [...new Set(hand)].join('');
fs.writeFileSync(path.join(TMP, 'chars-noto.txt'), notoChars);
fs.writeFileSync(path.join(TMP, 'chars-hand.txt'), handChars);
console.log(`chars: noto=${notoChars.length} hand=${handChars.length}`);

/* ---- 工具 ---- */
async function fetchText(url, ua) {
  const r = await fetch(url, { headers: { 'User-Agent': ua } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
async function fetchBin(url, file) {
  const r = await fetch(url, { headers: { 'User-Agent': CHROME_UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

/* ---- CJK:全量 TTF → pyftsubset 精确子集 ---- */
// 旧版 UA 让 Google 返回全量 TTF 地址
const cjkCss = await fetchText(
  'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;900&family=Long+Cang&display=swap',
  'curl/7.64'
);
const ttfUrls = [...cjkCss.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((m) => {
  const b = m[1];
  return {
    family: (b.match(/font-family:\s*'([^']+)'/) || [])[1],
    weight: (b.match(/font-weight:\s*(\d+)/) || [])[1] || '400',
    url: (b.match(/url\((https:[^)]+\.ttf)\)/) || [])[1],
  };
}).filter((f) => f.url);

const CJK_JOBS = [
  { family: 'Noto Serif SC', weight: '600', out: 'noto-serif-sc-600.woff2', chars: 'chars-noto.txt' },
  { family: 'Noto Serif SC', weight: '900', out: 'noto-serif-sc-900.woff2', chars: 'chars-noto.txt' },
  { family: 'Long Cang', weight: '400', out: 'long-cang-400.woff2', chars: 'chars-hand.txt' },
];

let css = '/* 由 tools/build-fonts.mjs 生成 — 手改无效,文案变更后请重新生成 */\n';
for (const job of CJK_JOBS) {
  const src = ttfUrls.find((f) => f.family === job.family && f.weight === job.weight);
  if (!src) throw new Error(`未找到 TTF: ${job.family} ${job.weight}`);
  const ttf = path.join(TMP, job.out.replace('.woff2', '.ttf'));
  await fetchBin(src.url, ttf);
  execFileSync('pyftsubset', [
    ttf,
    `--text-file=${path.join(TMP, job.chars)}`,
    '--flavor=woff2',
    `--output-file=${path.join(OUT, job.out)}`,
    '--layout-features=*',
  ]);
  const kb = Math.round(fs.statSync(path.join(OUT, job.out)).size / 1024);
  console.log(`${job.out}  ${kb} KB`);
  css += `@font-face{font-family:'${job.family}';font-style:normal;font-weight:${job.weight};font-display:swap;src:url("${job.out}") format("woff2");}\n`;
}

/* ---- 拉丁:直接取 Google 的分片 woff2(体积小,保留 unicode-range) ---- */
const latinCss = await fetchText(
  'https://fonts.googleapis.com/css2?family=Rye&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
  CHROME_UA
);
const used = new Set([...html].map((c) => c.codePointAt(0)));
const hit = (range) => range.split(',').some((part) => {
  const p = part.trim().replace(/^U\+/i, '');
  let lo, hi;
  if (p.includes('-')) { const [a, b] = p.split('-'); lo = parseInt(a, 16); hi = parseInt(b, 16); }
  else { lo = hi = parseInt(p, 16); }
  for (const cp of used) if (cp >= lo && cp <= hi) return true;
  return false;
});

let n = 0;
for (const m of latinCss.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
  const b = m[1];
  const family = (b.match(/font-family:\s*'([^']+)'/) || [])[1];
  const weight = (b.match(/font-weight:\s*(\d+)/) || [])[1] || '400';
  const url = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
  const range = (b.match(/unicode-range:\s*([^;]+);?/) || [])[1];
  if (!url || !range || !hit(range)) continue;
  const file = `latin-${n++}-${family.toLowerCase().replace(/\s+/g, '-')}-${weight}.woff2`;
  await fetchBin(url, path.join(OUT, file));
  css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url("${file}") format("woff2");unicode-range:${range};}\n`;
}
console.log(`latin subsets: ${n}`);

fs.writeFileSync(path.join(OUT, 'fonts.css'), css);
const total = fs.readdirSync(OUT).filter((f) => f.endsWith('.woff2'))
  .reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`fonts/ 总计 ${Math.round(total / 1024)} KB → fonts/fonts.css 已生成`);
