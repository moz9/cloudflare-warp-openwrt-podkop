#!/bin/sh
# Native BusyBox tests in private /tmp, without network or production changes.
set -eu
dir=$(mktemp -d /tmp/warp-stability-unit.XXXXXX)
trap 'rm -rf "$dir"' EXIT
export WARP_TEST_WORK="$dir/state"
export WARP_TEST_LOCK="$dir/lock"
export WARP_TEST_DATA="$2"
export WARP_COMMON_LIB="$3"
sed '/^case "${1:-}" in/,$d' "$1" > "$dir/functions"
. "$dir/functions"
valid_selection google,google_ai,chatgpt,youtube
for s in '' google, ',google' google,,youtube google,google unknown 'google;id'; do
    if valid_selection "$s"; then echo "FAIL selection $s"; exit 1; fi
done
for ip in 127.0.0.1 10.1.1.1 198.18.0.1 198.19.1.1 192.168.1.1 999.1.1.1 01.1.1.1; do
    if real_ipv4 "$ip"; then echo "FAIL address $ip"; exit 1; fi
done
real_ipv4 1.1.1.1
deadline=$(($(monotime)+100))
iface=test
resolve_host() { echo 1.1.1.1; }
curl() { printf '%s|0.125' "$MOCK_CODE"; return "$MOCK_RC"; }
: > "$WORK/samples"
MOCK_RC=0
for MOCK_CODE in 200 302 401 403 429 500; do probe google example.com https://example.com/; done
MOCK_CODE=000; MOCK_RC=28; probe google example.com https://example.com/
resolve_host() { return 1; }
probe google example.com https://example.com/
awk -F'|' -f "$DATA/score.awk" "$WORK/samples" > "$dir/result"
grep -q '^google|8|2|3|1|1|1|125|125|dns|000$' "$dir/result"
# Execute the real worker loop with a deterministic clock and network mocks.
# This tests every duration's deadline, not just argument parsing.
monotime() { n=$(cat "$dir/clock"); echo "$((n+10))" > "$dir/clock"; echo "$n"; }
sleep() { :; }
same_tunnel() { return 0; }
curl() { echo 'warp=on'; }
probe() { printf '%s|ok|20|0|204|0\n' "$1" >> "$WORK/samples"; }
exec 7>>"$LOCK"
flock -n 7
for duration in 15 30 45 60; do
    echo 10000 > "$dir/clock"
    put minutes "$duration"; put state running; put reason ''; put elapsed 0
    put started_at 1; put round 0; put selection youtube; put interface warp; put ifindex 1; put endpoint test
    put warp_checks 0; put warp_failures 0
    : > "$WORK/samples"
    (worker)
    [ "$(get state)" = complete ]
    elapsed=$(get elapsed)
    [ "$elapsed" -ge "$((duration*60))" ] && [ "$elapsed" -le "$((duration*60+40))" ]
done
put state running; touch "$WORK/stop"
(worker)
[ "$(get state)" = stopped ]
rm -f "$WORK/stop"
same_tunnel() { return 1; }
put state running
(worker)
[ "$(get state)" = changed ]
echo 'PASS: selections, public IPs, HTTP classification, percentiles, all four deadlines, stop and changed tunnel'
