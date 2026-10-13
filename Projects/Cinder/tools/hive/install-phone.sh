#!/data/data/com.termux/files/usr/bin/bash
# Hive - WORKER cell setup for a phone (Termux). Put the old PC's address and pairing code at the end:
#   curl -fsSL https://raw.githubusercontent.com/iteatsthesalt/Game-Dev-Resources/ccr-031f1132-nxzsb1/Projects/Cinder/tools/hive/install-phone.sh | bash -s -- 192.168.1.50 ABC123
# Installs a local AI sized for this phone and the buttons Hive Start / Hive Stop / Hive Page.
set -e
HUB="${1:-}"
CODE="${2:-}"
if [ -z "$HUB" ]; then read -r -p "Old PC address (shown when you set it up, like 192.168.1.50): " HUB < /dev/tty; fi
if [ -z "$CODE" ]; then read -r -p "Pairing code (shown on the old PC): " CODE < /dev/tty; fi
HIVE="$HOME/.hive"
TOOL_URL="https://raw.githubusercontent.com/iteatsthesalt/Game-Dev-Resources/ccr-031f1132-nxzsb1/Projects/Cinder/tools/hive/hive.py"
step() { printf '\n\033[1;33m== %s ==\033[0m\n' "$1"; }

step "1/4 Apps"
pkg update -y
pkg install -y python ollama termux-api

step "2/4 The hive program"
mkdir -p "$HIVE"
curl -fsSL -o "$HIVE/hive.py" "$TOOL_URL"

step "3/4 Local AI sized for this phone"
RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$RAM_MB" -lt 6000 ]; then MODEL="qwen2.5-coder:1.5b"; REST=600; else MODEL="qwen2.5-coder:3b"; REST=1200; fi
echo "This phone has ${RAM_MB} MB memory -> using $MODEL"
export OLLAMA_MAX_LOADED_MODELS=1
(ollama serve >"$HIVE/ai.log" 2>&1 &)
sleep 4
ollama pull "$MODEL"
NAME="phone-$(getprop ro.product.model 2>/dev/null | tr ' ' '-' | tr -cd '[:alnum:]-' | head -c 20)"
cat > "$HIVE/config.json" <<EOF
{"name": "${NAME:-phone}", "hub_url": "http://$HUB:8790", "model": "$MODEL", "min_free_mb": $REST, "code": "$CODE"}
EOF

step "4/4 Buttons"
BIN="${PREFIX:-/usr}/bin"
cat > "$BIN/hive-start" <<EOF
#!$BIN/bash
termux-wake-lock 2>/dev/null
pkill -f "ollama serve" 2>/dev/null; pkill -f "hive.py cell" 2>/dev/null
OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_KEEP_ALIVE=60s nohup ollama serve > "$HIVE/ai.log" 2>&1 &
sleep 3
nohup python "$HIVE/hive.py" cell > "$HIVE/cell.log" 2>&1 &
echo "This phone joined the hive. Watch it at http://$HUB:8790"
EOF
cat > "$BIN/hive-stop" <<EOF
#!$BIN/bash
pkill -f "hive.py cell"; pkill -f "ollama serve"; termux-wake-unlock 2>/dev/null
echo "This phone left the hive. Memory is free again."
EOF
cat > "$BIN/hive-page" <<EOF
#!$BIN/bash
termux-open-url "http://$HUB:8790"
EOF
chmod +x "$BIN/hive-start" "$BIN/hive-stop" "$BIN/hive-page"
mkdir -p "$HOME/.shortcuts"
for b in start stop page; do
	printf '#!%s/bash\nhive-%s\nsleep 2\n' "$BIN" "$b" > "$HOME/.shortcuts/Hive ${b^}"
	chmod +x "$HOME/.shortcuts/Hive ${b^}"
done
pkill -f "ollama serve" || true

printf '\n\033[1;32mDone!\033[0m Tap the "Hive Start" button (Termux:Widget), or type: hive-start\n'
echo "Stop: hive-stop   Page: hive-page"
