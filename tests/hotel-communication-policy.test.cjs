const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const policy = load(path.resolve(__dirname, '../lib/hotel-communication-policy.ts'));
const guest = { organization_id: 'hotel-a', customer_id: 'guest', marketing_consent: 'opted_in', service_consent: 'opted_in', opted_out: false, human_handoff: false };
const booking = { id: 'booking', organization_id: 'hotel-a', customer_id: 'guest', status: 'enquiry', revision: 1 };
test('hotel detection leaves real estate and Xposure policies unchanged', () => {
  assert.equal(policy.isHotelOrganization({metadata:{industry_slug:'hotel'}}), true);
  assert.equal(policy.isHotelOrganization({metadata:{industry:'hospitality'}}), true);
  for (const industry of ['real-estate','photography','studio','']) assert.equal(policy.isHotelOrganization({metadata:{industry}}), false);
});
test('manual hotel campaign audiences cannot bypass consent, opt-out, handover or active bookings', () => {
  assert.equal(policy.hotelCampaignSuppression('hotel-a', guest, []), null);
  for (const [patch, reason] of [[{marketing_consent:'unknown'}, 'marketing_consent_required'], [{opted_out:true},'opted_out'], [{human_handoff:true},'human_handoff']]) assert.equal(policy.hotelCampaignSuppression('hotel-a', {...guest,...patch}, []), reason);
  assert.equal(policy.hotelCampaignSuppression('hotel-b', guest, []), 'missing_guest');
  for (const status of ['confirmed','checked_in']) assert.equal(policy.hotelCampaignSuppression('hotel-a',guest,[{...booking,status}]),'active_booking');
});
test('follow-up policies are purpose-specific and revision/tenant/customer bound', () => {
  const input = {organizationId:'hotel-a', customerId:'guest', guest, booking, bookingRevision:1, purpose:'booking_recovery'};
  assert.equal(policy.hotelFollowupSuppression(input),null);
  for (const status of ['confirmed','checked_in','checked_out','cancelled','expired']) assert.equal(policy.hotelFollowupSuppression({...input,booking:{...booking,status}}),'booking_state_ineligible');
  assert.equal(policy.hotelFollowupSuppression({...input,booking:{...booking,revision:2}}),'booking_changed');
  assert.equal(policy.hotelFollowupSuppression({...input,booking:{...booking,organization_id:'hotel-b'}}),'booking_scope_mismatch');
  assert.equal(policy.hotelFollowupSuppression({...input,booking:{...booking,customer_id:'other'}}),'booking_scope_mismatch');
  assert.equal(policy.hotelFollowupSuppression({...input,guest:{...guest,service_consent:'unknown'}}),'service_consent_required');
  assert.equal(policy.hotelFollowupSuppression({...input,purpose:'pre_arrival',booking:{...booking,status:'confirmed'}}),null);
  assert.equal(policy.hotelFollowupSuppression({...input,purpose:'post_stay',booking:{...booking,status:'checked_out'}}),null);
  assert.equal(policy.hotelFollowupSuppression({...input,purpose:'unknown'}),'booking_state_ineligible');
});
test('24h boundary fails closed for missing, future and invalid inbound timestamps', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  for (const value of [null,'invalid','2026-11-04T12:00:01Z','2026-11-03T12:00:00Z']) assert.equal(policy.withinWhatsAppWindow(value,now),false);
  assert.equal(policy.withinWhatsAppWindow('2026-11-03T12:00:00.001Z',now),true);
});
