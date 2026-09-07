#!/bin/sh
# Short public entrypoint. Download completely before executing the installer.
set -eu
work=$(mktemp -d /tmp/cfwarp-bootstrap.XXXXXX)
trap 'rm -rf "$work"' EXIT
trap 'exit 1' HUP INT TERM
url=https://raw.githubusercontent.com/moz9/cloudflare-warp-openwrt-podkop/main/install-podkop.sh
if command -v curl >/dev/null 2>&1; then
    curl -fsSL --connect-timeout 10 --max-time 120 "$url" -o "$work/install.sh"
else
    wget -T 120 -qO "$work/install.sh" "$url"
fi
sh -n "$work/install.sh"
sh "$work/install.sh"
