#!/usr/bin/env bash
# ============================================================
# 域名 + HTTPS 一键配置(root 运行,须在 deploy/setup.sh 部署完成后)
#
# 用法:
#   bash /opt/wanted-portfolio/deploy/domain.sh 你的域名.com
#   bash /opt/wanted-portfolio/deploy/domain.sh 你的域名.com you@mail.com  # 指定证书通知邮箱
#
# 前提:
#   1. 域名已备案(否则阿里云会拦截 80/443 的域名访问)
#   2. DNS 已添加 A 记录:@ 与 www → 本机公网 IP
#   3. 阿里云安全组已放行 443 端口(入方向)
# ============================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-aspirelisi@gmail.com}"
NGINX_CONF=/etc/nginx/conf.d/wanted-portfolio.conf
APP_DIR=/opt/wanted-portfolio

log() { echo -e "\033[1;33m[camp]\033[0m $*"; }

[ "$(id -u)" = 0 ] || { echo "请用 root 运行"; exit 1; }
[ -n "$DOMAIN" ] || { echo "用法: bash deploy/domain.sh 你的域名.com [邮箱]"; exit 1; }
[ -f "$NGINX_CONF" ] || { echo "未找到 $NGINX_CONF — 请先运行 deploy/setup.sh"; exit 1; }

# ---------- 0. 更新代码(带上备案号页脚等) ----------
if [ -d "$APP_DIR/.git" ]; then
  log "git pull 更新代码…"
  git -C "$APP_DIR" pull --ff-only || log "⚠ git pull 失败,继续用现有代码"
fi

# ---------- 1. nginx 绑定域名 ----------
sed -i -E "s/^([[:space:]]*)server_name .*/\1server_name $DOMAIN www.$DOMAIN;/" "$NGINX_CONF"
nginx -t
systemctl reload nginx
log "nginx server_name → $DOMAIN www.$DOMAIN"

# ---------- 2. 安装 certbot ----------
if ! command -v certbot >/dev/null 2>&1; then
  log "安装 certbot…"
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y certbot python3-certbot-nginx \
      || { dnf install -y epel-release && dnf install -y certbot python3-certbot-nginx; }
  elif command -v yum >/dev/null 2>&1; then
    yum install -y certbot python3-certbot-nginx \
      || { yum install -y epel-release && yum install -y certbot python3-certbot-nginx; }
  else
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx
  fi
fi

# ---------- 3. 签发证书 + 自动 HTTP→HTTPS ----------
log "向 Let's Encrypt 申请证书(需要 DNS 已生效)…"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
  -m "$EMAIL" --agree-tos --no-eff-email --redirect --non-interactive
systemctl reload nginx

# certbot 装好后自带自动续期(systemd timer),确认一下
systemctl list-timers 2>/dev/null | grep -q certbot && log "证书自动续期已就绪 ✓" || true

# ---------- 4. 自检 ----------
sleep 1
CODE=$(curl -fsS -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || echo fail)
log "https://$DOMAIN/ 自检: HTTP $CODE(应为 200)"
CODE_API=$(curl -fsS -o /dev/null -w '%{http_code}' "https://$DOMAIN/healthz" || echo fail)
log "后端 /healthz 自检: HTTP $CODE_API(应为 200;若未配 key 则忽略)"
log "完成!正式入口: https://$DOMAIN/"
log "若自检失败排查顺序: DNS 解析(ping $DOMAIN) → 安全组 443 → 备案拦截(浏览器访问看提示页)"
