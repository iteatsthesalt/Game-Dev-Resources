#!/usr/bin/env bash
# Forge installer for the Linux laptop. No apt needed.
#   curl -fsSL https://raw.githubusercontent.com/iteatsthesalt/Game-Dev-Resources/ccr-031f1132-nxzsb1/Projects/Cinder/tools/forge/install-laptop.sh | bash
set -euo pipefail
BRANCH=ccr-031f1132-nxzsb1
REPO=https://github.com/iteatsthesalt/Game-Dev-Resources
F="$HOME/.forge"; mkdir -p "$F/godot"
echo "== 1/4 Getting the project"
if [ -d "$HOME/Game-Dev-Resources/.git" ]; then
  git -C "$HOME/Game-Dev-Resources" fetch -q origin "$BRANCH" && git -C "$HOME/Game-Dev-Resources" checkout -q "$BRANCH" && git -C "$HOME/Game-Dev-Resources" pull -q origin "$BRANCH"
elif command -v git >/dev/null; then
  git clone -q -b "$BRANCH" "$REPO" "$HOME/Game-Dev-Resources"
else
  curl -fsSLo "$F/repo.zip" "$REPO/archive/refs/heads/$BRANCH.zip"
  python3 -m zipfile -e "$F/repo.zip" "$F/repo" && mv "$F/repo/"* "$HOME/Game-Dev-Resources"
fi
echo "== 2/4 Getting Godot 4.4.1"
if [ ! -x "$F/godot/godot" ]; then
  curl -fsSLo "$F/godot.zip" https://github.com/godotengine/godot/releases/download/4.4.1-stable/Godot_v4.4.1-stable_linux.x86_64.zip
  python3 -m zipfile -e "$F/godot.zip" "$F/godot"
  mv "$F/godot/Godot_v4.4.1-stable_linux.x86_64" "$F/godot/godot"; chmod +x "$F/godot/godot"; rm "$F/godot.zip"
fi
"$F/godot/godot" --headless --path "$HOME/Game-Dev-Resources/Projects/Cinder" --import >/dev/null 2>&1 || true
echo "== 3/4 Your Gemini key"
KEY=""
if [ -f "$F/config.json" ]; then KEY=$(python3 -c "import json;print(json.load(open('$F/config.json')).get('gemini_key',''))"); fi
if [ -z "$KEY" ]; then read -r -p "Paste your Gemini API key (Ctrl+Shift+V), then Enter: " KEY < /dev/tty; fi
python3 - "$KEY" <<PY
import json,sys,os
p=os.path.expanduser("~/.forge/config.json")
c=json.load(open(p)) if os.path.exists(p) else {}
c["gemini_key"]=sys.argv[1]; json.dump(c,open(p,"w"),indent=1)
PY
echo "== 4/4 Buttons and auto-start"
PY="$HOME/Game-Dev-Resources/Projects/Cinder/tools/forge/forge.py"
printf '#!/bin/sh\npkill -f "forge.py serve" 2>/dev/null; nohup python3 "%s" serve >"%s/forge.log" 2>&1 &\n' "$PY" "$F" > "$F/start.sh"
printf '#!/bin/sh\npkill -f "forge.py serve"\n' > "$F/stop.sh"; chmod +x "$F/start.sh" "$F/stop.sh"
mkdir -p "$HOME/.config/autostart" "$HOME/Desktop"
for n in Start Stop; do
  l=$(echo $n | tr A-Z a-z)
  printf '[Desktop Entry]\nType=Application\nName=Forge %s\nExec=%s/%s.sh\nTerminal=false\n' "$n" "$F" "$l" > "$HOME/Desktop/forge-$l.desktop"
  chmod +x "$HOME/Desktop/forge-$l.desktop"
done
cp "$HOME/Desktop/forge-start.desktop" "$HOME/.config/autostart/"
"$F/start.sh"
echo
echo "DONE. In Odysseus (http://127.0.0.1:7000) settings, add an endpoint:"
echo "   URL:  http://127.0.0.1:8741/v1     API key: forge     model: forge"
echo "Then chat with model 'forge' and type:  heroes   then   play knight"
