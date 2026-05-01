#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env file. Run ./scripts/setup.sh first."
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  echo "Starting Docker Compose stack..."
  docker compose up --build
else
  echo "Docker is not installed or not available in PATH."
  exit 1
fi
