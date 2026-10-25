const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function databaseFixture() {
  const state = {
    real_estate_estates: [
      { id: 'estate-a', organization_id: 'tenant-a', name: 'A Estate', description: 'A', location: 'Lagos', address: 'A address', contact_name: 'A contact', contact_email: 'a@example.test', contact_phone: '+234', status: 'published', cover_image_url: null, payment_terms: {}, operating_instructions: 'Call the office during business hours.', terms_of_service: 'Reservations require written confirmation.', knowledge_status: 'approved', provenance: {}, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'estate-b', organization_id: 'tenant-b', name: 'B Estate', description: 'B', location: 'Abuja', address: 'B address', contact_name: 'B contact', contact_email: 'b@example.test', contact_phone: '+234', status: 'published', cover_image_url: null, payment_terms: {}, operating_instructions: null, terms_of_service: null, knowledge_status: 'approved', provenance: {}, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ],
    properties: [
      { id: 'property-a', organization_id: 'tenant-a', title: 'A Villa', type: 'villa', location_city: 'Lagos', location_area: 'Lekki', price: 100, status: 'active', features: [], description: 'A', drive_photos_link: null, drive_brochure_link: null, image_urls: ['a.jpg'], cover_image_url: 'a-cover.jpg', estate_id: null, updated_at: '2026-01-01' },
      { id: 'property-b', organization_id: 'tenant-b', title: 'B Villa', type: 'villa', location_city: 'Abuja', location_area: 'Maitama', price: 200, status: 'active', features: [], description: 'B', drive_photos_link: null, drive_brochure_link: null, image_urls: ['b.jpg'], cover_image_url: 'b-cover.jpg', estate_id: null, updated_at: '2026-01-01' },
    ],
    real_estate_estate_faqs: [],
  };

  function matches(row, filters) {
    return filters.every(([key, value]) => row[key] === value);
  }

  function builder(table) {
    const query = {
      operation: 'select', payload: null, filters: [], orderings: [], limitValue: null, singleMode: null,
      select() { return this; },
      eq(key, value) { this.filters.push([key, value]); return this; },
      order(key, options = {}) { this.orderings.push([key, options]); return this; },
      limit(value) { this.limitValue = value; return this; },
      update(payload) { this.operation = 'update'; this.payload = payload; return this; },
      insert(payload) { this.operation = 'insert'; this.payload = payload; return this; },
      delete() { this.operation = 'delete'; return this; },
      maybeSingle() { this.singleMode = 'maybe'; return this; },
      single() { this.singleMode = 'single'; return this; },
      then(resolve, reject) { try { resolve(this.execute()); } catch (error) { reject(error); } },
      execute() {
        const rows = state[table];
        let result;
        if (this.operation === 'select') {
          result = rows.filter((row) => matches(row, this.filters));
        } else if (this.operation === 'update') {
          result = rows.filter((row) => matches(row, this.filters)).map((row) => Object.assign(row, clone(this.payload)));
        } else if (this.operation === 'insert') {
          const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
          result = inputs.map((input, index) => {
            const row = Object.assign({ id: `${table}-new-${rows.length + index}`, created_at: '2026-02-01', updated_at: '2026-02-01' }, clone(input));
            rows.push(row);
            return row;
          });
        } else {
          result = rows.filter((row) => matches(row, this.filters));
          state[table] = rows.filter((row) => !matches(row, this.filters));
        }
        for (const [key, options] of [...this.orderings].reverse()) {
          result.sort((left, right) => {
            const a = left[key] ?? '';
            const b = right[key] ?? '';
            const comparison = a < b ? -1 : a > b ? 1 : 0;
            return options.ascending === false ? -comparison : comparison;
          });
        }
        if (this.limitValue !== null) result = result.slice(0, this.limitValue);
        if (this.singleMode) return { data: this.singleMode === 'maybe' ? (result[0] || null) : result[0], error: null };
        return { data: result, error: null };
      },
    };
    return query;
  }

  const auditEvents=[];
  async function rpc(name,args){
    const org=args.p_organization_id,actor=args.p_actor_id;
    if(!actor)return{data:null,error:new Error('Authenticated audit actor is required')};
    let row=null;
    if(name==='save_real_estate_estate_with_audit'){
      const rows=state.real_estate_estates;row=args.p_estate_id?rows.find(x=>x.id===args.p_estate_id&&x.organization_id===org):null;
      if(args.p_estate_id&&!row)return{data:null,error:new Error('Estate was not found in this organization')};
      if(row)Object.assign(row,clone(args.p_payload));else{row=Object.assign({id:`estate-new-${rows.length+1}`,organization_id:org,created_at:'2026-02-01',updated_at:'2026-02-01'},clone(args.p_payload));rows.push(row);}
    }else if(name==='save_real_estate_estate_faq_with_audit'){
      if(!state.real_estate_estates.some(x=>x.id===args.p_estate_id&&x.organization_id===org))return{data:null,error:new Error('Estate was not found in this organization')};
      const rows=state.real_estate_estate_faqs;row=args.p_faq_id?rows.find(x=>x.id===args.p_faq_id&&x.estate_id===args.p_estate_id&&x.organization_id===org):null;
      if(args.p_faq_id&&!row)return{data:null,error:new Error('FAQ was not found in this estate and organization')};
      if(row)Object.assign(row,clone(args.p_payload));else{row=Object.assign({id:`faq-new-${rows.length+1}`,organization_id:org,estate_id:args.p_estate_id,created_at:'2026-02-01',updated_at:'2026-02-01'},clone(args.p_payload));rows.push(row);}
    }else if(name==='delete_real_estate_estate_faq_with_audit'){
      const rows=state.real_estate_estate_faqs,index=rows.findIndex(x=>x.id===args.p_faq_id&&x.estate_id===args.p_estate_id&&x.organization_id===org);if(index<0)return{data:null,error:new Error('FAQ was not found in this estate and organization')};rows.splice(index,1);row=true;
    }else if(name==='assign_real_estate_property_with_audit'){
      const property=state.properties.find(x=>x.id===args.p_property_id&&x.organization_id===org);if(!property)return{data:null,error:new Error('Property was not found in this organization')};if(args.p_estate_id&&!state.real_estate_estates.some(x=>x.id===args.p_estate_id&&x.organization_id===org))return{data:null,error:new Error('Estate was not found in this organization')};property.estate_id=args.p_estate_id;row=property;
    }else if(name==='reorder_real_estate_estate_faqs_with_audit'){const rows=state.real_estate_estate_faqs.filter(x=>x.organization_id===org&&x.estate_id===args.p_estate_id);if(rows.length!==args.p_faq_ids.length||new Set(args.p_faq_ids).size!==rows.length||args.p_faq_ids.some(id=>!rows.some(x=>x.id===id)))return{data:null,error:new Error('FAQ reorder must include exactly the FAQs in this estate')};row=args.p_faq_ids.map((id,sort_order)=>{const faq=rows.find(x=>x.id===id);faq.sort_order=sort_order;return faq;});}else if(name==='link_real_estate_knowledge_source_with_audit')row=true;
    auditEvents.push({name,actor,organization_id:org});return{data:row,error:null};
  }
  return { state, auditEvents, admin: { from: (table) => builder(table), rpc } };
}

function catalogModule(db) {
  return load('lib/real-estate-catalog.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => db.admin },
  });
}

