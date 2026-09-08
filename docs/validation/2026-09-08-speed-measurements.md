# Bounded throughput checks (0.1.7)

Autotune now attempts two single-stream downloads of up to 64 MiB / 8 seconds
and two streamed uploads of up to 16 MiB / 8 seconds per candidate. Payloads are
discarded or streamed from /dev/zero, not buffered as complete files. The maximum
six-candidate budget is 960 MiB. The UI discloses the budget and temporary load.

The lower valid speed is shown for each direction, alongside sample count. Missing
measurements are explicitly unknown. Availability and WARP continuity precede
download throughput in ranking; upload is shown separately for comparison.
A completed HTTP 200 upload is required; an unacknowledged upload is not a result.
Download timeouts count only with HTTP 200, at least 1 MiB received and at least
7.5 seconds elapsed. Short failures and HTTP errors do not become speed samples.

Eleven isolated cases exercise completed samples, intentional time bounds, HTTP
errors, early disconnects, incomplete upload acknowledgement and remaining budget.
Three ranking tests, IPK/APK payload tests and seventeen installer/setup tests pass.
Native checks on Redmi AX6 verified about 36.53 Mbit/s download and 43.09 Mbit/s
upload to Cloudflare through the current WARP interface. The native check used
WARP DoH to avoid local FakeIP; autotune uses remote SOCKS DNS. The full six-
candidate comparison with the new checks has not been run yet.

These single-stream samples are not Ookla results or a measurement of ISP tariff
capacity. User-shared Ookla screenshots used different servers and dates.
