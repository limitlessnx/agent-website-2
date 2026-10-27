const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

function response(data) {
  return { ok: true, status: 200, json: async () => data, text: async () => '' };
}

test('Maia resolves image media assets from tenant-scoped property records, including extensionless storage paths', async () => {
  const oldUrl = process.env.LIMITLESS_SUPABASE_URL;
  const oldKey = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY;
  process.env.LIMITLESS_SUPABASE_URL = 'https://project.supabase.co';
  process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/rest/v1/properties?')) {
      return response([{
        id: 'property-1',
        title: 'Iwinosa Mega City',
        cover_image_url: null,
        image_urls: [],
        drive_photos_link: 'https://drive.google.com/drive/folders/catalog-folder',
      }]);
    }
    if (String(url).includes('/rest/v1/media_assets?')) {
      return response([
        { storage_bucket: 'property-media', storage_path: 'org-a/property-1/cover', mime_type: 'image/jpeg' },
        { storage_bucket: 'property-media', storage_path: 'org-a/property-1/gallery.png', mime_type: 'image/png' },
        { storage_bucket: 'property-media', storage_path: 'org-a/property-1/clip.mp4', mime_type: 'video/mp4' },
      ]);
    }
    throw new Error('Unexpected URL: ' + url);
  };
  try {
    const api = load(path.resolve(__dirname, '../lib/whatsapp-delivery.ts'), {
      '@/lib/supabase/admin': { createAdminClient: () => ({}) },
      '@/lib/twilio-whatsapp': { sendTwilioWhatsAppMessage: async () => ({}) },
    }, '', { fetch: fakeFetch, URL });
    const result = await api.resolvePropertyMediaFromText('org-a', 'Please send photos for Iwinosa Mega City.');
    assert.ok(calls[0].includes('organization_id=eq.org-a'), 'property lookup must be scoped to the tenant');
    assert.equal(result.images.length, 2);
    assert.ok(result.images.every((url) => url.startsWith('https://project.supabase.co/storage/v1/object/public/property-media/')));
    assert.ok(result.images.some((url) => url.endsWith('/org-a/property-1/cover')));
    assert.equal(result.videos.length, 1);
  } finally {
    if (oldUrl === undefined) delete process.env.LIMITLESS_SUPABASE_URL;
    else process.env.LIMITLESS_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY;
    else process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test('Maia removes raw Supabase storage object URLs from customer-facing text', () => {
  const api = load(path.resolve(__dirname, '../lib/whatsapp-delivery.ts'), {
    '@/lib/supabase/admin': { createAdminClient: () => ({}) },
    '@/lib/twilio-whatsapp': { sendTwilioWhatsAppMessage: async () => ({}) },
  });
  const cleaned = api.removeInlineStorageObjectUrls('Here are the photos: https://project.supabase.co/storage/v1/object/public/property-media/photo.jpg Please let me know.');
  assert.equal(cleaned, 'Here are the photos: Please let me know.');
  assert.equal(api.removeInlineStorageObjectUrls('No image links here.'), 'No image links here.');
});
