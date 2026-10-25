const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const panel=fs.readFileSync(path.resolve(__dirname,'../app/portal/notifications/HumanOperationsPanel.tsx'),'utf8');
const page=fs.readFileSync(path.resolve(__dirname,'../app/portal/notifications/page.tsx'),'utf8');

test('retry controls are restricted to the server-verified active real-estate tenant and handoff managers',()=>{
 assert.match(page,/resolveActiveRealEstateOrganization\(createAdminClient\(\),session\.organizationId\)/);
 assert.match(page,/canRetryHandoffNotifications=Boolean\(/);
 assert.match(panel,/canRetryHandoffNotifications&&canManageHandoffs/);
});

test('only definitive failed provider errors can open a two-step staff-only retry preview',()=>{
 assert.match(panel,/whatsapp_notification_status==="failed"&&!item\.whatsapp_notification_fallback_attempted&&item\.whatsapp_notification_error_code/);
 assert.match(panel,/whatsapp_notification_error_code!=="131047"/);
 assert.match(panel,/Do not retry a free-form message; use the approved staff template fallback/);
 assert.match(panel,/template fallback was already attempted; verify delivery manually/);
 assert.match(panel,/action:"prepare"/);
 assert.match(panel,/action:"confirm"/);
 assert.match(panel,/Confirm and resend to staff/);
 assert.match(panel,/This sends only to staff, not to the customer/);
 assert.match(panel,/retryPreview\.recipientPreview/);
 assert.match(panel,/retryPreview\.message/);
});

test('ambiguous provider status is rendered as manual verification, not automatic retry',()=>{
 assert.match(panel,/Verify delivery manually; do not retry this notification/);
 assert.match(panel,/whatsapp_notification_status\?item\.whatsapp_notification_status\.replaceAll/);
});
