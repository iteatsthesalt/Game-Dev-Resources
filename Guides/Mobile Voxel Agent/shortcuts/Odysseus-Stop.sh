#!/data/data/com.termux/files/usr/bin/bash
# Termux:Widget "End" button for Odysseus. Frees its memory.
# Uses ~/bin/odysseus-stop if you have one; otherwise stops only processes whose
# command line mentions "odysseus", and prints exactly what it stopped.
STOP="$HOME/bin/odysseus-stop"

if [ -x "$STOP" ]; then
  "$STOP"
else
  me=$$
  pids=""
  for pid in $(pgrep -f -i odysseus); do
    [ "$pid" = "$me" ] || [ "$pid" = "$PPID" ] && continue
    [ -r "/proc/$pid/cmdline" ] && pids="$pids $pid"
  done
  if [ -z "$pids" ]; then
    echo "Odysseus is not running."
  else
    echo "Stopping:"
    for pid in $pids; do
      echo "  $pid  $(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null | cut -c1-80)"
      kill "$pid" 2>/dev/null
    done
    sleep 2
    for pid in $pids; do kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null; done
    echo "Done."
  fi
fi
termux-wake-unlock 2>/dev/null
sleep 2
