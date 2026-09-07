#!/bin/sh
# OpenWrt integration harness: real dispatcher and locks, entirely fake config/controller.
set -eu
t=$(mktemp -d /tmp/warp-apply-unit.XXXXXX)
trap 'rm -rf "$t"' EXIT
mkdir -p "$t/bin" "$t/etc/warp" "$t/etc/config" "$t/work"
export AUTOTUNE_TEST_ROOT="$t" WARP_TEST_LOCK="$t/lock" WARP_OPERATION_LOCK="$t/operation"
touch "$t/lock" "$t/operation"
export PATH="$t/bin:$PATH"
cat > "$t/bin/uci" <<'EOF'
#!/bin/sh
echo warp
EOF
cat > "$t/bin/awgctl" <<'EOF'
#!/bin/sh
cp "$3" "$AUTOTUNE_TEST_ROOT/device.conf"
EOF
cat > "$t/bin/probe" <<'EOF'
#!/bin/sh
if [ -e "$AUTOTUNE_TEST_ROOT/slow-probe" ]; then
    echo $$ > "$AUTOTUNE_TEST_ROOT/probe-pid"
    sleep 40 7>&- 9>&-
fi
test ! -e "$AUTOTUNE_TEST_ROOT/fail-probe"
EOF
chmod 700 "$t/bin/uci" "$t/bin/awgctl" "$t/bin/probe"
sed "s#/etc/warp#$t/etc/warp#g;s#/etc/config/warp#$t/etc/config/warp#g;s#WARP_TEST_WORK=/tmp/warp-autotune#WARP_TEST_WORK=$t/work#g;s#/usr/libexec/warp-awgctl#$t/bin/awgctl#g;s#/usr/libexec/warp-probe#$t/bin/probe#g" \
    "${1:-/usr/libexec/warp-autotune}" > "$t/runner"
cat > "$t/work/baseline.conf" <<'EOF'
[Interface]
Jc = 6
[Peer]
Endpoint = 162.159.192.55:2408
EOF
printf 'complete\n' > "$t/work/state"
printf 'warp\n' > "$t/work/interface"
printf '2|162.159.192.55:500|12\n' > "$t/work/candidates"
printf '2|162.159.192.55:500|12|12|12|0|0|100|1000000|3|0|3\n' > "$t/work/ranked"
echo config > "$t/etc/config/warp"
reset_config() {
    cp "$t/work/baseline.conf" "$t/etc/warp/awg.conf"
    sha256sum "$t/etc/warp/awg.conf" "$t/etc/config/warp" | sha256sum | cut -d' ' -f1 > "$t/work/baseline_hash"
}
reset_config
result=$(sh "$t/runner" apply 2)
[ "$(jsonfilter -s "$result" -e '@.code')" = applied ]
grep -q '^Endpoint = 162.159.192.55:500$' "$t/device.conf"
cmp "$t/device.conf" "$t/etc/warp/awg.conf"
reset_config
touch "$t/fail-probe"
result=$(sh "$t/runner" apply 2)
[ "$(jsonfilter -s "$result" -e '@.code')" = candidate_failed_rolled_back ]
cmp "$t/device.conf" "$t/work/baseline.conf"
cmp "$t/etc/warp/awg.conf" "$t/work/baseline.conf"
echo changed >> "$t/etc/config/warp"
result=$(sh "$t/runner" apply 2)
[ "$(jsonfilter -s "$result" -e '@.code')" = configuration_changed ]
reset_config
rm -f "$t/fail-probe"
touch "$t/slow-probe"
sh "$t/runner" apply 2 > "$t/killed-result" &
apply_pid=$!
n=0
while [ ! -s "$t/probe-pid" ] && [ "$n" -lt 5 ]; do sleep 1; n=$((n+1)); done
[ -s "$t/probe-pid" ]
kill -KILL "$apply_pid"
wait "$apply_pid" 2>/dev/null || true
sleep 21
cmp "$t/device.conf" "$t/work/baseline.conf"
cmp "$t/etc/warp/awg.conf" "$t/work/baseline.conf"
kill "$(cat "$t/probe-pid")" 2>/dev/null || true
echo PASS_autotune_apply_success_rollback_stale_config
echo PASS_autotune_SIGKILL_guardian_rollback
