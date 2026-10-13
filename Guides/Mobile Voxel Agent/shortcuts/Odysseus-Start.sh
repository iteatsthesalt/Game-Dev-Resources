#!/data/data/com.termux/files/usr/bin/bash
# Termux:Widget "Start" button for Odysseus.
# Runs ~/bin/odysseus-start, keeps Termux awake, waits for the page, opens Chrome.
START="$HOME/bin/odysseus-start"
URL="http://127.0.0.1:7100/"
LOG="$HOME/odysseus-shortcut.log"

pause() { read -r -p "Press Enter to close" _; }

if [ ! -x "$START" ]; then
  echo "No $START on this phone."
  echo "Odysseus was set up elsewhere, or it has a different name."
  echo "Check:  ls ~/bin"
  pause; exit 1
fi

# Crashes here are usually the phone running out of RAM.
avail_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo 2>/dev/null)
if [ -n "$avail_mb" ] && [ "$avail_mb" -lt 900 ]; then
  echo "Only ${avail_mb} MB of RAM free. Close other apps first, then try again."
  echo "(Starting anyway in 5 seconds; press Ctrl+C to cancel.)"
  sleep 5
fi

termux-wake-lock 2>/dev/null
echo "Starting Odysseus..."
"$START" >> "$LOG" 2>&1

for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null --max-time 2 "$URL" 2>/dev/null; then
    echo "Odysseus is up. Opening $URL"
    termux-open-url "$URL" 2>/dev/null
    exit 0
  fi
  sleep 1
done
echo "Odysseus did not answer at $URL after 30 seconds."
echo "Last lines of $LOG:"
tail -n 8 "$LOG"
pause
