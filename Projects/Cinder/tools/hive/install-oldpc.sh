#!/usr/bin/env bash
# Hive - ROOT cell setup for the old PC (Linux Mint / Ubuntu). Paste in a terminal:
#   curl -fsSL https://raw.githubusercontent.com/iteatsthesalt/Game-Dev-Resources/ccr-031f1132-nxzsb1/Projects/Cinder/tools/hive/install-oldpc.sh | bash
# Installs: the hub + page, Godot (for checking code), a local AI, and the
# commands  hive-start  hive-stop  hive-page.
set -e
BRANCH="ccr-031f1132-nxzsb1"
REPO="https://github.com/iteatsthesalt/Game-Dev-Resources.git"
DIR="$HOME/Game-Dev-Resources"
HIVE="$HOME/.hive"
GODOT_URL="https://github.com/godotengine/godot/releases/download/4.4.1-stable/Godot_v4.4.1-stable_linux.x86_64.zip"
step() { printf '\n\033[1;33m== %s ==\033[0m\n' "$1"; }

step "1/6 Apps (you may be asked for your password)"
sudo apt-get update -y
sudo apt-get install -y git python3 curl unzip gh

step "2/6 The game project"
if [ -d "$DIR/.git" ]; then git -C "$DIR" fetch -q origin "$BRANCH"; git -C "$DIR" checkout -q "$BRANCH"; git -C "$DIR" pull -q --rebase origin "$BRANCH"
else git clone -q --branch "$BRANCH" "$REPO" "$DIR"; fi

step "3/6 GitHub sign-in (so finished features are saved online)"
gh auth status >/dev/null 2>&1 || gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git

step "4/6 Godot (checks every new feature before it is saved)"
mkdir -p "$HIVE"
if [ ! -x "$HIVE/godot" ]; then
	curl -fsSL -o "$HIVE/godot.zip" "$GODOT_URL"
	unzip -o -q "$HIVE/godot.zip" -d "$HIVE"
	mv "$HIVE"/Godot_v4.4.1-stable_linux.x86_64 "$HIVE/godot"
	rm "$HIVE/godot.zip"
fi

step "5/6 Local AI (runs on the CPU; about 2 GB download)"
command -v ollama >/dev/null || curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5-coder:3b

step "6/6 Settings and commands"
CODE=$(python3 -c "import json;print(json.load(open('$HIVE/config.json')).get('code',''))" 2>/dev/null || true)
[ -n "$CODE" ] || CODE=$(tr -dc 'A-HJ-NP-Z2-9' </dev/urandom | head -c 6)
cat > "$HIVE/config.json" <<EOF
{"name": "old-pc", "repo_dir": "$DIR", "godot": "$HIVE/godot", "model": "qwen2.5-coder:3b",
 "port": 8790, "min_free_mb": 1200, "code": "$CODE"}
EOF
TOOL="$DIR/Projects/Cinder/tools/hive/hive.py"
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/hive-start" <<EOF
#!/usr/bin/env bash
pkill -f "hive.py hub" 2>/dev/null; pkill -f "hive.py cell" 2>/dev/null
nohup python3 "$TOOL" hub  > "$HIVE/hub.log"  2>&1 &
sleep 3
nohup python3 "$TOOL" cell > "$HIVE/cell.log" 2>&1 &
echo "Hive is on. On your phones open:  http://\$(hostname -I | awk '{print \$1}'):8790   (pairing code: $CODE)"
EOF
cat > "$HOME/.local/bin/hive-stop" <<'EOF'
#!/usr/bin/env bash
pkill -f "hive.py hub"; pkill -f "hive.py cell"; echo "Hive is off."
EOF
cat > "$HOME/.local/bin/hive-page" <<'EOF'
#!/usr/bin/env bash
xdg-open "http://127.0.0.1:8790" >/dev/null 2>&1 &
EOF
chmod +x "$HOME/.local/bin/hive-start" "$HOME/.local/bin/hive-stop" "$HOME/.local/bin/hive-page"
for app in start stop; do
	mkdir -p "$HOME/Desktop"
	cat > "$HOME/Desktop/Hive-$app.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Hive ${app^}
Exec=$HOME/.local/bin/hive-$app
Terminal=true
EOF
	chmod +x "$HOME/Desktop/Hive-$app.desktop"
done

"$HOME/.local/bin/hive-start"
IP=$(hostname -I | awk '{print $1}')
printf '\n\033[1;32mThe old PC is the hive root.\033[0m\n'
echo "Hub address for your phones:  $IP"
echo "Pairing code:                 $CODE"
echo "Page:  http://$IP:8790"
echo "Desktop buttons: Hive Start / Hive Stop. Commands: hive-start, hive-stop, hive-page."
