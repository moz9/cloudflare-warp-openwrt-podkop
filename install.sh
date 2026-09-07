#!/bin/sh
# Compatibility entry point for the Podkop-specific opkg release.
set -eu
umask 077
installer=$(mktemp /tmp/install-cfwarp.XXXXXX)
trap 'rm -f "$installer"' EXIT
trap 'exit 1' HUP INT TERM
curl -fsSL --connect-timeout 10 --max-time 30 \
    https://raw.githubusercontent.com/moz9/cloudflare-warp-openwrt-podkop/main/install-podkop.sh \
    -o "$installer"
sh "$installer"
