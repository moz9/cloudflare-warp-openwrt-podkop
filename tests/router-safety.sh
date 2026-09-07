#!/bin/sh
# Run after installation with an already working WARP tunnel.
# No registration, WAN manipulation, package removal or router reboot.
set -eu
umask 077
work=$(mktemp -d /tmp/cfwarp-safety.XXXXXX)
trap 'rm -rf "$work"' EXIT
trap 'exit 1' HUP INT TERM
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; exit 1; }
start=$(date +%s)
if /usr/libexec/warp-limit 1 sleep 20; then fail timeout; fi
[ "$(($(date +%s) - start))" -le 5 ] || fail timeout_duration
pass timeout
cp /etc/warp/awg.conf "$work/invalid"
printf '\n[Interface]\nFwMark = 2097152\n' >> "$work/invalid"
if /usr/libexec/warp-awgctl setconf nonexistent "$work/invalid" 2>"$work/error"; then fail duplicate_mark; fi
grep -q 'duplicate FwMark' "$work/error" || fail duplicate_mark_validation
pass duplicate_mark_validation
sed 's/^FwMark = .*/FwMark = 4294967296/' /etc/warp/awg.conf > "$work/invalid"
if /usr/libexec/warp-awgctl setconf nonexistent "$work/invalid" 2>"$work/error"; then fail oversized_mark; fi
grep -q 'invalid FwMark' "$work/error" || fail oversized_mark_validation
pass oversized_mark_validation
cat > "$work/uci" <<'EOF'
#!/bin/sh
if [ "$1" = changes ]; then echo pending.user.change; exit 0; fi
exit 1
EOF
chmod 700 "$work/uci"
result=$(WARP_UCI_BIN="$work/uci" WARP_STATE_DIR="$work/state" /usr/libexec/warp-manager enable)
[ "$(echo "$result" | jsonfilter -e '@.code')" = pending_uci_changes ] || fail pending_changes_guard
pass pending_changes_guard
iface=$(uci -q get warp.main.actual_interface)
[ "$(/usr/libexec/warp-awgctl get "$iface" fwmark)" = 2097152 ] || fail bypass_mark
pass bypass_mark
/usr/libexec/warp-probe "$iface" || fail https_dataplane
pass https_dataplane
if /usr/libexec/warp-probe nonexistent; then fail missing_interface_probe; fi
pass missing_interface_probe
echo ALL_SAFETY_TESTS_PASSED
