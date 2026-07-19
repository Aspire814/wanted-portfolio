# WANTED — 李斯 · Full-Stack Gunslinger

一个把简历做成**西部通缉令**的个人营销网站 —— 荒野大镖客式的做旧美学 × Claude Code 风格交互终端。纯静态,零依赖,零构建。

## ✦ 特色

- **通缉令主视觉**:做旧羊皮纸、双线花饰边框、火漆印章、悬赏 `$300%` 效率
- **原创手绘海报**:全部为原创 SVG 插画(牛仔肖像 / 西部落日铁路 / 决斗传单),不含任何第三方版权素材
- **可拖拽贴画墙**:药水广告、铁路告示、入伙券、马戏团海报、手写备忘条,均可按住拖动
- **可玩交互**:
  - 🔫 点击空白处开枪(弹孔 + 屏幕震动)
  - ◉ 死眼模式(按 `E`)—— 画面褪色,关键数据被逐个标记
  - ⚡ `/duel` 拔枪决斗小游戏,测反应毫秒数
- **Claude Code 风格终端**:`✳ Welcome` 欢迎框、`/` 命令体系、Tab 补全、↑↓ 历史,支持自然语言问答

## ✦ 技术

纯手写 `HTML + CSS + JavaScript`,无框架、无打包工具。字体来自 Google Fonts(Rye / IBM Plex Mono / Noto Serif SC / Long Cang)。

```
index.html   结构与内容
style.css    全部样式与动效
main.js      交互逻辑(终端 / 死眼 / 开枪 / 拖拽 / 决斗)
```

## ✦ 本地预览

任意静态服务器即可:

```bash
python3 -m http.server 8899
# 打开 http://localhost:8899
```

## ✦ 联系

aspirelisi@gmail.com

---
*Built with craft × Claude Code*
