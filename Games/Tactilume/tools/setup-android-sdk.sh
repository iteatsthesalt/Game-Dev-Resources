#!/usr/bin/env bash
# Installs what the Tactilume Android app needs to build: the Android command-line tools,
# platform-tools, the newest stable Android platform and the build-tools that match it.
#
#   bash tools/setup-android-sdk.sh
#
# The SDK goes into $ANDROID_HOME (or $ANDROID_SDK_ROOT, or /opt/android-sdk). Safe to run
# again: anything already installed is kept, and sdkmanager only fetches what is missing.
# Licences are accepted for you, so read them first if that matters to you
# (they are shown by: sdkmanager --licenses).
#
# Overrides (optional): ANDROID_PLATFORM=android-37.0  ANDROID_BUILD_TOOLS=37.0.0
set -euo pipefail

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
REPO="https://dl.google.com/android/repository"
SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"

say() { printf 'setup-android-sdk: %s\n' "$*" >&2; }
die() { say "$*"; exit 1; }

for tool in curl unzip sha1sum java awk sort; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is needed but was not found."
done

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# One manifest lists every package; reading it lets the script follow Google's releases
# instead of hard-coding versions that go stale.
say "reading the package list from $REPO"
curl -fsSL --retry 3 -o "$work/repo.xml" "$REPO/repository2-3.xml" \
  || die "could not download $REPO/repository2-3.xml"

# Prints "path channel codename" for every package that is not marked obsolete.
packages() {
  awk '
    /<remotePackage/ {
      path = ""; codename = ""; channel = ""
      obsolete = ($0 ~ /obsolete="true"/)
      if (match($0, /path="[^"]+"/)) path = substr($0, RSTART + 6, RLENGTH - 7)
    }
    /<codename>/ { codename = $0; gsub(/.*<codename>|<\/codename>.*/, "", codename) }
    /<channelRef/ { if (match($0, /ref="[^"]+"/)) channel = substr($0, RSTART + 5, RLENGTH - 6) }
    /<\/remotePackage>/ { if (!obsolete && path != "") print path, channel, (codename == "" ? "-" : codename) }
  ' "$work/repo.xml"
}

# ---- command-line tools ------------------------------------------------------------------
if [ -x "$SDKMANAGER" ]; then
  # left alone: sdkmanager cannot safely replace the copy it is running from.
  # To refresh them, delete $SDK/cmdline-tools/latest and run this again.
  say "command-line tools already in $SDK"
else
  # the Linux archive of cmdline-tools;latest: its file name and SHA-1
  read -r zip sha1 < <(awk '
    /<remotePackage path="cmdline-tools;latest"/ { inside = 1 }
    inside && /<checksum/ { sum = $0; gsub(/.*<checksum[^>]*>|<\/checksum>.*/, "", sum) }
    inside && /<url>/ { url = $0; gsub(/.*<url>|<\/url>.*/, "", url) }
    inside && /<host-os>linux<\/host-os>/ { print url, sum; exit }
    inside && /<\/remotePackage>/ { inside = 0 }
  ' "$work/repo.xml") || true
  case "${zip:-}" in
    commandlinetools-linux-*_latest.zip) ;;
    *) die "could not find the Linux command-line tools in the package list" ;;
  esac
  say "downloading $zip"
  curl -fsSL --retry 3 -o "$work/$zip" "$REPO/$zip" || die "could not download $REPO/$zip"
  echo "$sha1  $work/$zip" | sha1sum -c --quiet - || die "$zip did not match its published checksum"
  unzip -q "$work/$zip" -d "$work/unzipped"
  mkdir -p "$SDK/cmdline-tools"
  rm -rf "$SDK/cmdline-tools/latest"
  # the archive holds a single cmdline-tools/ folder; sdkmanager expects it at .../latest
  mv "$work/unzipped/cmdline-tools" "$SDK/cmdline-tools/latest"
  say "command-line tools installed in $SDK/cmdline-tools/latest"
fi

# ---- choosing versions ---------------------------------------------------------------------
# Stable means the stable channel, no codename (codenames mark previews) and a plain number:
# "android-37.2" qualifies, "android-37.2-beta3", "android-CANARY" and "android-36-ext19" do not.
platform="${ANDROID_PLATFORM:-}"
if [ -z "$platform" ]; then
  platform="$(packages \
    | awk '$2 == "channel-0" && $3 == "-" && $1 ~ /^platforms;android-[0-9]+(\.[0-9]+)?$/ { sub(/^platforms;/, "", $1); print $1 }' \
    | sort -V | tail -n 1)"
fi
[ -n "$platform" ] || die "could not find a stable Android platform in the package list"
api_major="${platform#android-}"
api_major="${api_major%%.*}"

# build-tools from the same major release; release candidates carry "-rcN" and are skipped
build_tools="${ANDROID_BUILD_TOOLS:-}"
if [ -z "$build_tools" ]; then
  build_tools="$(packages \
    | awk -v major="$api_major" '$2 == "channel-0" && $1 ~ ("^build-tools;" major "\\.[0-9]+\\.[0-9]+$") { sub(/^build-tools;/, "", $1); print $1 }' \
    | sort -V | tail -n 1)"
fi
[ -n "$build_tools" ] || die "could not find stable build-tools for API $api_major"

# ---- licences and packages -------------------------------------------------------------------
say "accepting the SDK licences"
# yes stops with SIGPIPE once sdkmanager has read enough; that is expected, not a failure
{ yes || true; } | "$SDKMANAGER" --sdk_root="$SDK" --licenses >/dev/null

say "installing platform-tools, platforms;$platform, build-tools;$build_tools"
"$SDKMANAGER" --sdk_root="$SDK" --install \
  "platform-tools" "platforms;$platform" "build-tools;$build_tools"

say "installed packages:"
"$SDKMANAGER" --sdk_root="$SDK" --list_installed

cat >&2 <<EOF

setup-android-sdk: done.
  ANDROID_HOME   $SDK
  platform       $platform
  build-tools    $build_tools
Point Gradle at it with: export ANDROID_HOME="$SDK"
(or write sdk.dir=$SDK into Games/Tactilume/android/local.properties)
EOF
