import fs from 'node:fs';
const OUT = new URL("./.cache/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const CURL_UA = 'curl/7.64';
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const get = async (u, ua) => { const r = await fetch(u, { headers: { 'User-Agent': ua } }); if (!r.ok) throw new Error(r.status + ' ' + u); return r; };
const parse = (css) => [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((m) => {
  const b = m[1]; const g = (re) => (b.match(re) || [])[1];
  return { family: g(/font-family:\s*'([^']+)'/), weight: g(/font-weight:\s*(\d+)/) || '400', style: g(/font-style:\s*(\w+)/) || 'normal', url: g(/url\((https:[^)]+)\)/), range: g(/unicode-range:\s*([^;]+);?/) || '' };
});
// 1) Noto Serif SC 全量 TTF(旧 UA 拿 TTF 地址)
const cjk = parse(await (await get('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;900&display=swap', CURL_UA)).text());
for (const f of cjk) {
  const buf = Buffer.from(await (await get(f.url, CHROME_UA)).arrayBuffer());
  fs.writeFileSync(`${OUT}/noto-${f.weight}.ttf`, buf);
  console.log(`noto-${f.weight}.ttf`, Math.round(buf.length / 1024), 'KB');
}
// 2) IBM Plex Serif:只取 latin 分片
const serif = parse(await (await get('https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:ital,wght@0,400;0,600;1,400&display=swap', CHROME_UA)).text())
  .filter((f) => /U\+0000-00FF/.test(f.range));
let css = '';
for (const f of serif) {
  const name = `plex-serif-${f.weight}-${f.style}.woff2`;
  fs.writeFileSync(`${OUT}/${name}`, Buffer.from(await (await get(f.url, CHROME_UA)).arrayBuffer()));
  css += `@font-face{font-family:'IBM Plex Serif';font-style:${f.style};font-weight:${f.weight};src:url("${name}") format("woff2");}\n`;
  console.log(name);
}
css += `@font-face{font-family:'Noto Serif SC';font-weight:400;src:url("noto-400.ttf");}\n`;
css += `@font-face{font-family:'Noto Serif SC';font-weight:600;src:url("noto-600.ttf");}\n`;
css += `@font-face{font-family:'Noto Serif SC';font-weight:900;src:url("noto-900.ttf");}\n`;
fs.writeFileSync(`${OUT}/resume-fonts.css`, css);
console.log('resume-fonts.css written');
