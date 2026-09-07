#!/bin/sh
# Install UI/backend only. Connecting and creating a section are explicit actions.
set -eu
umask 077
VERSION=0.1.0
BASE=https://github.com/moz9/cloudflare-warp-openwrt-podkop/releases/download/v$VERSION
fail() { echo "CF WARP: $*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || fail 'root required'
command -v opkg >/dev/null || fail 'This release requires OpenWrt with opkg; APK builds are not yet validated.'
command -v curl >/dev/null || fail 'curl required'
command -v uci >/dev/null || fail 'uci required'
[ -z "$(uci changes)" ] || fail 'Save or discard pending LuCI changes first.'
if [ -x /usr/libexec/warp-job ]; then
    busy=$(/usr/libexec/warp-job status | jsonfilter -e '@.busy')
    [ "$busy" != true ] || fail 'Wait for the active WARP operation.'
fi
mkdir /var/lock/cfwarp-install.lock 2>/dev/null || fail 'Another installation is active.'
trap 'rmdir /var/lock/cfwarp-install.lock 2>/dev/null || true' EXIT
opkg print-architecture | grep -q 'aarch64_cortex-a53' || fail 'This build targets aarch64_cortex-a53.'
for p in kmod-tun ca-bundle luci-base rpcd-mod-ucode jsonfilter; do
    opkg status "$p" | grep -q 'Status: .* installed' || fail "Missing prerequisite: $p"
done
work=$(mktemp -d /tmp/cfwarp-install.XXXXXX)
trap 'rm -rf "$work"; rmdir /var/lock/cfwarp-install.lock 2>/dev/null || true' EXIT
trap 'exit 1' HUP INT TERM
for f in SHA256SUMS FILES.sha256 warp-awg_${VERSION}_aarch64_cortex-a53.ipk warp-warpscout_${VERSION}_aarch64_cortex-a53.ipk luci-app-warp_${VERSION}_all.ipk; do
    if [ -n "${WARP_BUNDLE_DIR:-}" ]; then
        cp "$WARP_BUNDLE_DIR/$f" "$work/$f"
    else
        curl -fL --connect-timeout 10 --max-time 120 "$BASE/$f" -o "$work/$f"
    fi
done
(cd "$work" && sha256sum -c SHA256SUMS) || fail 'Checksum mismatch'
backup=/root/cfwarp-install-$(date +%Y%m%d-%H%M%S)-$$
mkdir -m 700 "$backup"
opkg list-installed > "$backup/packages"
cp /usr/lib/opkg/status "$backup/opkg-status"
for p in warp-awg warp-warpscout luci-app-warp; do
    for f in /usr/lib/opkg/info/"$p".*; do
        [ ! -f "$f" ] || printf '%s\n' "$f"
    done
done > "$backup/metadata-files"
[ ! -s "$backup/metadata-files" ] || tar -czf "$backup/metadata.tar.gz" -T "$backup/metadata-files"
tar -czf "$backup/configs.tar.gz" /etc/config/network /etc/config/podkop /etc/config/firewall /etc/config/dhcp
for p in warp-awg warp-warpscout luci-app-warp; do
    opkg files "$p" 2>/dev/null | sed -n '\|^/|p' | while IFS= read -r f; do
        if [ -e "$f" ] || [ -L "$f" ]; then printf '%s\n' "$f"; fi
    done
done > "$backup/previous-files"
if [ -s "$backup/previous-files" ]; then tar -czf "$backup/previous-files.tar.gz" -T "$backup/previous-files"; fi
config_existed=0
[ ! -e /etc/config/warp ] || { config_existed=1; cp /etc/config/warp "$backup/warp-config"; }
rollback_packages() {
    # Restore only our three package records; preserve every other package.
    for p in warp-awg warp-warpscout luci-app-warp; do rm -f /usr/lib/opkg/info/"$p".*; done
    [ ! -f "$backup/metadata.tar.gz" ] || tar -xzf "$backup/metadata.tar.gz" -C /
    awk 'BEGIN {RS="";ORS="\n\n"} {split($0,a,"\n"); if (a[1]!="Package: warp-awg" && a[1]!="Package: warp-warpscout" && a[1]!="Package: luci-app-warp") print}' /usr/lib/opkg/status > "$work/status"
    awk 'BEGIN {RS="";ORS="\n\n"} {split($0,a,"\n"); if (a[1]=="Package: warp-awg" || a[1]=="Package: warp-warpscout" || a[1]=="Package: luci-app-warp") print}' "$backup/opkg-status" >> "$work/status"
    cat "$work/status" > /usr/lib/opkg/status
    awk '{print $2}' "$work/FILES.sha256" | while IFS= read -r f; do
        grep -Fxq "$f" "$backup/previous-files" || rm -f "$f"
    done
    [ ! -f "$backup/previous-files.tar.gz" ] || tar -xzf "$backup/previous-files.tar.gz" -C /
    if [ "$config_existed" = 1 ]; then cp "$backup/warp-config" /etc/config/warp; else rm -f /etc/config/warp; fi
}
running=0
[ ! -x /etc/init.d/warp ] || { /etc/init.d/warp status >/dev/null 2>&1 && running=1 || true; }
install_started=0
install_cleanup() {
    if [ "$install_started" = 1 ]; then
        rollback_packages
        [ "$running" = 0 ] || { /etc/init.d/warp start; /etc/init.d/warp-watchdog start; }
    fi
    rm -rf "$work"
    rmdir /var/lock/cfwarp-install.lock 2>/dev/null || true
}
trap install_cleanup EXIT
if [ "$running" = 1 ]; then /etc/init.d/warp-watchdog stop; /etc/init.d/warp stop; fi
install_started=1
if ! opkg --force-reinstall install "$work/warp-awg_${VERSION}_aarch64_cortex-a53.ipk" "$work/warp-warpscout_${VERSION}_aarch64_cortex-a53.ipk" "$work/luci-app-warp_${VERSION}_all.ipk" || ! sha256sum -c "$work/FILES.sha256"; then
    rollback_packages
    install_started=0
    [ "$running" = 0 ] || { /etc/init.d/warp start; /etc/init.d/warp-watchdog start; }
    fail "Install failed. Backup: $backup"
fi
if [ "$running" = 1 ]; then /etc/init.d/warp start; /etc/init.d/warp-watchdog start; fi
install_started=0
/etc/init.d/rpcd restart
n=0
until ubus list luci.warp 2>/dev/null | grep -q '^luci.warp$'; do
    n=$((n+1)); [ "$n" -lt 10 ] || fail 'rpcd did not expose luci.warp; packages remain installed for diagnosis.'
    sleep 1
done
rm -f /tmp/luci-indexcache.*
echo "Installed. Open Network / Cloudflare WARP. Backup: $backup"
