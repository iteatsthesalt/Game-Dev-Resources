#!/usr/bin/env bash
# Rebuilds every voxel asset and renders a preview picture of each one into
# previews/. Used by the GitHub workflow after every phone "push", and can be
# run on any Linux PC with Godot 4.4 and xvfb:  GODOT=/path/to/godot tools/render_previews.sh
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
mkdir -p previews

"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
"$GODOT" --headless --path . --script res://tools/bake.gd -- --force
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true

shot() { # name, extra args...
	local name="$1"; shift
	xvfb-run -a -s "-screen 0 1280x960x24" "$GODOT" --path . --rendering-method gl_compatibility \
		--resolution 640x640 -- "$@" --shot="$PWD/previews/$name.png" >/dev/null 2>&1 || echo "render failed: $name"
}

for vox in assets/vox/*.vox; do
	asset="$(basename "$vox" .vox)"
	shot "$asset" --asset="$asset" --yaw=-30 --pitch=-12
	echo "preview $asset"
done
shot "_lineup" --yaw=-20 --pitch=-18 --zoom=1.15
echo "preview _lineup"
