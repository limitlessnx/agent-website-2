const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('real-estate operations links to the permission-gated human handover queue', () => {
  const operations = fs.readFileSync('app/dashboard/real-estate/operations/page.tsx', 'utf8');
  const queuePage = fs.readFileSync('app/portal/notifications/page.tsx', 'utf8');
  const panel = fs.readFileSync('app/portal/notifications/HumanOperationsPanel.tsx', 'utf8');

  assert.match(operations, /href="\/portal\/notifications">Human operations & handovers<\/Link>/);
  assert.match(queuePage, /HumanOperationsPanel/);
  assert.match(panel, /permissions\.includes\("handoffs\.manage"\)/);
  assert.match(panel, /whatsapp_notification_status/);
  assert.match(panel, /action:"claim"/);
  assert.match(panel, /action:"assign"/);
  assert.match(panel, /action:"resolve"/);
});
