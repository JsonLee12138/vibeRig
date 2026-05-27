#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="${1:-$(pwd)}"
WORKFLOW="${PROJECT_ROOT}/WORKFLOW.planning.md"
START_PORT="${VIBERIG_PLANNING_PORT:-49170}"
PORT="$(python3 "${ROOT_DIR}/scripts/find_free_port.py" "${START_PORT}")"
SYMPHONY_BIN="${ROOT_DIR}/vendor/symphony/elixir/bin/symphony"

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "LINEAR_API_KEY is required."
  exit 1
fi

if [[ ! -x "${SYMPHONY_BIN}" ]]; then
  echo "Symphony binary not found at ${SYMPHONY_BIN}."
  echo "Run: ${ROOT_DIR}/scripts/symphony_setup.sh"
  exit 1
fi

if [[ ! -f "${WORKFLOW}" ]]; then
  echo "Planning workflow not found at ${WORKFLOW}."
  exit 1
fi

mkdir -p "${PROJECT_ROOT}/.vibeRig"
python3 "${ROOT_DIR}/scripts/record_runtime_port.py" "${PROJECT_ROOT}" planning_port "${PORT}"
cd "${ROOT_DIR}/vendor/symphony/elixir"
exec mise exec -- ./bin/symphony \
  --i-understand-that-this-will-be-running-without-the-usual-guardrails \
  --port "${PORT}" \
  "${WORKFLOW}"
