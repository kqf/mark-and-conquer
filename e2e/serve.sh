#!/usr/bin/env sh
# Bring up the same thing the Dockerfile brings up -- the built SPA served by
# Flask on one origin, next to the API -- but from the source tree, so that a
# test run costs a `vite build` instead of a `docker build`.
#
# Playwright starts this (see playwright.config.ts) and stops it again. Run it
# by hand if you want the app up to click around in yourself.
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$HERE/.." && pwd)
PORT=${PORT:-5173}

# app.py looks for the SPA at ../../web/dist relative to itself, so a stale
# dist is a test run against yesterday's frontend. Always rebuild, unless
# something that already built it says otherwise.
if [ "${E2E_SKIP_BUILD:-}" != "1" ]; then
  npm --prefix "$ROOT/web" run build
fi

# A fresh database per run, cleared on the way up rather than on the way down
# so that a failed run leaves one behind to open. An empty board is what lets
# a spec assert that the cell it just painted was not already that color.
DB="$HERE/.tmp/pixels.db"
rm -rf "$HERE/.tmp"
mkdir -p "$HERE/.tmp"

echo "serving $ROOT on http://127.0.0.1:$PORT (db: $DB)"

# PYTHONPATH rather than an install: the package need not be on the path for
# this, and an editable install would drag setuptools_scm and the git tags in.
exec env \
  DB_PATH="$DB" \
  PYTHONPATH="$ROOT/api" \
  FLASK_APP="markandconquer.app:create_app" \
  python3 -m flask run --host 127.0.0.1 --port "$PORT"