test('assignment is tenant-bound, changes only estate_id, and never duplicates a canonical property', async () => {
  const db = databaseFixture();
  const catalog = catalogModule(db);
  const assigned = await catalog.assignPropertyToEstate('tenant-a', 'property-a', 'estate-a', 'operator-a');
  assert.equal(assigned.estate_id, 'estate-a');
  assert.equal(db.state.properties.filter((row) => row.id === 'property-a').length, 1);
  assert.equal(db.state.properties.find((row) => row.id === 'property-a').image_urls[0], 'a.jpg');

  await catalog.assignPropertyToEstate('tenant-a', 'property-a', null, 'operator-a');
  assert.equal(db.state.properties.find((row) => row.id === 'property-a').estate_id, null);
  assert.equal(db.state.properties.find((row) => row.id === 'property-a').title, 'A Villa');
  await assert.rejects(catalog.assignPropertyToEstate('tenant-a', 'property-b', 'estate-a', 'operator-a'), /Property was not found in this organization/);
  assert.equal(db.state.properties.find((row) => row.id === 'property-b').estate_id, null);
});

test('FAQ CRUD validates the tenant estate and reorder requires the exact FAQ set', async () => {
  const db = databaseFixture();
  const catalog = catalogModule(db);
  const first = await catalog.saveEstateFaq('tenant-a', 'estate-a', { question: 'When is handover?', answer: 'After completion.', category: 'process', sort_order: 0 }, 'operator-a');
  const second = await catalog.saveEstateFaq('tenant-a', 'estate-a', { question: 'Is there parking?', answer: 'Yes.', category: 'amenities', sort_order: 1 }, 'operator-a');
  await assert.rejects(catalog.saveEstateFaq('tenant-a', 'estate-b', { question: 'Cross-tenant', answer: 'No' }, 'operator-a'), /Estate was not found in this organization/);
  await assert.rejects(catalog.reorderEstateFaqs('tenant-a', 'estate-a', [first.id, first.id], 'operator-a'), /unique/);

  const reordered = await catalog.reorderEstateFaqs('tenant-a', 'estate-a', [second.id, first.id], 'operator-a');
  assert.equal(JSON.stringify(reordered.map((faq) => [faq.id, faq.sort_order])), JSON.stringify([[second.id, 0], [first.id, 1]]));
  const details = await catalog.getEstate('tenant-a', 'estate-a');
  assert.equal(details.estate.linked_property_count, 0);
  assert.equal(JSON.stringify(details.faqs.map((faq) => faq.id)), JSON.stringify([second.id, first.id]));
  assert.equal(JSON.stringify(details.linkedProperties), JSON.stringify([]));
});

