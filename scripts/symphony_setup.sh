#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYMPHONY_DIR="${ROOT_DIR}/vendor/symphony"
ELIXIR_DIR="${SYMPHONY_DIR}/elixir"

if [[ ! -d "${SYMPHONY_DIR}/.git" && ! -f "${SYMPHONY_DIR}/.git" ]]; then
  echo "Symphony submodule is not initialized at ${SYMPHONY_DIR}."
  echo "Run: git submodule update --init --recursive vendor/symphony"
  exit 1
fi

if [[ ! -d "${ELIXIR_DIR}" ]]; then
  echo "Expected Symphony Elixir reference implementation at ${ELIXIR_DIR}."
  exit 1
fi

cd "${ELIXIR_DIR}"
mise trust
mise install
mise exec -- mix setup
mise exec -- mix build
