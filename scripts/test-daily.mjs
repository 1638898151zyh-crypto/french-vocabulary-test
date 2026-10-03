import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const bank=JSON.parse(await fs.readFile('assets/textbook-bank.json','utf8'));
const ctx=vm.createContext({crypto:webcrypto,structuredClone,console});
vm.runInContext(await fs.readFile('assets/textbook-core.js','utf8'),ctx);
vm.runInContext(await fs.readFile('assets/daily-core.js','utf8'),ctx);
const T=ctx.TextbookCore,D=ctx.DailyCore,main=T.create(bank);
assert.deepEqual(Array.from(D.eligible(main,bank)),[]);
assert.equal(D.select(bank,[]),null);
for(let i=0;i<6;i++)T.pass(main,bank,'manual');
const unchanged=JSON.stringify(main),allowed=D.eligible(main,bank);
const s=D.create(bank,allowed,'launch-a','2026-10-03',null,()=>0.4);
assert.equal(s.ids.length,50);assert.equal(new Set(s.ids).size,50);
assert.deepEqual(Array.from(s.parts),['U3P2','U3P2','U3P1','U2P2','U1P2']);
for(let g=0;g<5;g++){const ids=s.ids.slice(g*10,g*10+10);assert.equal(ids.length,10);assert.ok(ids.every(id=>T.key(bank.find(e=>e.id===id))===s.parts[g]));}
assert.ok(D.validRound(s,bank,allowed));
const id=s.ids[0];assert.equal(D.vote(s,id,'good'),false);D.toggle(s,id);D.vote(s,id,'good');assert.equal(D.vote(s,id,'good'),false);D.vote(s,id,'bad');assert.equal(s.stats[id].good,0);assert.equal(s.stats[id].bad,1);D.toggle(s,id);assert.equal(D.vote(s,id,'good'),false);
assert.equal(JSON.stringify(main),unchanged);
const next=D.create(bank,allowed,'launch-b','2026-10-04',s,()=>0.7);assert.notEqual(next.ids.join('|'),s.ids.join('|'));assert.equal(next.stats[id].bad,1);assert.equal(D.totals(next).done,0);
assert.equal(D.validRound({...s,ids:s.ids.slice(0,49)},bank,allowed),false);
assert.equal(D.eligible({mode:'textbook',current:24,mastered:{}},bank).length,0);
assert.equal(D.select(bank,allowed.slice(0,3)),null);
// Earlier automatic pass revoked: retained later passes cannot lift the main bound.
const rollback=T.create(bank);for(const word of T.active(rollback).ids){T.toggle(rollback,word);T.vote(rollback,word,'good');}const first=rollback.attempts[0].ids[0];T.pass(rollback,bank,'automatic');for(let i=0;i<5;i++)T.pass(rollback,bank,'manual');rollback.view=0;T.vote(rollback,first,'bad');assert.ok(T.restore(rollback,bank));assert.equal(D.eligible(rollback,bank).length,0);assert.equal(D.validRound(s,bank,D.eligible(rollback,bank)),false);
console.log('Daily: exact 5x10 Part mapping, 50 unique IDs, no unmastered words, minimum 4 Parts, strict main rollback bound, hidden-score guard, reversible votes, fresh rounds and unchanged main verified.');

// Group membership is a textbook topic, never a mixed Part-wide pool.
const four=T.create(bank);for(let i=0;i<4;i++)T.pass(four,bank,'manual');const fourAllowed=D.eligible(four,bank);
for(let n=0;n<100;n++){const round=D.create(bank,fourAllowed,'topic-'+n,'2026-10-03');assert.equal(new Set(round.ids).size,50);assert.deepEqual(Array.from(round.parts),['U2P2','U2P2','U2P1','U1P2','U1P1']);assert.notEqual(round.themeKeys[0],round.themeKeys[1]);for(let g=0;g<5;g++){const entries=round.ids.slice(g*10,g*10+10).map(id=>bank.find(e=>e.id===id));assert.equal(new Set(entries.map(e=>e.group.trim())).size,1);assert.ok(entries.every(e=>D.themeKey(e)===round.themeKeys[g]));}assert.ok(D.validRound(round,bank,fourAllowed));}
const checkpoint=JSON.stringify(four),topicRound=D.create(bank,fourAllowed,'saved','2026-10-03');const mixed=structuredClone(topicRound);mixed.ids[0]=bank.find(e=>T.key(e)==='U2P2'&&!mixed.ids.includes(e.id)&&e.group!==mixed.themes[0]).id;assert.equal(D.validRound(mixed,bank,fourAllowed),false);assert.equal(D.validRound({...topicRound,themes:undefined,themeKeys:undefined},bank,fourAllowed),false);assert.equal(JSON.stringify(four),checkpoint);
const six=T.create(bank);for(let i=0;i<11;i++)T.pass(six,bank,'manual');assert.match(D.problem(bank,D.eligible(six,bank)),/U6P1/);assert.equal(D.select(bank,D.eligible(six,bank)),null);
console.log('100 U2P2 rounds: one textbook topic per group, distinct latest themes, 5x10 unique IDs, mixed/legacy round rejection, explicit short-topic failure and unchanged main verified.');