test('cover-only estate update preserves existing approved business fields', async () => {
  const db = databaseFixture();
  const catalog = catalogModule(db);
  const updated = await catalog.saveEstate('tenant-a', {
    id: 'estate-a', name: 'A Estate', cover_image_url: 'new-cover.jpg',
  }, 'operator-a');
  assert.equal(updated.cover_image_url, 'new-cover.jpg');
  const stored = db.state.real_estate_estates.find((estate) => estate.id === 'estate-a');
  assert.equal(stored.operating_instructions, 'Call the office during business hours.');
  assert.equal(stored.terms_of_service, 'Reservations require written confirmation.');
  assert.deepEqual(stored.payment_terms, {});
  assert.equal(stored.knowledge_status, 'approved');
  assert.equal(stored.status, 'published');
  assert.equal(stored.contact_email, 'a@example.test');
});

test('estate save forwards editable terms of service to the audited catalog mutation', async () => {
  const db = databaseFixture();
  const catalog = catalogModule(db);
  const saved = await catalog.saveEstate('tenant-a', {
    name: 'New Estate', terms_of_service: 'Written confirmation is required.',
  }, 'operator-a');
  assert.equal(saved.terms_of_service, 'Written confirmation is required.');
  assert.equal(db.auditEvents.at(-1).name, 'save_real_estate_estate_with_audit');
  assert.equal(db.auditEvents.at(-1).organization_id, 'tenant-a');
});

test('Maia estate tools return only published approved content', async () => {
  const approvedEstate = {
    id: 'estate-a', organization_id: 'tenant-a', name: 'A Estate', description: 'A', location: 'Lagos', address: 'A address',
    contact_name: 'A contact', contact_email: 'a@example.test', contact_phone: '+234', status: 'published', knowledge_status: 'approved',
    cover_image_url: 'cover.jpg', payment_terms: { currency: 'NGN' }, operating_instructions: 'Business guidance', terms_of_service: 'Bookings are subject to estate approval.', updated_at: '2026-02-01',
    linked_property_count: 0,
  };
  const module = load('lib/ai/maia-estate-tools.ts', {
    '@/lib/real-estate-knowledge': {listEstateKnowledgeSources:async()=>[]},
    '@/lib/real-estate-catalog': {
      listEstates: async () => [approvedEstate, { ...approvedEstate, id: 'estate-draft', name: 'Draft Estate', status: 'draft', knowledge_status: 'draft' }],
      getEstate: async () => ({
        estate: approvedEstate,
        linkedProperties: [],
        faqs: [
          { id: 'faq-approved', organization_id: 'tenant-a', estate_id: 'estate-a', question: 'Q1', answer: 'A1', category: 'general', sort_order: 0, updated_at: '2026-02-01' },
        ],
      }),
    },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) }) }) },
  });
  const tools = module.maiaEstateTools();
  const search = await tools.find((tool) => tool.name === 'search_estates').execute({ query: 'Estate' }, { organizationId: 'tenant-a' });
  assert.deepEqual(search.estates.map((estate) => estate.id), ['estate-a']);
  const knowledge = await tools.find((tool) => tool.name === 'get_estate_knowledge').execute({ estateId: 'estate-a' }, { organizationId: 'tenant-a' });
  assert.equal(knowledge.found, true);
  assert.deepEqual(knowledge.faqs.map((faq) => faq.id), ['faq-approved']);
  assert.equal(knowledge.knowledge.find((item) => item.kind === 'terms_of_service').content, 'Bookings are subject to estate approval.');
  assert.match(knowledge.knowledge.find((item) => item.kind === 'terms_of_service').provenance.interpretation, /not legal advice.*contract execution.*transaction authorization/);
  assert.match(knowledge.knowledge.find((item) => item.kind === 'operating_instructions').provenance.interpretation, /not executable/);
});

