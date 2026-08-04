#!/bin/sh
set -eu

mkdir -p .tmp
if [ -f .tmp/server.pid ] && kill -0 "$(sed -n '1p' .tmp/server.pid)" 2>/dev/null; then
  exit 0
fi

fixture_port="${PORT:-18080}"
go build -o .tmp/invite-server ./cmd/server
PORT="$fixture_port" DATA_PATH="${DATA_PATH:-.tmp/state.json}" .tmp/invite-server >.tmp/server.log 2>&1 &
echo "$!" >.tmp/server.pid
