#!/bin/sh
# Failure/ownership regression tests; mock nft only, no live routing changes.
set -eu
work=$(mktemp -d /tmp/warp-scout-route-test.XXXXXX)
trap 'rm -rf "$work"' EXIT
export TEST_SCOUT_WORK=$work
export WARP_NFT_BIN=$work/nft
cat > "$WARP_NFT_BIN" <<'MOCK'
#!/bin/sh
case "$1" in
list) [ -e "$TEST_SCOUT_WORK/table" ] ;;
-f)
    cat > "$TEST_SCOUT_WORK/batch"
    [ ! -e "$TEST_SCOUT_WORK/create-fail" ] || exit 1
    touch "$TEST_SCOUT_WORK/table"
    ;;
delete)
    [ ! -e "$TEST_SCOUT_WORK/delete-fail" ] || exit 1
    rm "$TEST_SCOUT_WORK/table"
    ;;
*) exit 2 ;;
esac
MOCK
chmod 755 "$WARP_NFT_BIN"
. "${1:-/usr/libexec/warp-common}"
warp_scout_route_release
touch "$work/table"
! warp_scout_route_acquire
[ -z "$WARP_SCOUT_TABLE" ]
warp_scout_route_release
[ -e "$work/table" ] # never delete a table we did not create
rm "$work/table"
touch "$work/create-fail"
! warp_scout_route_acquire
[ -z "$WARP_SCOUT_TABLE" ]
rm "$work/create-fail"
warp_scout_route_acquire
owner=$WARP_SCOUT_TABLE
warp_scout_route_acquire
[ "$WARP_SCOUT_TABLE" = "$owner" ]
touch "$work/delete-fail"
! warp_scout_route_release
[ "$WARP_SCOUT_TABLE" = "$owner" ] # retain ownership for cleanup retry
rm "$work/delete-fail"
warp_scout_route_release
[ -z "$WARP_SCOUT_TABLE" ] && [ ! -e "$work/table" ]
echo 'PASS: scout route ownership, idempotence and failure cleanup'
