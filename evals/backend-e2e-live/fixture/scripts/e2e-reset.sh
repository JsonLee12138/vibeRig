#!/bin/sh
set -eu

if [ -f .tmp/server.pid ]; then
  fixture_pid="$(sed -n '1p' .tmp/server.pid)"
  kill "$fixture_pid" 2>/dev/null || true
fi
rm -f .tmp/server.pid .tmp/state.json .tmp/invite-server
