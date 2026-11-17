/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const css = fs.readFileSync('components/ui/dashboard-foundation.css', 'utf8');
function color(name) {
  const value = css.match(new RegExp(`--fk-${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  assert.ok(value, `Missing semantic color ${name}`);
  return value.slice(1).match(/../g).map(hex => parseInt(hex,16)/255);
}
function luminance(rgb) {
  const linear = rgb.map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  return linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
}
function ratio(a,b) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
test('shared dashboard text and status colors meet WCAG AA on their surfaces',()=>{
  for(const foreground of ['text','text-secondary','text-muted','success','warning','danger','info']){
    for(const background of ['canvas','surface','surface-raised','surface-overlay']){
      const contrast=ratio(color(foreground),color(background));
      assert.ok(contrast>=4.5,`${foreground} on ${background}: ${contrast.toFixed(2)} is below 4.5`);
    }
  }
  assert.ok(ratio([1,1,1],color('brand'))>=4.5,'Primary action text contrast');
  assert.ok(ratio(color('focus'),color('input'))>=3,'Focus indicator contrast');
});
