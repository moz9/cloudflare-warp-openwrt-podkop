const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../htdocs/luci-static/resources/view/warp/cfwarp.js'),'utf8');
function E(tag,attrs={},children=[]) {return {tag,attrs,children,replaceChildren(...rows){this.children=rows},addEventListener(){}};}
test('first render works before status arrives; headings follow old and new results',async()=>{
 let status={state:'idle',candidates:[]};
 const v=new Function('rpc','view','E',source)({declare:()=>()=>Promise.resolve(status)},{extend:x=>x},E);
 assert.doesNotThrow(()=>v.renderAutotune());
 await v.refreshAuto();
 assert.equal(v.autoHead.children[3].children,'Загрузка (старый замер)');
 status={state:'complete',speed_metric:'mean_v1',candidates:[]};
 await v.refreshAuto();
 assert.equal(v.autoHead.children[3].children,'Средняя загрузка');
 assert.equal(v.autoHead.children[4].children,'Средняя отдача');
});

test('quick results show spread and a conservative conclusion without render errors',async()=>{
 const status={state:'complete',minutes:5,speed_metric:'mean_v2',speed_target:3,assessment:'close',phase:'finalists',candidates:[{id:1,endpoint:'test:500',jc:12,total:9,good:9,restricted:0,errors:0,checks:3,failures:0,rounds:3,speed:1000000,speed_samples:3,upload_speed:2000000,upload_samples:3,download_median:1000000,download_min:900000,download_max:1100000,services:[]}]};
 const v=new Function('rpc','view','E',source)({declare:()=>()=>Promise.resolve(status)},{extend:x=>x},E);
 v.renderAutotune(); await v.refreshAuto();
 assert.match(v.autoProgress.textContent,/сопоставимы/);
 assert.match(v.autoRows.children[0].children[3].children,/медиана/);
 assert.equal(v.autoRows.children[0].children[6].children.disabled,false);
 assert.equal(v.autoDuration.children[0].attrs.value,5);
});
