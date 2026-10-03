import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JSDOM,VirtualConsole}=require('jsdom');
const source=fs.readFileSync('assets/textbook-template.html','utf8');
const key='french-vocabulary-test:edito-b1:main:textbook:v1';
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const messages=[];
function card(raw,fail=false){return new JSDOM(source,{url:'https://part-card.test',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.structuredClone=structuredClone;if(raw)w.localStorage.setItem(key,raw);
 w.TextbookHost={send:async prompt=>{if(fail)throw Error('host rejected');messages.push(prompt);}};
}});}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const first=card();const d=first.window.document;
d.querySelector('.word').click();d.querySelector('.mark.good').click();await wait(30);
d.querySelector('#pass').click();await wait(10);
assert.equal(d.querySelector('#scope-label').textContent,'Édito B1 · U1 P1');
assert.equal(d.querySelector('.mark.good .count').textContent,'1');
assert.equal(messages.length,1);d.querySelector('#pass').click();assert.equal(messages.length,1);
const checkpoint=JSON.parse(messages[0].split('\ncheckpoint=')[1]);
assert.equal(checkpoint.current,1);assert.equal(checkpoint.attempts[checkpoint.view].part,'U1P1');
// A fresh frame must accept the checkpoint even after initial render saves a default.
const fresh=card();fresh.window.TextbookUI.start({structuredContent:{launchId:'fresh-card',part:'U1P2'},_meta:{textbookCheckpoint:checkpoint}});
assert.equal(fresh.window.document.querySelector('#scope-label').textContent,'Édito B1 · U1 P2');fresh.window.close();
const second=card(JSON.stringify(checkpoint));
assert.equal(second.window.document.querySelector('#scope-label').textContent,'Édito B1 · U1 P2');
second.window.TextbookUI.start({structuredContent:{launchId:'new-card',part:'U1P2'},_meta:{textbookCheckpoint:checkpoint}});
second.window.document.querySelector('#pass').click();await wait(10);
const newer=second.window.localStorage.getItem(key);
first.window.dispatchEvent(new first.window.StorageEvent('storage',{key,newValue:newer}));
assert.equal(d.querySelector('#scope-label').textContent,'Édito B1 · U1 P1');
assert.equal(d.querySelector('.mark.good .count').textContent,'1');
// Remount a previously issued tool result after progress advances.
first.window.TextbookUI.start({structuredContent:{launchId:'old-card',part:'U1P1'}});
const remount=card(newer);
remount.window.localStorage.setItem(key+':card:old-card',checkpoint.attempts[0].id);
remount.window.TextbookUI.start({structuredContent:{launchId:'old-card'}});
assert.equal(remount.window.document.querySelector('#scope-label').textContent,'Édito B1 · U1 P1');
// Host rejection saves progress, leaves old card visible and offers retry.
const rejected=card(undefined,true);rejected.window.document.querySelector('#pass').click();await wait(10);
assert.equal(rejected.window.document.querySelector('#open-next').hidden,false);
assert.equal(rejected.window.document.querySelector('#scope-label').textContent,'Édito B1 · U1 P1');
assert.equal(JSON.parse(rejected.window.localStorage.getItem(key)).current,1);
rejected.window.TextbookHost={send:async prompt=>messages.push(prompt)};
rejected.window.document.querySelector('#open-next').click();await wait(10);
assert.equal(JSON.parse(rejected.window.localStorage.getItem(key)).current,1);
// Entire Part automatic pass opens another card while retaining final vote feedback.
const auto=card();const ad=auto.window.document;
for(let group=0;group<5;group++){
 ad.querySelector(`[data-group="${group}"]`).click();
 for(const row of [...ad.querySelectorAll('.entry')]){
  const id=row.dataset.id;row.querySelector('.word').click();
  [...ad.querySelectorAll('.entry')].find(r=>r.dataset.id===id).querySelector('.mark.good').click();
 }
}
await wait(950);assert.equal(ad.querySelector('#scope-label').textContent,'Édito B1 · U1 P1');
assert.equal(JSON.parse(auto.window.localStorage.getItem(key)).current,1);
assert.equal(ad.querySelector('#result').textContent.includes('100%'),true);
ad.querySelector('.mark.bad').click();await wait(30);
assert.equal(JSON.parse(auto.window.localStorage.getItem(key)).current,0);
assert.equal(ad.querySelector('#scope-label').textContent,'Édito B1 · U1 P1');
assert.deepEqual(errors,[]);
for(const dom of [first,second,remount,rejected,auto])dom.window.close();
console.log('Independent cards: manual/automatic pass, checkpoint continuation, duplicate clicks, old-card storage updates/remount, host rejection/retry and automatic-pass correction passed.');
