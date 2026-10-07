import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {parseCSVText,parseCSV,vocabularySummary} from '../src/vocabulary-import.js';
import {editoA1Book} from '../src/supplied-books.js';
import {freshMulti,restoreMulti} from '../src/multi-learning.js';
import * as Study from '../src/preview-study.js';

test('A1 import preserves all 17 source columns, source order and draft statuses',async()=>{
  const source=await readFile(new URL('../../assets/sources/Édito_A1_2022_标准词库.csv',import.meta.url),'utf8');
  const rows=parseCSV(source),fields=rows[0];
  assert.equal(fields.length,17);
  const bank=editoA1Book.bank;
  assert.equal(bank.length,566);
  for(let i=0;i<bank.length;i++)for(let j=0;j<fields.length;j++)assert.equal(bank[i][fields[j]],rows[i+1][j],`${bank[i].id}: ${fields[j]}`);
  assert.deepEqual(vocabularySummary(bank),{words:566,units:10,parts:20,themes:80,missingIPA:0,unreviewedIPA:566,missingSource:0});
  assert.equal(bank.filter(e=>e.ipa_status==='manual_draft_review_needed').length,548);
  assert.equal(bank.filter(e=>e.ipa_status==='espeak_draft_review_needed').length,18);
  assert.deepEqual(parseCSVText(source,'Édito_A1_2022_标准词库.csv').entries.map(e=>e.id),bank.map(e=>e.id));
});

test('all A1 Parts and themes have Chinese titles and generate full groups',()=>{
  const b=editoA1Book,s=Study.create(b.bank,b.level);
  const expectedSizes=[21,44,16,20,25,28,26,26,40,17,46,28,33,21,41,23,28,22,27,34];
  assert.equal(s.order.length,20);
  assert.ok(b.bank.every(e=>e.partie_title_zh&&e.group_zh));
  for(const [index,part] of s.order.entries()){
    Study.selectPart(s,b.bank,part);
    const attempt=Study.active(s),groups=Study.groups(b.bank,attempt);
    assert.equal(attempt.ids.length,expectedSizes[index]);
    assert.deepEqual(groups.flatMap(g=>g.ids),attempt.ids);
  }
});

test('existing account backups gain A1 without changing other books or scores',()=>{
  const old=structuredClone(freshMulti());
  old.books=old.books.filter(b=>b.id!==editoA1Book.id);
  delete old.progress[editoA1Book.id];
  const b1=old.books.find(b=>b.id==='edito-b1'),main=old.progress[b1.id],id=Study.active(main).ids[0];
  Study.toggle(main,id);Study.vote(main,id,'good');
  const before=JSON.stringify(old),restored=restoreMulti(old);
  assert.ok(restored);
  assert.equal(JSON.stringify(old),before);
  for(const [bookId,progress] of Object.entries(old.progress))assert.deepEqual(restored.progress[bookId],progress);
  assert.deepEqual(restored.progress[editoA1Book.id].stats,{});
  assert.equal(restored.progress[editoA1Book.id].order.length,20);
  assert.equal(restored.bookId,old.bookId);
  restored.bookId=editoA1Book.id;
  const a1=restored.progress[editoA1Book.id],a1id=Study.active(a1).ids[0];
  Study.toggle(a1,a1id);Study.vote(a1,a1id,'bad');
  assert.deepEqual(restored.progress[b1.id].stats[id],{good:1,bad:0});
  const roundtrip=restoreMulti(JSON.stringify(restored));
  assert.ok(roundtrip);
  assert.deepEqual(roundtrip.progress[editoA1Book.id].stats[a1id],{good:0,bad:1});
});
