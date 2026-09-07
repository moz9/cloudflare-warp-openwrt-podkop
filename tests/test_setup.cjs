const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
function run({configured=false,stopped=false,disabled=false,connectFails=false,podkop=true,foreign=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'warp-setup-'));
 const root=dir.replaceAll('\\','/').replace(/^([A-Za-z]):/,(_,d)=>'/'+d.toLowerCase());
 try{
  for(const d of ['etc/config','etc/warp','etc/init.d','usr/libexec'])fs.mkdirSync(path.join(dir,d),{recursive:true});
  if(configured)fs.writeFileSync(path.join(dir,'etc/warp/awg.conf'),'existing keys');
  if(disabled)fs.writeFileSync(path.join(dir,'etc/warp/disabled'),'');
  if(podkop)fs.writeFileSync(path.join(dir,'etc/config/podkop'),'user lists');
  const script=(name,body)=>{const p=path.join(dir,name);fs.writeFileSync(p,'#!/bin/sh\n'+body);fs.chmodSync(p,0o755);};
  script('etc/init.d/warp',`exit ${stopped?1:0}\n`);
  script('usr/libexec/warp-manager',`echo connect >> '${root}/calls'\necho '${connectFails?' {"ok":false,"code":"data_plane_unavailable"}':'{"ok":true}'}'\n`);
  script('usr/libexec/warp-probe',`echo probe >> '${root}/calls'\n`);
  script('usr/libexec/warp-podkop',`echo attach >> '${root}/calls'\necho '{"ok":true}'\n`);
  let src=fs.readFileSync(path.join(__dirname,'../root/usr/libexec/warp-setup'),'utf8')
   .replace('. /usr/libexec/warp-common','warp_operation_acquire(){ :; }')
   .replace(/\nmain "\$@"\s*$/,'\n')
   .replace(/(?<![\w$])\/(etc|usr|var)(?=[/\s"']|$)/g,`${root}/$1`);
  const tail=`
prepare_zerotier(){ echo prepare >> '${root}/calls'; }
uci(){ case "$*" in changes) :;; '-q get warp.main.actual_interface') echo warp;; '-q get podkop.cfwarp') ${foreign?'echo section':'return 1'};; '-q get podkop.cfwarp.warp_managed') echo other;; esac; }
jsonfilter(){ case "$*" in *'@.ok') if grep -q '"ok":true'; then echo true; else echo false; fi;; *) cat >/dev/null; echo data_plane_unavailable;; esac; }
main
`;
  fs.writeFileSync(path.join(dir,'run.sh'),'PATH=/usr/bin:/bin:$PATH\n'+src+tail);
  const r=spawnSync(process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'sh',[path.join(dir,'run.sh')],{encoding:'utf8',timeout:15000});
  return {code:r.status,log:r.stdout+r.stderr,calls:fs.existsSync(path.join(dir,'calls'))?fs.readFileSync(path.join(dir,'calls'),'utf8'):'',config:podkop?fs.readFileSync(path.join(dir,'etc/config/podkop'),'utf8'):''};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('first setup connects, verifies and attaches in order',()=>{const r=run();assert.equal(r.code,0,r.log);assert.equal(r.calls,'prepare\nconnect\nprobe\nattach\n');});
test('running update does not register or replace endpoint',()=>{const r=run({configured:true});assert.equal(r.code,0,r.log);assert.equal(r.calls,'probe\nattach\n');});
for(const state of [{configured:true,stopped:true},{disabled:true}])test('stopped/disabled state is preserved',()=>{const r=run(state);assert.equal(r.code,0,r.log);assert.equal(r.calls,'');});
test('JSON error with exit zero cannot count as successful connection',()=>{const r=run({connectFails:true});assert.notEqual(r.code,0);assert.doesNotMatch(r.calls,/probe|attach/);});
test('foreign cfwarp section is preserved',()=>{const r=run({foreign:true});assert.notEqual(r.code,0);assert.doesNotMatch(r.calls,/attach/);assert.equal(r.config,'user lists');});
test('without Podkop the installer reports connected WARP only',()=>{const r=run({podkop:false});assert.equal(r.code,0,r.log);assert.doesNotMatch(r.calls,/attach/);assert.match(r.log,/Podkop is not installed/);});
