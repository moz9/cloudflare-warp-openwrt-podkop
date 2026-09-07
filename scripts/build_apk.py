"""Package the verified IPK payload as unsigned APK v2 for apk-tools 3."""
import gzip,hashlib,io,tarfile
from pathlib import Path
from build_ipk import VERSION, BACKEND_VERSION
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist-apk';OUT.mkdir(exist_ok=True)
packages=[]
for name,ver,arch,deps in [
 ('warp-awg',BACKEND_VERSION,'aarch64_cortex-a53',['kmod-tun']),
 ('warp-warpscout',BACKEND_VERSION,'aarch64_cortex-a53',['ca-bundle']),
 ('luci-app-warp',VERSION,'noarch',['luci-base','rpcd-mod-ucode','curl','jsonfilter','warp-awg','warp-warpscout'])]:
 src=ROOT/'dist-podkop'/f"{name}_{ver}_{'all' if arch=='noarch' else 'aarch64_cortex-a53'}.ipk"
 with tarfile.open(src) as t: payload=t.extractfile('./data.tar.gz').read()
 buf=io.BytesIO();size=0
 with tarfile.open(fileobj=buf,mode='w',format=tarfile.PAX_FORMAT) as dest:
  with tarfile.open(fileobj=io.BytesIO(payload)) as source:
   for entry in source:
    entry.name=entry.name.removeprefix('./')
    if entry.isfile():
     data=source.extractfile(entry).read();size+=len(data)
     entry.pax_headers={'APK-TOOLS.checksum.SHA1':hashlib.sha1(data).hexdigest()}
     dest.addfile(entry,io.BytesIO(data))
    else:dest.addfile(entry)
 data=gzip.compress(buf.getvalue(),mtime=0)
 info=f'pkgname = {name}\npkgver = {ver}-r1\narch = {arch}\nsize = {size}\npkgdesc = Cloudflare WARP OpenWrt Podkop integration\nurl = https://github.com/moz9/cloudflare-warp-openwrt-podkop\nlicense = MIT Apache-2.0\norigin = {name}\nbuilddate = 0\ndatahash = {hashlib.sha256(data).hexdigest()}\n'
 info+=''.join('depend = '+d+'\n' for d in deps)
 body=info.encode();entry=tarfile.TarInfo('.PKGINFO');entry.size=len(body);entry.mode=0o644
 control=entry.tobuf(format=tarfile.USTAR_FORMAT)+body+b'\0'*((-len(body))%512)
 path=OUT/f'{name}-{ver}-r1.apk';path.write_bytes(gzip.compress(control,mtime=0)+data)
 packages.append(path)
 print(path.name,path.stat().st_size)
(OUT/'FILES.sha256').write_bytes((ROOT/'dist-podkop/FILES.sha256').read_bytes())
(OUT/'INSTALL-SIZES').write_bytes((ROOT/'dist-podkop/INSTALL-SIZES').read_bytes())
packages.extend([OUT/'FILES.sha256', OUT/'INSTALL-SIZES'])
(OUT/'SHA256SUMS-APK').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in sorted(packages)),encoding='ascii',newline='\n')
