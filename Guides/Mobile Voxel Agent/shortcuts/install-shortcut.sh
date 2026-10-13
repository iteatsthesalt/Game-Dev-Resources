#!/data/data/com.termux/files/usr/bin/bash
# Installs the Odysseus launcher and its icon for Termux:Widget.
#   bash install-shortcut.sh
# Then: long-press the home screen > Widgets > Termux:Widget, and add it.
set -eu
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$HOME/.shortcuts/icons"
install -m 700 "$HERE/Odysseus.sh" "$HOME/.shortcuts/Odysseus.sh"
install -m 600 "$HERE/ember.png" "$HOME/.shortcuts/icons/Odysseus.sh.png"
echo "Installed. Add a Termux:Widget widget to your home screen to see it."
