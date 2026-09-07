# One-command installation: OpenWrt 24.10.4 / AX3000T

Release v0.1.5 was installed from the public `main/i` entrypoint on a Xiaomi
AX3000T using opkg. The first download attempt timed out before package mutation;
bounded download retries were added and the next complete installation succeeded.

Verified fresh installation: missing dependency installed, WARP registered and
started, HTTPS trace returned `warp=on`, empty Podkop section attached, Services
menu and versioned LuCI asset loaded in the browser. Existing Podkop sections
and unrelated configuration hashes were preserved. ZeroTier configuration gained
only the WARP interface blacklist entry, with one required ZeroTier restart.
Podkop reloaded once to attach the new section. ByeDPI process remained running.

Repeating the same public command succeeded with unchanged credentials, UCI
configuration and sing-box, ByeDPI, ZeroTier and WARP process IDs. Installation
during an active stability test was rejected before mutation.

A short service test completed one round: 12 requests, 10 successful responses,
2 ChatGPT HTTP 403 restrictions, no DNS or transport errors, one successful WARP
trace. It was deliberately stopped after 50 seconds; this is not a completed
15-minute stability test or client video playback verification.

Autotune stopped safely at its 64 MiB available-memory guard. About 3.2 MiB of
obsolete temporary artifacts, package index cache and URL log data were cleared
after a private backup. Protected process IDs stayed unchanged. Available RAM
continued to fluctuate near 60–65 MiB, and the retry again reported low_memory.
The guard was not weakened. No candidate was selected or applied.

The firmware also contains a memdoc service that can restart selected network
services below 20,000 KiB available RAM. It was left unchanged. Its presence does
not establish the cause of earlier outages on other routers.

Local checks: 10 installer scenarios, 7 setup scenarios, IPK and APK payload
checks, shell syntax and whitespace checks passed. APK installer branches were
mock-tested; this router run verified opkg. Reboot recovery, full autotune and a
completed 15/30/45/60-minute soak were not verified in this run.
