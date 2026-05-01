#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  else
    cat > .env <<'EOF'
VITE_API_URL="http://localhost:8000"
VITE_API_KEY=""
VITE_SUPABASE_URL="https://kqujzokakpnbzztwwvte.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-supabase-publishable-key>"
EOF
    echo "Created new .env file"
  fi
else
  echo ".env already exists"
fi

echo "Ensure you have Docker installed and running."
echo "Then run ./scripts/dev.sh to start the stack."
