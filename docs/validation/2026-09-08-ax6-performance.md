# AX6 performance experiments and rate-limit handling (0.1.10)

Only 10.34.51.52 was modified; the home router was untouched. MTU 1280, 1360,
1400 and a repeated 1280 were compared on the same WARP endpoint. Upload varied
across runs; download testing hit HTTP 429. No MTU benefit was established, and
1280 was restored. Further download requests were stopped after this finding.

The native tunnel was compared with GOMAXPROCS=1 and 2 while retaining the
40 MiB Go soft memory target, endpoint, account and MTU. Three uploads per
CPU trial used 16 MiB, a fixed destination and an eight-second cap. Two-thread
runs averaged approximately 49.3 and 48.4 Mbit/s; the intervening one-thread
run averaged 35.5 Mbit/s, while initial one-thread samples were about 43.8.
These short router-originated tests include curl/TLS costs and network variance;
they do not establish client Speedtest capacity or a guaranteed percentage gain.

A validated optional warp.main.worker_threads setting permits 1 or 2. Default
remains 1; the AX6 trial uses 2. No increase to the Go memory limit is made.

On speed-server HTTP 429, autotune stops further throughput requests for that
run, retains service checks, removes speed from ranking and suppresses the
recommendation label. The UI explains that limitation. Owned cleanup resets
that state on a new run. No alternate-IP retries or rate-limit bypass is used.

Tests cover 429 request suppression, speed-neutral ranking, recommendation
suppression and cleanup. OpenWrt-native isolated tests passed. Full client
throughput and prolonged stability of the two-thread profile remain unverified.
