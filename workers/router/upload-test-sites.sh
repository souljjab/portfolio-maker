#!/usr/bin/env bash
# 테스트 사이트 2개를 R2에 업로드 (--remote: 실제 Cloudflare 버킷)
set -e
for s in alpha beta; do
  npx wrangler r2 object put "portfolio-sites/sites/$s/index.html" \
    --file "test-sites/$s/index.html" \
    --content-type "text/html; charset=utf-8" --remote
done
echo "업로드 완료: alpha, beta"