test('Maia exact-property lookup rejects a cross-tenant property before estate resolution', async () => {
  const module = load('lib/ai/maia-estate-tools.ts', {
    '@/lib/real-estate-knowledge': {listEstateKnowledgeSources:async()=>[]},
    '@/lib/real-estate-catalog': { listEstates: async () => [], getEstate: async () => null },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }) }) }) },
  });
  const tool = module.maiaEstateTools().find((candidate) => candidate.name === 'get_estate_knowledge');
  const result = await tool.execute({ propertyId: 'property-b' }, { organizationId: 'tenant-a' });
  assert.equal(result.found, false);
  assert.equal(result.reason, 'property_not_found_for_tenant');
});

test('Maia resolves a tenant property to its estate and never returns unapproved estate terms', async () => {
  const approvedEstate = { id: 'estate-a', organization_id: 'tenant-a', name: 'A Estate', status: 'published', knowledge_status: 'approved', terms_of_service: 'Written approval is required.', payment_terms: {}, updated_at: '2026-02-01' };
  const draftEstate = { ...approvedEstate, id: 'estate-draft', status: 'draft', knowledge_status: 'draft', terms_of_service: 'Draft terms must stay private.' };
  const module = load('lib/ai/maia-estate-tools.ts', {
    '@/lib/real-estate-knowledge': { listEstateKnowledgeSources: async () => [] },
    '@/lib/real-estate-catalog': {
      listEstates: async () => [approvedEstate],
      getEstate: async (_org, id) => ({ estate: id === 'estate-draft' ? draftEstate : approvedEstate, linkedProperties: [], faqs: [] }),
    },
    '@/lib/supabase/admin': {
      createAdminClient: () => ({
        from: (table) => {
          const filters = {};
          return {
            select() { return this; },
            eq(key, value) { filters[key] = value; return this; },
            maybeSingle: async () => table === 'properties' && filters.organization_id === 'tenant-a' && filters.id === 'property-a'
              ? { data: { id: 'property-a', organization_id: 'tenant-a', title: 'A Villa', estate_id: 'estate-a' }, error: null }
              : { data: null, error: null },
          };
        },
      }),
    },
  });
  const tool = module.maiaEstateTools().find((candidate) => candidate.name === 'get_estate_knowledge');
  const byProperty = await tool.execute({ propertyId: 'property-a' }, { organizationId: 'tenant-a' });
  assert.equal(byProperty.found, true);
  assert.equal(byProperty.lookup.estate_id, 'estate-a');
  assert.equal(byProperty.knowledge.find((item) => item.kind === 'terms_of_service').content, 'Written approval is required.');
  const draft = await tool.execute({ estateId: 'estate-draft' }, { organizationId: 'tenant-a' });
  assert.equal(draft.found, false);
  assert.equal(draft.reason, 'estate_content_not_approved');
});

