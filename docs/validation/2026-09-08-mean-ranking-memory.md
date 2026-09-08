# Mean throughput, balanced ranking and bounded result storage (0.1.8)

Both throughput columns now show the arithmetic mean of successful samples.
Ranking orders eligibility, successful service fraction, transport reliability,
complete speed measurements, geometric mean of mean download and mean upload,
then p95 latency. Only the first completed eligible candidate with at least two
measurements in each direction receives the recommendation label. This selects
among the six tested variants and does not promise a global optimum.

An admitted new run removes only owned per-candidate samples, speed values,
notes and temporary logs. This prevents stale measurements from failed candidates
leaking into a later run. The baseline used for apply/rollback, unrelated files,
lock files, registrations and configuration remain intact. Large transfers still
go to /dev/null or stream from /dev/zero; the 960 MiB bound is network traffic,
not RAM or persistent storage. Existing memory guards stay in force.

Five ranking cases and eleven speed cases passed. A native isolated shell test
on Redmi AX6 verified arithmetic means (1+3 -> 2, 2+6 -> 4), recommendation and
cleanup scope using the actual OpenWrt JSON tools. No live tunnel was changed by
these tests. A full live six-candidate run of this release remains unverified.
