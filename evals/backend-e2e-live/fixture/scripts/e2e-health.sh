#!/bin/sh
set -eu

fixture_port="${PORT:-18080}"
attempt=0
while [ "$attempt" -lt 50 ]; do
  if curl --noproxy '*' -fsS "http://127.0.0.1:$fixture_port/health" >/dev/null; then
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 0.1
done

sed -n '1,160p' .tmp/server.log 2>/dev/null || true
exit 1
