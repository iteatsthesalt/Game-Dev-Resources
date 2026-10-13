#!/data/data/com.termux/files/usr/bin/bash
# Termux:Widget launcher. Starts Odysseus if ~/bin/odysseus-start exists.
# Runs only that one script; it takes no arguments and touches nothing else.
START="$HOME/bin/odysseus-start"
if [ -x "$START" ]; then
  "$START"
else
  echo "No $START on this phone."
  echo "Odysseus was set up elsewhere, or it has a different name."
  echo "Check:  ls ~/bin"
  read -r -p "Press Enter to close" _
fi
