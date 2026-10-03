import fs from 'node:fs/promises';
import {generateSQLiteDrizzleJson,generateSQLiteMigration} from 'drizzle-kit/api';
import * as schema from '../db/schema.ts';

try {await fs.access('drizzle/0000_vocabulary_state.sql');throw new Error('Initial migration already exists; append a new migration for schema changes.');}catch(error){if(error.code!=='ENOENT')throw error;}
const previous=await generateSQLiteDrizzleJson({});
const current=await generateSQLiteDrizzleJson(schema,previous.id);
const statements=await generateSQLiteMigration(previous,current);
if(statements.length!==1 || !statements[0].includes('CREATE TABLE'))throw new Error('Unexpected initial migration');
await fs.mkdir('drizzle/meta',{recursive:true});
await fs.writeFile('drizzle/0000_vocabulary_state.sql',statements.join('\n--> statement-breakpoint\n')+'\n');
await fs.writeFile('drizzle/meta/0000_snapshot.json',JSON.stringify(current,null,2)+'\n');
await fs.writeFile('drizzle/meta/_journal.json',JSON.stringify({version:'7',dialect:'sqlite',entries:[{idx:0,version:current.version,when:Date.now(),tag:'0000_vocabulary_state',breakpoints:true}]},null,2)+'\n');
console.log(JSON.stringify({version:current.version,migrationStatements:statements.length,migration:'drizzle/0000_vocabulary_state.sql'}));
