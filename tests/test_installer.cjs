const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const version=fs.readFileSync(path.join(__dirname,'../install-podkop.sh'),'utf8').match(/^VERSION=(.+)$/m)[1].trim();
const shell=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'sh';
function scenario({pm='opkg',badHash=false,failInstall=false,failSetup=false,pending=false,arch='aarch64_cortex-a53'}={}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'warp-install-'));
 const root=dir.replaceAll('\\','/').replace(/^([A-Za-z]):/,(_,d)=>'/'+d.toLowerCase());
 try {
  for(const d of ['etc/config','etc/init.d','usr/lib/opkg/info','usr/libexec','var/lock','tmp','overlay','bundle','payload','lib/apk/db'])fs.mkdirSync(path.join(dir,d),{recursive:true});
  fs.writeFileSync(path.join(dir,'etc/openwrt_release'),`DISTRIB_ARCH='${arch}'\n`);
  fs.writeFileSync(path.join(dir,'usr/lib/opkg/status'),'Package: unrelated\nStatus: install ok installed\n\n');
  const body=`#!/bin/sh\necho ${failSetup?'INCOMPLETE':'READY'}\nexit ${failSetup?1:0}\n`;
  fs.writeFileSync(path.join(dir,'payload/warp-setup'),body);
  const hash=crypto.createHash('sha256').update(body).digest('hex');
  let files=`${hash}  ${root}/usr/libexec/warp-setup\n`;
  for(const name of ['warp-amneziawg-go','warp-awgctl','warp-warpscout']){
   fs.writeFileSync(path.join(dir,'payload',name),'backend');
   files+=`${crypto.createHash('sha256').update('backend').digest('hex')}  ${root}/usr/libexec/${name}\n`;
  }
  fs.writeFileSync(path.join(dir,'bundle/FILES.sha256'),files);
  fs.writeFileSync(path.join(dir,'bundle/INSTALL-SIZES'),'luci-app-warp 1\nwarp-awg 1\nwarp-warpscout 1\n');
  const packages=pm==='apk'?[`luci-app-warp-${version}-r1.apk`,'warp-awg-0.1.0-r1.apk','warp-warpscout-0.1.0-r1.apk']:[`luci-app-warp_${version}_all.ipk`,'warp-awg_0.1.0_aarch64_cortex-a53.ipk','warp-warpscout_0.1.0_aarch64_cortex-a53.ipk'];
  for(const p of packages)fs.writeFileSync(path.join(dir,'bundle',p),'package');
  const sums=[...packages,'FILES.sha256','INSTALL-SIZES'].map(p=>`${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'bundle',p))).digest('hex')}  ${p}\n`).join('');
  fs.writeFileSync(path.join(dir,'bundle',pm==='apk'?'SHA256SUMS-APK':'SHA256SUMS'),badHash?sums.replace(/^[0-9a-f]/,'z'):sums);
  const init='#!/bin/sh\n[ "$1" != status ]\n';
  for(const n of ['warp','warp-watchdog','rpcd']){fs.writeFileSync(path.join(dir,'etc/init.d',n),init);fs.chmodSync(path.join(dir,'etc/init.d',n),0o755);}
  let src=fs.readFileSync(path.join(__dirname,'../install-podkop.sh'),'utf8').replace(/(?<![\w$])\/(etc|usr|var|tmp|overlay|lib)(?=[/\s"']|$)/g,`${root}/$1`);
  const mocks=`
PATH=/usr/bin:/bin:$PATH
ROOT='${root}'
export WARP_BUNDLE_DIR="$ROOT/bundle"
id(){ echo 0; }
uci(){ if [ "$1" = changes ]; then ${pending?'echo pending':':'}; else echo warp; fi; }
flock(){ :; }
jsonfilter(){ :; }
nft(){ :; }
curl(){ return 7; }
df(){ echo 'filesystem 100000 0 100000 0% /overlay'; }
ubus(){ echo luci.warp; }
tar(){ case "$1" in -xzOf|-xzO|-xO) cat >/dev/null; echo default;; *) command tar "$@";; esac; }
gzip(){ echo default; }
install_mock(){
 cp "$ROOT/payload/"* "$ROOT/usr/libexec/"
 chmod +x "$ROOT/usr/libexec/warp-setup"
 echo default > "$ROOT/etc/config/warp"
 echo install >> "$ROOT/calls"
 return ${failInstall?7:0}
}
${pm==='opkg'?`opkg(){ case "$1" in status) case "$2" in warp-*|luci-app-warp) return 1;; *) echo 'Status: install ok installed';; esac;; files) :;; --force-reinstall) install_mock;; *) return 8;; esac; }`:`apk(){ case "$1" in info) case "$3" in warp-*|luci-app-warp) return 1;; *) echo "$3";; esac;; add) install_mock;; del) echo rollback >> "$ROOT/calls";; *) return 8;; esac; }`}
`;
  fs.writeFileSync(path.join(dir,'run.sh'),mocks+src);
  const r=spawnSync(shell,[path.join(dir,'run.sh')],{encoding:'utf8',timeout:20000});
  return {code:r.status,log:r.stdout+r.stderr,exists:fs.existsSync(path.join(dir,'usr/libexec/warp-setup')),calls:fs.existsSync(path.join(dir,'calls'))?fs.readFileSync(path.join(dir,'calls'),'utf8'):''};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
for(const pm of ['opkg','apk']){
 test(`${pm}: complete first install invokes setup`,()=>{const r=scenario({pm});assert.equal(r.code,0,r.log);assert.match(r.log,/READY/);});
 test(`${pm}: checksum failure makes no package changes`,()=>{const r=scenario({pm,badHash:true});assert.notEqual(r.code,0);assert.equal(r.calls,'');});
 test(`${pm}: package failure restores introduced files`,()=>{const r=scenario({pm,failInstall:true});assert.notEqual(r.code,0,r.log);assert.equal(r.exists,false,r.log);});
 test(`${pm}: connection failure is not reported as ready`,()=>{const r=scenario({pm,failSetup:true});assert.notEqual(r.code,0,r.log);assert.equal(r.exists,true,r.log);assert.match(r.log,/setup is incomplete/);});
}
test('pending edits prevent installation',()=>{const r=scenario({pending:true});assert.notEqual(r.code,0);assert.equal(r.calls,'');});
test('unsupported CPU fails before installation',()=>{const r=scenario({arch:'mips_24kc'});assert.notEqual(r.code,0);assert.equal(r.calls,'');});
