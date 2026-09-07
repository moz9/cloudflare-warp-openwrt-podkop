#!/bin/sh
# Isolated locks only; safe on the router and in Linux CI.
set -eu
work=$(mktemp -d /tmp/warp-lock-test.XXXXXX)
trap 'rm -rf "$work"' EXIT
mkdir "$work/real"
ln -s "$work/real" "$work/alias"
export WARP_OPERATION_LOCK="$work/alias/operation"
export WARP_PODKOP_LOCK="$work/podkop.d"
export WARP_PODKOP_LEGACY="$work/podkop"
export WARP_COMMON_LIB="${1:-/usr/libexec/warp-common}"
. "$WARP_COMMON_LIB"
! warp_operation_busy
warp_operation_acquire
warp_operation_busy
# An inherited lock can be reacquired, a new file description cannot.
sh -c '. "$WARP_COMMON_LIB"; warp_operation_acquire'
sh -c 'exec 9>&-; . "$WARP_COMMON_LIB"; ! warp_operation_acquire'
exec 9>&-
! warp_operation_busy
# Abrupt owner termination releases the kernel lock (no stale PID cleanup).
sh -c '. "$WARP_COMMON_LIB"; warp_operation_acquire; echo ready > "$WARP_OPERATION_LOCK.ready"; exec sleep 20' &
owner=$!
n=0
while [ ! -f "$WARP_OPERATION_LOCK.ready" ]; do
    n=$((n+1)); [ "$n" -lt 5 ]; sleep 1
done
warp_operation_busy
kill -KILL "$owner"
wait "$owner" 2>/dev/null || true
! warp_operation_busy
warp_podkop_acquire
sh -c '. "$WARP_COMMON_LIB"; ! warp_podkop_acquire; warp_podkop_release'
[ -f "$WARP_PODKOP_LOCK/owner" ] && [ -f "$WARP_PODKOP_LEGACY" ]
warp_podkop_release
[ ! -e "$WARP_PODKOP_LOCK" ] && [ ! -e "$WARP_PODKOP_LEGACY" ]
mkdir "$WARP_PODKOP_LOCK"
! warp_podkop_acquire
rmdir "$WARP_PODKOP_LOCK"
echo 'foreign dns operation' > "$WARP_PODKOP_LEGACY"
! warp_podkop_acquire
warp_podkop_release
[ -f "$WARP_PODKOP_LEGACY" ]
echo 'PASS: admission, inheritance, contention, owner death, shared Podkop ownership'