test('normalized property creation sends the selected estate_id to the canonical properties table', async () => {
  const oldFetch = global.fetch;
  const oldUrl = process.env.LIMITLESS_SUPABASE_URL;
  const oldKey = process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY;
  let requestBody;
  try {
    process.env.LIMITLESS_SUPABASE_URL = 'https://supabase.example.test';
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY = 'fictional-service-key';
    global.fetch = async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, status: 201, json: async () => [{ id: 'property-new', estate_id: 'estate-a' }] };
    };
    const writer = load('lib/limitless-property-write.ts', {}, '', { fetch: global.fetch });
    const rows = await writer.createPropertyNormalized({ title: 'A Villa', price: 100, estate_id: 'estate-a' }, 'tenant-a');
    assert.equal(rows[0].estate_id, 'estate-a');
    assert.equal(requestBody.organization_id, 'tenant-a');
    assert.equal(requestBody.estate_id, 'estate-a');
  } finally {
    global.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.LIMITLESS_SUPABASE_URL; else process.env.LIMITLESS_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY; else process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test('property API rejects cross-tenant estate IDs before writing and accepts an owned estate', async () => {
  async function submit(selectedEstateId, availableEstateId) {
    let writeCall = null;
    const route = load('app/api/limitless/properties/route.ts', {
      'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
      '@/lib/limitless-data': { getProperties: async () => [] },
      '@/lib/limitless-property-write': { createPropertyNormalized: async (payload, organizationId) => { writeCall = { payload, organizationId }; return [{ id: 'property-new', ...payload }]; } },
      '@/lib/admin-auth': { getAdminSession: async () => ({ userId: 'operator-a' }) },
      '@/lib/limitless-api-auth': { requireAutomationApiKey: () => ({ ok: false }) },
      '@/lib/admin-organization-scope': { resolveAdminOrganizationScope: async () => ({ kind: 'system', systemId: 'limitless-realty', organizationId: 'tenant-a', slug: 'limitless-realty' }) },
      '@/lib/supabase-media': { addPropertyImageUrl: async () => {}, uploadPublicMedia: async () => ({}) },
      '@/lib/supabase/admin': {
        createAdminClient: () => ({
          from: () => {
            const filters = {};
            return {
              select() { return this; },
              eq(key, value) { filters[key] = value; return this; },
              maybeSingle: async () => filters.organization_id === 'tenant-a' && filters.id === availableEstateId
                ? { data: { id: availableEstateId }, error: null }
                : { data: null, error: null },
            };
          },
        }),
      },
    });
    const request = {
      headers: { get: () => 'application/json' },
      json: async () => ({ title: 'A Villa', price: '100', location_area: 'Lekki', location_city: 'Lagos', type: 'villa', features: 'Title available', description: 'Property brief', estate_id: selectedEstateId }),
    };
    return { response: await route.POST(request), writeCall };
  }

  const rejected = await submit('estate-b', 'estate-a');
  assert.equal(rejected.response.status, 400);
  assert.equal(rejected.response.body.code, 'invalid_estate_id');
  assert.equal(rejected.writeCall, null);
  const accepted = await submit('estate-a', 'estate-a');
  assert.equal(accepted.response.status, 201);
  assert.equal(accepted.writeCall.organizationId, 'tenant-a');
  assert.equal(accepted.writeCall.payload.estate_id, 'estate-a');
});

test('dashboard visibly links estate creation, terms and FAQs to owning-estate property classification', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const dashboard = read('app/dashboard/real-estate/page.tsx');
  const estateList = read('app/dashboard/real-estate/estates/page.tsx');
  const estateDetail = read('app/dashboard/real-estate/estates/[estateId]/page.tsx');
  const estateForm = read('app/dashboard/real-estate/estates/EstateForm.tsx');
  const propertiesPage = read('app/dashboard/limitless/properties/page.tsx');
  const propertyForm = read('app/dashboard/limitless/properties/NewPropertyForm.tsx');
  const propertyApi = read('app/api/limitless/properties/route.ts');
  const propertyWriter = read('lib/limitless-property-write.ts');
  assert.match(dashboard, /Add estate/);
  assert.match(estateList, /id="new-estate" open/);
  assert.match(estateList, /Manage terms, FAQs & properties/);
  assert.match(estateDetail, /href="#terms-of-service"/);
  assert.match(estateDetail, /href="#faqs"/);
  assert.match(estateForm, /name="terms_of_service"/);
  assert.match(propertiesPage, /Add estate/);
  assert.match(propertyForm, /name="estate_id"/);
  assert.match(propertyApi, /\.eq\("organization_id", scope\.organizationId\)/);
  assert.match(propertyApi, /code: "invalid_estate_id"/);
  assert.ok(propertyApi.indexOf('payload.estate_id = estateId || null;') < propertyApi.indexOf('createPropertyNormalized(payload, scope.organizationId)'));
  assert.match(propertyWriter, /estate_id: payload\.estate_id \? String\(payload\.estate_id\) : null/);
});
