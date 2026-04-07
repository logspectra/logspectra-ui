#!/bin/sh
set -eu

RUNTIME_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8080}"

cat > /app/public/env-config.js <<EOF
window.__LOGSPECTRA_ENV = {
  NEXT_PUBLIC_API_BASE_URL: "${RUNTIME_API_BASE_URL}"
};
EOF

exec "$@"
