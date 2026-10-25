const test=require('node:test');
const assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs');
const {runOptionalRealEstateOperation:run}=load('lib/ai/optional-real-estate-operation.ts',{},'',{Error});
test('optional allowed operation executes once and returns scheduled evidence',async()=>{let n=0;const r=await run(async()=>{n++;return {id:'f1'};});assert.equal(n,1);assert.equal(r.status,'scheduled');assert.equal(r.result.id,'f1');});
test('Plus gate prevents operation without aborting permitted core reply',async()=>{const error=new Error('Plus is required for this feature.');error.name='FluxFeatureGateError';const r=await run(async()=>{throw error;});assert.equal(r.status,'unavailable');assert.equal(r.errorCode,'feature_not_entitled');assert.equal(r.result,undefined);});
test('unexpected optional failure is explicit and no false activation is returned',async()=>{const r=await run(async()=>{throw new Error('scheduler unavailable');});assert.equal(r.status,'failed');assert.equal(r.errorCode,'optional_operation_failed');});
