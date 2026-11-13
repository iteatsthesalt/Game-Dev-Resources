#!/data/data/com.termux/files/usr/bin/bash
# Installs the Odysseus Start and End shortcuts and their icons for Termux:Widget.
#   bash install-shortcut.sh
# Then: long-press the home screen > Widgets > Termux:Widget, and add it.
set -eu
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$HOME/.shortcuts/icons"
rm -f "$HOME/.shortcuts/Odysseus.sh" "$HOME/.shortcuts/icons/Odysseus.sh.png"
install -m 700 "$HERE/Odysseus-Start.sh" "$HERE/Odysseus-Stop.sh" "$HOME/.shortcuts/"
install -m 600 "$HERE/ember.png" "$HOME/.shortcuts/icons/Odysseus-Start.sh.png"
install -m 600 "$HERE/ember-off.png" "$HOME/.shortcuts/icons/Odysseus-Stop.sh.png"
echo "Installed Start and End. Add a Termux:Widget widget to your home screen."
