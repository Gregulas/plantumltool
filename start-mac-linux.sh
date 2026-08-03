#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node.js 20.19+ or a current LTS version, then run this script again."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing dependencies for first run..."
  npm install
fi
echo "Starting PlantUML Local Studio..."
npm run dev
