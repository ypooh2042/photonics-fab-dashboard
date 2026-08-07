#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data
sqlite3 data/fab_dashboard.sqlite < db/schema.sql
echo "DB initialized at data/fab_dashboard.sqlite"
sqlite3 data/fab_dashboard.sqlite ".tables"
