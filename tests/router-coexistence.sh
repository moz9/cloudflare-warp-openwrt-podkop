#!/bin/sh
# Opt-in live test: interrupts WARP and reloads Podkop. Run in a maintenance window.
set -eu
umask 077
. /usr/libexec/warp-common
warp_operation_acquire
warp_podkop_acquire
work=$(mktemp -d /tmp/cfwarp-coexistence.XXXXXX)
mkdir -p "$work"
cp /etc/config/podkop "$work/podkop"
after=''
cleanup() {
    rc=$?
    trap - EXIT
    [ ! -e /etc/warp/disabled ] || /usr/libexec/warp-manager enable >/dev/null
    if [ -n "$after" ] && [ "$(sha256sum /etc/config/podkop | cut -d ' ' -f1)" = "$after" ]; then
        cp "$work/podkop" /etc/config/podkop
        PODKOP_SUBSCRIPTION_CACHE_ONLY=1 PODKOP_SKIP_LIST_UPDATE=1 /usr/bin/podkop reload > "$work/restore.log" 2>&1 || rc=1
    fi
    cmp -s "$work/podkop" /etc/config/podkop || rc=1
    warp_podkop_release
    echo "$rc" > "$work/result"
    exit "$rc"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
[ -z "$(uci changes)" ]
[ "$(uci -q get podkop.cfwarp.user_domain_list_type)" = disabled ]
mkdir "$work/uci"
uci -t "$work/uci" set podkop.cfwarp.user_domain_list_type=text
uci -t "$work/uci" set podkop.cfwarp.user_domains_text=www.cloudflare.com
uci -t "$work/uci" commit podkop
after=$(sha256sum /etc/config/podkop | cut -d ' ' -f1)
PODKOP_SUBSCRIPTION_CACHE_ONLY=1 PODKOP_SKIP_LIST_UPDATE=1 /usr/bin/podkop reload > "$work/reload.log" 2>&1
fake=$(dig +short @127.0.0.1 www.cloudflare.com A | grep -E '^198\.(18|19)\.' | head -n 1)
[ -n "$fake" ]
curl -4fsS --resolve "www.cloudflare.com:443:$fake" --connect-timeout 8 --max-time 20 https://www.cloudflare.com/cdn-cgi/trace | grep '^warp=on$'
echo PASS_Podkop_FakeIP_WARP
/usr/libexec/warp-manager disable | jsonfilter -e '@.code' | grep '^disabled$'
if curl -4fsS --resolve "www.cloudflare.com:443:$fake" --connect-timeout 4 --max-time 8 https://www.cloudflare.com/cdn-cgi/trace > "$work/disabled-trace" 2>/dev/null; then
    echo FAIL_disabled_route_leaked; exit 1
fi
echo PASS_disabled_WARP_does_not_fall_back_to_WAN
/usr/libexec/warp-manager enable | jsonfilter -e '@.code' | grep '^enabled$'
curl -4fsS --resolve "www.cloudflare.com:443:$fake" --connect-timeout 8 --max-time 20 https://www.cloudflare.com/cdn-cgi/trace | grep '^warp=on$'
curl -fsS --proxy socks5h://127.0.0.1:1080 --connect-timeout 8 --max-time 15 -o /dev/null -w 'ByeDPI_HTTPS=%{http_code}\n' https://www.youtube.com/generate_204
zerotier-cli info -j | jq -e '.online' >/dev/null
echo PASS_reenabled_WARP_Byedpi_ZeroTier
