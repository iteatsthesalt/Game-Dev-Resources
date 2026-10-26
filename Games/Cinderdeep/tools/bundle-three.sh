#!/bin/sh
# Rebuilds src/vendor/three.min.js from the three.js commit pinned in the
# CinderDeep catalog (iteatsthesalt/CinderDeep, upstream/mrdoob/three.js).
#   tools/bundle-three.sh /path/to/three.js-checkout
# Needs Node; fetches esbuild with npx. Add classes to tools/three-entry.js first.
set -e
THREE_DIR=${1:?path to a three.js checkout}
cd "$(dirname "$0")/.."
REV=$(git -C "$THREE_DIR" rev-parse HEAD)
TMP=$(mktemp -d)
sed "s#'three'#'$(cd "$THREE_DIR" && pwd)/build/three.module.js'#" tools/three-entry.js > "$TMP/entry.js"
npx --yes esbuild@0.25.11 "$TMP/entry.js" --bundle --minify --format=iife --global-name=THREE --legal-comments=none --target=es2020 --outfile="$TMP/three.min.js"
{
  printf '/*! three.js %s (mrdoob/three.js commit %s, as pinned in iteatsthesalt/CinderDeep)\n' "$(node -e "console.log(require('$THREE_DIR/package.json').version)")" "$REV"
  printf ' * https://threejs.org · MIT License · Copyright © 2010-2026 three.js authors\n * Only the classes the 3D view uses; rebuild with tools/bundle-three.sh. */\n'
  cat "$TMP/three.min.js"
} > src/vendor/three.min.js
cp "$THREE_DIR/LICENSE" src/vendor/three.LICENSE
rm -rf "$TMP"
echo "src/vendor/three.min.js rebuilt from $REV"
