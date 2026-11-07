const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const modulePath=path.resolve(__dirname,'../lib/estate-brief-campaign.ts');
const estate=load(modulePath,{
  '@/lib/limitless-data':{},
  '@/lib/whatsapp-message-normalizer':load(path.resolve(__dirname,'../lib/whatsapp-message-normalizer.ts')),
}, '', { URL });
test('estate brief template selling point is normalized to a single line',()=>{
  const result=estate.buildEstateBriefCampaign({
    id:'property-1',title:'Iwinosa Mega City',location_area:'Okome Community',location_city:'Benin City',price:'750000',
    drive_photos_link:'https://cdn.example.test/estate.jpg',
  },'25% OFF EMBER PROMO\n\n50 × 100 ft\t₦1,000,000\n🔥 Ends 20th November');
  assert.equal(result.sellingPoint,'25% OFF EMBER PROMO 50 × 100 ft ₦1,000,000 🔥 Ends 20th November');
  assert.equal(/[\r\n\t]/.test(result.sellingPoint),false);
  assert.equal(/ {2,}/.test(result.sellingPoint),false);
});
test('estate brief template removes control characters and retains meaningful text',()=>{
  const result=estate.buildEstateBriefCampaign({
    id:'property-1',title:'Iwinosa Mega City',location_area:'Okome Community',location_city:'Benin City',price:'750000',
    drive_photos_link:'https://cdn.example.test/estate.jpg',
  },'Promo\u0000 details\u001f here');
  assert.equal(result.sellingPoint,'Promo details here');
});
