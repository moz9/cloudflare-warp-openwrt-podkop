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
