const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const api=load(path.resolve(__dirname,'../lib/property-campaign-message.ts'),{},'',{URL});
const listing={id:'listing-1',organization_id:'org-1',title:'Four bedroom duplex',location_area:'Sabon Lugbe',location_city:'Abuja',price:'N50,000,000',type:'duplex',status:'active',features:'One-room BQ',description:'Verified listing details'};

test('property campaign produces exactly three content variables and a fourth-party human verification prompt',()=>{
 const result=api.buildPropertyCampaignContent(listing,'Main update\n\nSupporting details\n\nReply MORE INFO for assistance.');
 const paragraphs=result.message.split(/\n\s*\n/);
 assert.equal(paragraphs.length,3);
 assert.equal(paragraphs[0],'Main update');
 assert.match(paragraphs[1],/Four bedroom duplex/);
 assert.match(paragraphs[1],/N50,000,000/);
 assert.match(paragraphs[1],/Supporting details/);
 assert.equal(paragraphs[2],'Reply MORE INFO for assistance.');
 assert.match(result.replyInstruction,/re-verify availability/);
});

test('property campaign uses a conservative prompt when copy has no explicit reply instruction',()=>{
 const result=api.buildPropertyCampaignContent(listing,'Market update');
 assert.match(result.message,/Sabon Lugbe, Abuja/);
 assert.match(result.message,/verify current availability/);
});

test('inactive, sold, or unverified listings cannot be promoted',()=>{
 for(const status of ['', 'sold', 'inactive', 'draft', 'archived']) assert.throws(()=>api.buildPropertyCampaignContent({...listing,status},'Update'),/Only active or available/);
});

test('media URL must be public HTTPS without credentials or private hosts',()=>{
 assert.equal(api.buildPropertyCampaignContent(listing,'Update','https://cdn.example.com/image.jpg').mediaUrl,'https://cdn.example.com/image.jpg');
 for(const url of ['http://cdn.example.com/image.jpg','https://localhost/image.jpg','https://127.0.0.1/x','https://user:pass@cdn.example.com/x','https://host.local/x']) assert.throws(()=>api.buildPropertyCampaignContent(listing,'Update',url),/public HTTPS/);
});
