#!/usr/bin/env bash
# ============================================================
# wanted-portfolio 一键部署(root 运行)
# 产物:nginx 托管静态站(80 口) + camp-terminal 后端(systemd,8787)
#
# 用法(服务器上):
#   git clone https://github.com/Aspire814/wanted-portfolio.git /opt/wanted-portfolio
#   DEEPSEEK_API_KEY=sk-你的key bash /opt/wanted-portfolio/deploy/setup.sh
#   # 不传 key 也能装:静态站照常上线,终端走本地降级,以后补 key 再启后端
#
# 日常更新:
#   cd /opt/wanted-portfolio && git pull && systemctl restart camp-terminal
# ============================================================
set -euo pipefail

APP_DIR=/opt/wanted-portfolio
ENV_FILE=/etc/camp-terminal.env
NGINX_CONF=/etc/nginx/conf.d/wanted-portfolio.conf

log() { echo -e "\033[1;33m[camp]\033[0m $*"; }

[ "$(id -u)" = 0 ] || { echo "请用 root 运行本脚本"; exit 1; }

# ---------- 0. 定位代码 ----------
if [ ! -f "$APP_DIR/index.html" ]; then
  SELF_DIR=$(cd "$(dirname "$0")/.." && pwd)
  if [ -f "$SELF_DIR/index.html" ]; then
    APP_DIR=$SELF_DIR
  else
    log "未找到代码,clone 到 $APP_DIR …"
    git clone https://github.com/Aspire814/wanted-portfolio.git "$APP_DIR" \
      || git clone https://ghproxy.net/https://github.com/Aspire814/wanted-portfolio.git "$APP_DIR"
  fi
fi
log "代码目录: $APP_DIR"

# ---------- 1. 安装 nginx / git / curl / node ----------
if command -v dnf >/dev/null 2>&1; then PKG=dnf
elif command -v yum >/dev/null 2>&1; then PKG=yum
else PKG=apt; fi
log "包管理器: $PKG"

if [ "$PKG" = apt ]; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx git curl
else
  $PKG install -y -q nginx git curl
fi

NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  MAJOR=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
  [ "${MAJOR:-0}" -ge 18 ] && NEED_NODE=0
fi
if [ "$NEED_NODE" = 1 ]; then
  log "安装 Node.js 20(NodeSource)…"
  if [ "$PKG" = apt ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    $PKG install -y -q nodejs
  fi
fi
log "node 版本: $(node -v)"

# ---------- 2. DeepSeek key ----------
KEY="${DEEPSEEK_API_KEY:-}"
if [ -z "$KEY" ] && [ -f "$ENV_FILE" ]; then
  log "沿用已有配置 $ENV_FILE"
else
  if [ -z "$KEY" ] && [ -t 0 ]; then
    read -r -p "输入 DeepSeek API Key(直接回车跳过,终端将走本地降级): " KEY || true
  fi
  {
    echo "DEEPSEEK_API_KEY=${KEY}"
    echo "PORT=8787"
    echo "STATIC_DIR=off"   # 静态文件交给 nginx
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  log "已写入 $ENV_FILE"
fi

# ---------- 3. systemd 后端服务 ----------
cat > /etc/systemd/system/camp-terminal.service <<UNIT
[Unit]
Description=Camp Terminal (wanted-portfolio LLM backend)
After=network.target

[Service]
ExecStart=$(command -v node) $APP_DIR/server/camp-terminal.mjs
EnvironmentFile=$ENV_FILE
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload

if grep -q '^DEEPSEEK_API_KEY=..*' "$ENV_FILE"; then
  systemctl enable --now camp-terminal
  sleep 1
  if curl -fsS http://127.0.0.1:8787/healthz >/dev/null 2>&1; then
    log "后端健康检查通过 ✓"
  else
    log "⚠ 后端未通过健康检查,查日志: journalctl -u camp-terminal -n 30"
  fi
else
  log "未配置 key,后端暂不启动。补配置后执行: systemctl enable --now camp-terminal"
fi

# ---------- 4. nginx ----------
# 避免发行版默认站点抢 80 口
[ -e /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default
[ -f /etc/nginx/conf.d/default.conf ] && mv -f /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.off

cat > "$NGINX_CONF" <<NGINX
server {
  listen 80 default_server;
  server_name _;

  root $APP_DIR;
  index index.html;

  # SSE 反代:proxy_buffering off 是流式输出的关键
  location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 90s;
    proxy_set_header X-Forwarded-For \$remote_addr;
  }

  location = /healthz { proxy_pass http://127.0.0.1:8787; }
}
NGINX

# CentOS 系 SELinux 会拦 nginx → 本机端口反代
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = "Enforcing" ]; then
  setsebool -P httpd_can_network_connect 1 || true
fi

nginx -t
systemctl enable --now nginx
systemctl reload nginx

# ---------- 5. 自检 ----------
sleep 1
STATIC=$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1/ || echo fail)
log "静态站自检: HTTP $STATIC(应为 200)"
IP=$(curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
log "部署完成!浏览器访问: http://$IP/"
log "提醒: 1) 阿里云安全组需放行 80 端口(入方向) 2) 请尽快修改 root 密码或改用密钥登录"
