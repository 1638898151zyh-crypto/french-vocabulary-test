import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=await fs.readFile('dist/server/index.js','utf8');
const {default:worker}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
async function rpc(method,params={},authenticated=false,env={}){
 const response=await worker.fetch(new Request('https://local.test/mcp',{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{'oai-authenticated-user-id':'local-test-user'}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),env);
 return {status:response.status,body:await response.json()};
}
const listed=(await rpc('tools/list')).body.result.tools;
assert.equal(listed.length,5);
for(const name of ['open_vocabulary_test','open_textbook_vocabulary_test','open_daily_vocabulary_test']){
 const tool=listed.find(t=>t.name===name);assert.ok(tool?._meta.ui.resourceUri);
 assert.equal((await rpc('tools/call',{name,arguments:{}})).status,401);
 assert.equal((await rpc('resources/read',{uri:tool._meta.ui.resourceUri})).status,401);
 const resource=(await rpc('resources/read',{uri:tool._meta.ui.resourceUri},true)).body.result.contents[0];
 assert.equal(resource.mimeType,'text/html;profile=mcp-app');
 assert.deepEqual(resource._meta['openai/ui'].availableDisplayModes,['inline','fullscreen']);
 for(const match of resource.text.matchAll(/<script(.*?)>([\s\S]*?)<\/script>/g)){
  if(!match[1].includes('application/json'))new vm.Script(match[2]);
 }
 if(name==='open_textbook_vocabulary_test'){
  const opened=(await rpc('tools/call',{name,arguments:{}},true)).body.result;
  assert.equal(opened.isError,undefined);assert.equal(opened.structuredContent.bankWords,1110);
  const bank=JSON.parse(resource.text.match(/id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(bank.length,1110);assert.equal(new Set(bank.map(e=>e.id)).size,1110);
  const coreScript=[...resource.text.matchAll(/<script(.*?)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('globalThis.TextbookCore=')).at(2);
  const context=vm.createContext({crypto:webcrypto,structuredClone,console});vm.runInContext(coreScript,context);
  const C=context.TextbookCore,s=C.create(bank);assert.equal(C.parts(bank).length,24);assert.equal(C.active(s).ids.length,46);
  const id=C.active(s).ids[0];assert.equal(C.vote(s,id,'good'),false);C.toggle(s,id);C.vote(s,id,'good');assert.equal(C.vote(s,id,'good'),false);C.vote(s,id,'bad');assert.equal(s.stats[id].good,0);assert.equal(s.stats[id].bad,1);
  for(const id of C.active(s).ids){if(!C.active(s).opened[id])C.toggle(s,id);C.vote(s,id,'good');}
  assert.equal(C.pass(s,bank,'automatic','test-auto'),true);assert.equal(C.active(s).part,'U1P2');assert.equal(C.pass(s,bank,'manual','test-auto'),false);assert.ok(C.restore(s,bank));
 }
}
assert.equal((await rpc('resources/read',{uri:'ui://other/test.html'},true)).body.error.code,-32602);
assert.equal((await rpc('initialize',{protocolVersion:'2025-11-25'})).body.result.serverInfo.version,'0.1.11');
console.log('MCP discovery, authenticated resources, inline/fullscreen metadata, both UI scripts, 1110 IDs and textbook scoring/progression verified. No live learning records accessed.');
