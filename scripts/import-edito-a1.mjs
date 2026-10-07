import {readFile,writeFile} from 'node:fs/promises';
import {parseCSVText} from '../website/src/vocabulary-import.js';
import assert from 'node:assert/strict';

const source=new URL('../assets/sources/Édito_A1_2022_标准词库.csv',import.meta.url);
const result=parseCSVText(await readFile(source,'utf8'),'Édito_A1_2022_标准词库.csv');
assert.deepEqual([result.summary.words,result.summary.units,result.summary.parts,result.summary.themes],[566,10,20,80]);
await writeFile(new URL('../assets/edito-a1-2022-bank.json',import.meta.url),JSON.stringify(result.entries,null,2)+'\n');
console.log('Édito A1 imported:',result.summary);
