import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const bank=JSON.parse(await fs.readFile('assets/textbook-bank.json','utf8'));
const ctx=vm.createContext({crypto:webcrypto,structuredClone});
vm.runInContext(await fs.readFile('assets/textbook-core.js','utf8'),ctx);
const T=ctx.TextbookCore,s=T.create(bank);
assert.deepEqual(Array.from(T.groups(bank,T.active(s)),g=>g.ids.length),[7,11,9,8,11]);
let total=0;
for(let p=0;p<24;p++){
 const a=T.active(s),groups=T.groups(bank,a),expected=bank.filter(e=>T.key(e)===a.part);
 assert.equal(groups.length,new Set(expected.map(e=>e.group.trim())).size);
 assert.equal(groups.flatMap(g=>Array.from(g.ids)).sort().join('|'),Array.from(a.ids).sort().join('|'));
 assert.equal(Array.from(groups,g=>g.label).join('|'),[...new Set(expected.map(e=>e.group.trim()))].join('|'));
 for(const g of groups)assert.equal(g.ids.join('|'),expected.filter(e=>e.group.trim()===g.label).map(e=>e.id).join('|'));
 for(const group of groups){assert.ok(group.ids.every(id=>bank.find(e=>e.id===id).group.trim()===group.label));total+=group.ids.length;}
 // Migrate every possible old ten-word page without losing an existing vote or moving main progress.
 for(let old=0;old<Math.ceil(a.ids.length/10);old++){
  const raw=structuredClone(s),before=raw.attempts[raw.view];delete before.grouping;before.group=old;
  const anchor=before.ids[old*10];before.opened[anchor]=true;before.votes[anchor]='bad';raw.stats[anchor]={good:0,bad:1};
  const restored=T.restore(raw,bank);assert.ok(restored);const moved=T.active(restored);
  assert.ok(T.groups(bank,moved)[moved.group].ids.includes(anchor));
  assert.equal(moved.votes[anchor],'bad');assert.equal(restored.stats[anchor].bad,1);
  assert.equal(restored.current,raw.current);assert.deepEqual(restored.mastered,raw.mastered);assert.equal(moved.id,before.id);
 }
 assert.ok(T.restore(s,bank));T.pass(s,bank,'manual');
}
assert.equal(total,1110);assert.equal(s.completed,true);
const fresh=T.create(bank);for(const id of T.active(fresh).ids){T.toggle(fresh,id);T.vote(fresh,id,'good');}
T.pass(fresh,bank,'automatic');fresh.view=0;const id=T.active(fresh).ids[10];T.vote(fresh,id,'bad');assert.equal(fresh.current,0);assert.ok(!fresh.mastered.U1P1);assert.ok(T.restore(fresh,bank));
console.log('All 24 Parts: complete single-theme groups, 1110 unique entries, old ten-word-page migration with votes/progress intact, automatic-pass rollback verified.');
