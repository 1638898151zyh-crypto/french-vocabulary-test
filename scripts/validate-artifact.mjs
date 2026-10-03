import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('dist/server/index.js','utf8');
JSON.parse(await fs.readFile('dist/.openai/hosting.json','utf8'));
const worker=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
assert.equal(typeof worker.default?.fetch,'function');
console.log('Artifact is valid ESM and exports default.fetch');
