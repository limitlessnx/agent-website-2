/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');

function fixture() {
  const frames = new Map();
  let sequence = 0, cleanup;
  const calls = [];
  class Element {
    isConnected = true;
    focus(options) { calls.push({element:this,options}); document.activeElement = this; }
  }
  const trigger = new Element(), inside = new Element(), outside = new Element();
  const document = {activeElement:trigger,body:new Element(),addEventListener(){},removeEventListener(){}};
  const dialog = Object.assign(new Element(), {contains:element=>element===inside,querySelectorAll:()=>[]});
  const {useDialogFocusTrap} = load('components/admin/useDialogFocusTrap.ts', {
    react:{useRef:value=>({current:value}),useEffect:effect=>{const result=effect();if(result)cleanup=result;}},
  }, '', {
    document,HTMLElement:Element,
    requestAnimationFrame:callback=>{frames.set(++sequence,callback);return sequence;},
    cancelAnimationFrame:id=>frames.delete(id),
  });
  useDialogFocusTrap(true,{current:dialog},()=>{});
  return {document,trigger,inside,outside,calls,close:()=>cleanup(),frame:()=>{for(const [id,callback] of frames){frames.delete(id);callback();}}};
}

test('closing an overlay returns abandoned focus without scrolling the page',()=>{
  const f=fixture();f.document.activeElement=f.document.body;f.close();f.frame();
  assert.equal(f.document.activeElement,f.trigger);assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.preventScroll,true);
});
test('a delayed close cannot steal focus from subsequent keyboard navigation',()=>{
  const f=fixture();f.document.activeElement=f.inside;f.close();f.document.activeElement=f.outside;f.frame();
  assert.equal(f.document.activeElement,f.outside);assert.equal(f.calls.length,0);
});
test('native dialog focus return is not repeated after the user can continue',()=>{
  const f=fixture();f.close();f.frame();assert.equal(f.document.activeElement,f.trigger);assert.equal(f.calls.length,0);
});
test('an unmounted trigger is never focused by a delayed return',()=>{
  const f=fixture();f.document.activeElement=f.document.body;f.trigger.isConnected=false;f.close();f.frame();assert.equal(f.calls.length,0);
});
