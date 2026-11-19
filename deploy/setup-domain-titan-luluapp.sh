#!/usr/bin/env bash
set -euo pipefail

# Cutover script for https://titan.luluapp.com (run on VPS or via ssh AFTER approval & DNS setup)
EXPECTED_IP="169.58.16.244"
NEW_DOMAIN="titan.luluapp.com"
LEGACY_DOMAIN="titan.lalo-app.com"
REMOTE_DIR="/opt/titan"

echo "1. Checking DNS A-record for ${NEW_DOMAIN}..."
RESOLVED_IP="$(dig +short A "${NEW_DOMAIN}" | tail -n 1 || true)"
if [ "${RESOLVED_IP}" != "${EXPECTED_IP}" ]; then
  echo "❌ Aborting: ${NEW_DOMAIN} resolves to '${RESOLVED_IP}', expected '${EXPECTED_IP}'."
  echo "   Add A-record ${NEW_DOMAIN} -> ${EXPECTED_IP} in Wix DNS first."
  exit 1
fi
echo "✅ DNS verified: ${NEW_DOMAIN} -> ${RESOLVED_IP}"

echo "2. Installing Nginx vhost for ${NEW_DOMAIN}..."
cp "${REMOTE_DIR}/deploy/nginx-titan.luluapp.com.conf" "/etc/nginx/sites-available/${NEW_DOMAIN}.conf"
ln -sf "/etc/nginx/sites-available/${NEW_DOMAIN}.conf" "/etc/nginx/sites-enabled/${NEW_DOMAIN}.conf"
nginx -t
systemctl reload nginx

echo "3. Issuing SSL certificate via Certbot..."
certbot --nginx -d "${NEW_DOMAIN}" --non-interactive --agree-tos --redirect

echo "4. Verifying HTTPS 200 on https://${NEW_DOMAIN}..."
STATUS_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "https://${NEW_DOMAIN}/")"
if [ "${STATUS_CODE}" != "200" ]; then
  echo "❌ Aborting 301 redirect: https://${NEW_DOMAIN}/ returned HTTP ${STATUS_CODE}"
  exit 1
fi
echo "✅ https://${NEW_DOMAIN}/ returned HTTP 200"

echo "5. Enabling soft 301 redirect from ${LEGACY_DOMAIN} -> https://${NEW_DOMAIN}..."
cp "/etc/nginx/sites-available/${LEGACY_DOMAIN}.conf" "/etc/nginx/sites-available/${LEGACY_DOMAIN}.conf.bak.$(date +%Y%m%d%H%M%S)"
cp "${REMOTE_DIR}/deploy/nginx-titan.lalo-app.com-redirect.conf" "/etc/nginx/sites-available/${LEGACY_DOMAIN}.conf"
nginx -t
systemctl reload nginx

echo "🎉 Cutover complete: https://${NEW_DOMAIN} active, ${LEGACY_DOMAIN} -> 301."
