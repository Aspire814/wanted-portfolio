#!/usr/bin/env node
/**
 * 简历 PDF 构建 — 用法:
 *   cd resume && npm i playwright qrcode && node fetch-fonts.mjs   # 首次:下载全量中文字体到 .cache/
 *   node build.mjs                                                  # 产出 LiSi-Resume-ZH.pdf / LiSi-Resume-EN.pdf
 * 依赖本机 Chromium(Playwright 自带或设置 CHROMIUM 环境变量)。
 */
import { chromium } from 'playwright';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://framex-ai.com/';
const qr = await QRCode.toDataURL(SITE_URL, { errorCorrectionLevel: 'M', margin: 0, width: 300, color: { dark: '#241A0E', light: '#00000000' } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--allow-file-access-from-files'] });

for (const [lang, out] of [['zh', 'LiSi-Resume-ZH.pdf'], ['en', 'LiSi-Resume-EN.pdf']]) {
  const html = fs.readFileSync(path.join(DIR, `resume-${lang}.html`), 'utf8')
    .replace('__SITEFONTS__', '../fonts/fonts.css')
    .replace('__RFONTS__', '.cache/resume-fonts.css')
    .replace('__QR__', qr);
  const tmp = path.join(DIR, `.built-${lang}.html`);
  fs.writeFileSync(tmp, html);
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(DIR, out), format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
  fs.unlinkSync(tmp);
  console.log('✓', out, Math.round(fs.statSync(path.join(DIR, out)).size / 1024), 'KB');
  await page.close();
}
await browser.close();
