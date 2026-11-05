import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import load from './helpers/load-typescript.cjs';
const dirname=path.dirname(fileURLToPath(import.meta.url));const api=load(path.resolve(dirname,'../lib/hotel-booking-contract.ts'));
test('hotel amounts use exact integer minor units and the chosen currency precision',()=>{
 assert.equal(api.parseHotelAmount('10.25','NGN'),'1025');assert.equal(api.parseHotelAmount('100','JPY'),'100');assert.equal(api.parseHotelAmount('1.234','BHD'),'1234');
 for(const amount of ['1.234','-1','0','1e3','1,000'])assert.throws(()=>api.parseHotelAmount(amount,'NGN'));
 assert.equal(api.parseHotelAmount('0','NGN',true),'0');assert.equal(api.hotelAmountInput('1234','BHD'),'1.234');
});
test('stay dates validate real calendar days and use checkout-exclusive night counts',()=>{
 assert.equal(api.isCalendarDate('2026-02-30'),false);assert.equal(api.isCalendarDate('2028-02-29'),true);assert.equal(api.stayNights('2026-12-01','2026-12-03'),2);
 assert.equal(api.hotelQuotedTotal({arrival_date:'2026-12-01',departure_date:'2026-12-03',nightly_rate_minor:'10025'}).toString(),'20050');
 assert.equal(api.hotelQuotedTotal({arrival_date:null,departure_date:null,nightly_rate_minor:null}),null);
});
