import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const foundationSQL=readFileSync(path.join(root,'supabase/migrations/20261012090000_phase7_elevenlabs_voice_runtime.sql'),'utf8');
export const recoverySQL=readFileSync(path.join(root,'supabase/migrations/20261118163533_elevenlabs_voice_receipt_atomic_recovery.sql'),'utf8');

// Review artifact only: emits SQL, never connects to or changes a database.
// Preserve both SQL bodies, replacing only their outer transaction delimiters.
export function voiceReleaseSQL(){
 const body=sql=>{
  const text=sql.trim().replace(/^(?:--[^\n]*\n)*/,'');
  if(!/^begin;[\s\S]*commit;$/i.test(text))throw Error('Unexpected migration transaction boundaries');
  return text.replace(/^begin;/i,'').replace(/commit;$/i,'');
 };
 return 'begin;\n'+body(foundationSQL)+'\n'+body(recoverySQL)+'\ncommit;';
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.stdout.write(voiceReleaseSQL()+'\n');
