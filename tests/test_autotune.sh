#!/bin/sh
# Run on OpenWrt; source only function declarations, use an isolated work directory.
set -eu
WARP_AUTOTUNE_LIBRARY=1
. "${1:-/usr/libexec/warp-autotune}"
WORK=$(mktemp -d /tmp/warp-autotune-unit.XXXXXX)
trap 'rm -rf "$WORK"' EXIT
cat > "$WORK/results" <<'EOF'
1|162.159.192.55:2408|6|12|12|0|0|500|1000000|3|0|3
2|162.159.192.55:500|6|12|12|0|0|100|9000000|3|1|3
3|188.114.98.55:2408|12|12|6|6|0|100|9000000|3|0|3
4|188.114.98.55:2408|6|4|4|0|0|50|99000000|1|0|1
EOF
rank_results
[ "$(head -n 1 "$WORK/ranked" | cut -d'|' -f1)" = 1 ]
put probes_per_round 4
put state running; put reason ''; put selection google,youtube
put minutes 15; put elapsed 10; put started_at 1; put current 1
candidate=1; candidate_ep=162.159.192.55:2408; candidate_jc=6
checks=3; failures=0; rounds=3
: > "$WORK/samples"; printf '1000000\n3000000\n' > "$WORK/speeds"; printf '2000000\n6000000\n' > "$WORK/uploads"
for n in 1 2 3 4 5 6 7 8 9 10 11 12; do echo 'google|ok|500|0|204|0' >> "$WORK/samples"; done
: > "$WORK/results"
record_candidate
[ "$(cut -d'|' -f12 "$WORK/ranked")" = 3 ]
snapshot_auto
[ "$checks:$failures:$rounds" = '3:0:3' ]
[ "$(jsonfilter -i "$WORK/status.json" -e '@.candidates[0].rounds')" = 3 ]
[ "$(jsonfilter -i "$WORK/status.json" -e '@.candidates[0].speed')" = 2000000 ]
[ "$(jsonfilter -i "$WORK/status.json" -e '@.candidates[0].upload_speed')" = 4000000 ]
echo PASS_autotune_ranking_rounds_snapshot_isolation

put state complete; put assessment advantage; snapshot_auto
[ "$(jsonfilter -i "$WORK/status.json" -e '@.candidates[0].recommended')" = true ]
touch "$WORK/unrelated" "$WORK/baseline.conf" "$WORK/note-6" "$WORK/samples-6" "$WORK/speeds-6" "$WORK/uploads-6"
clear_previous_samples
[ -e "$WORK/unrelated" ] && [ -e "$WORK/baseline.conf" ]
[ ! -e "$WORK/note-6" ] && [ ! -e "$WORK/samples-6" ] && [ ! -e "$WORK/speeds-6" ] && [ ! -e "$WORK/uploads-6" ]
echo PASS_means_recommendation_and_owned_cleanup

touch "$WORK/speed-limited"
snapshot_auto
[ "$(jsonfilter -i "$WORK/status.json" -e '@.speed_limited')" = true ]
[ "$(jsonfilter -i "$WORK/status.json" -e '@.candidates[0].recommended')" = false ]
clear_previous_samples
[ ! -e "$WORK/speed-limited" ]
echo PASS_rate_limit_suppresses_recommendation
