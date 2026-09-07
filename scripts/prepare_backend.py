"""Prepare pinned ARM64 backend artifacts, without installing anything locally."""
import argparse
import hashlib
from pathlib import Path
import subprocess
import sys
import tarfile
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
BASE='https://github.com/BAzeRlok/CFWARP-OPENWRT/releases/download/v3.0.0/'
APK_HASHES={
    'warp-awg-3.1.20260828-r3-aarch64_cortex-a53.apk':'aa342aedad25aee370c08079b2bc7f99099f60eec70f8564835ffda5ae22bfe1',
    'warp-warpscout-0.16.0-r1-aarch64_cortex-a53.apk':'da4fd0e15b38ac9b751f7b7e2ffe9caed341d3c6818c86de52780362f7b59fd9',
}
PARSER_URL='https://raw.githubusercontent.com/7Ji/adumpk/1cfd39260eaddf46913a81d0aa6f8ff88bd5696c/adumpk.py'
PARSER_HASH='9623a4cdadbf68432156bfa2a5f6655db1ca6cbdbf2fb559535215e6dd261a68'

def download(url,path,digest):
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
        with urllib.request.urlopen(url,timeout=120) as response: data=response.read()
        if hashlib.sha256(data).hexdigest()!=digest: raise ValueError('Checksum mismatch: '+path.name)
        path.write_bytes(data)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--zig',required=True)
    args=parser.parse_args()
    work=ROOT/'.build'; backend=work/'backend'
    backend.mkdir(parents=True,exist_ok=True)
    raw=work/'adumpk-original.py'
    download(PARSER_URL,raw,PARSER_HASH)
    # The upstream parser uses PosixPath; Path supports the same operations on Windows.
    compatible=work/'adumpk.py'
    compatible.write_bytes(raw.read_bytes().replace(b'from pathlib import PosixPath as Path',b'from pathlib import Path'))
    for name,digest in APK_HASHES.items():
        apk=work/name; tar=work/(name+'.tar')
        download(BASE+name,apk,digest)
        subprocess.run([sys.executable,str(compatible),str(apk),'--tar',str(tar)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        with tarfile.open(tar) as archive:
            for binary in ['warp-amneziawg-go','warp-warpscout']:
                candidates=[m for m in archive.getmembers() if m.name.lstrip('./')=='usr/libexec/'+binary]
                if candidates:
                    if len(candidates)!=1 or not candidates[0].isfile(): raise ValueError('Unexpected APK member')
                    (backend/binary).write_bytes(archive.extractfile(candidates[0]).read())
    subprocess.run([args.zig,'cc','-target','aarch64-linux-musl','-static','-Os','-s',
                    '-std=c11','-Wall','-Wextra','-Werror','-o',str(backend/'warp-awgctl'),
                    str(ROOT/'warp-awg/files/warp-awgctl.c')],check=True)
    print('Verified backend prepared:',backend)

if __name__=='__main__': main()
