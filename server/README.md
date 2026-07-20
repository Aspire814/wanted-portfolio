# 营地终端后端 — 部署指南

把终端从"正则脚本"升级为真 LLM(DeepSeek):`camp-terminal.mjs` 是一个零依赖的 Node 中转服务,负责藏 API key、限流、每日熔断、SSE 流式转发,并可顺便托管整个静态站。

```
浏览器终端 ──► camp-terminal.mjs(:8787)──► DeepSeek API
    ▲               │
    └── 后端不可达/预算烧完时,前端自动降级回本地脚本回答
```

## 一、本地跑起来(1 分钟)

需要 Node 18+:

```bash
DEEPSEEK_API_KEY=sk-你的key node server/camp-terminal.mjs
# 打开 http://127.0.0.1:8787 — 静态站 + API 同源,直接能聊
```

## 二、服务器部署(推荐姿势:同机同域)

站点和 API 放同一台服务器同一个域名下,同源调用,无 CORS,国内访问快。

### 1. 传代码 + 配 systemd

```bash
# 服务器上
git clone <本仓库> /opt/wanted-portfolio
```

`/etc/systemd/system/camp-terminal.service`:

```ini
[Unit]
Description=Camp Terminal (wanted-portfolio LLM backend)
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/wanted-portfolio/server/camp-terminal.mjs
Environment=DEEPSEEK_API_KEY=sk-你的key
Environment=PORT=8787
Restart=always
RestartSec=3
# 不需要 node 托管静态文件时(nginx 直接 serve):
# Environment=STATIC_DIR=off

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now camp-terminal
curl http://127.0.0.1:8787/healthz   # {"ok":true,...} 即成功
```

### 2. nginx 反代

```nginx
server {
  listen 443 ssl;
  server_name 你的域名.com;
  # ssl_certificate ...(certbot 或宝塔面板签发)

  # 静态站:nginx 直接出
  root /opt/wanted-portfolio;
  index index.html;

  # API:反代给 node,SSE 必须关缓冲
  location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 90s;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
```

前端 `main.js` 里 `CAMP_API = ''`(默认值)即为同源调用,不用改任何东西。

### 3. 站点托管在别处时(如 GitHub Pages)

- `main.js` 顶部把 `CAMP_API` 改成后端地址,如 `'https://api.你的域名.com'`
- 后端设 `ALLOW_ORIGIN=https://你的pages域名`,别用默认的 `*`

## 三、防滥用(默认值都已内置)

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `RATE_PER_MIN` | 6 | 每 IP 每分钟请求数 |
| `RATE_PER_DAY` | 40 | 每 IP 每天请求数 |
| `GLOBAL_REQ_PER_DAY` | 800 | 全站每日请求熔断 |
| `GLOBAL_TOKENS_PER_DAY` | 2000000 | 全站每日 token 熔断 |
| `MODEL` | deepseek-chat | 上游模型 |
| `ALLOW_ORIGIN` | * | CORS 允许的 origin |
| `TRUST_PROXY` | 1 | 从 X-Forwarded-For 取真实 IP(nginx 后面保持默认;裸跑公网设 0) |

按 deepseek-chat 牌价(¥2/M 输入 · ¥8/M 输出),单次问答约 2K 输入 + 300 输出 token,**跑满全站每日熔断也就几块钱**,可以放心睡觉。触发限流/熔断时前端会收到 429/503:限流给访客一句西部腔提示,熔断则静默降级回本地脚本回答,页面永远不会"坏"。

其余安全设计:

- 模型输出在前端**先转义再渲染**,只翻译白名单标记(`[gold]` 等),不存在 XSS 注入面
- 输入截断 600 字、历史只带 8 条、`max_tokens=500`,单次成本有硬上限
- system prompt 内置人设锁与话题边界,不代表本人承诺薪资等事项

## 四、AI 副手能操作页面

模型输出里可携带动作标记,前端会真的执行:`[action:goto:s2]` 滚动并高亮对应区块、`[action:deadeye]` 死眼模式、`[action:duel]` 拔枪决斗、`[action:shoot]` 朝页面开枪。试试对终端说:**"带我看看他在 Webull 干了什么"** 或 **"来点刺激的"**。
