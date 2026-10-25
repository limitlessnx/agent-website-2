import test from "node:test";
import assert from "node:assert/strict";
import {
  createLimitlessHumanHandoff,
  summarizeCrmMessages,
} from "../lib/ai/limitless-handoff-policy.mjs";

const ORG = "b15f21b4-5697-4d21-9421-8a34eae3476d";
const baseInput = {
  organizationId: ORG,
  customerId: "customer-1",
  conversationId: "conversation-1",
  sourceAgentId: "agent-1",
  reason: "Customer requested a supervisor for title documentation.",
  category: "documentation",
  priority: "high",
  summary: null,
  nextAction: "Review title documents with the customer.",
  correlationId: "correlation-1",
};

function makeAdmin({ messages = [], customer = {}, stage = null, preferences = null, handoffs = [], notifications = [] } = {}) {
  const state = { messages, customer, stage, preferences, handoffs, notifications };
  const events = [];
  let handoffSequence = 1;
  let notificationSequence = 1;

  function rowsFor(table, filters) {
    const source = state[table];
    let rows = Array.isArray(source) ? source : (source ? [source] : []);
    for (const [key, value] of filters.entries()) rows = rows.filter((row) => String(row[key]) === String(value));
    return rows;
  }

  function builder(table) {
    const filters = new Map();
    let operation = "select";
    let payload = null;
    let inserted = null;
    let selected = null;
    let orderDescending = false;
    let limitValue = null;

    const query = {
      select(columns) {
        selected = columns;
        return query;
      },
      eq(column, value) {
        filters.set(column, value);
        return query;
      },
      in(column, values) {
        query._in = [column, values];
        return query;
      },
      is(column, value) {
        query._is = [column, value];
        return query;
      },
      order(_column, options = {}) {
        orderDescending = options.ascending === false;
        return query;
      },
      limit(value) {
        limitValue = value;
        return query;
      },
      insert(value) {
        operation = "insert";
        payload = value;
        return query;
      },
      update(value) {
        operation = "update";
        payload = value;
        return query;
      },
      maybeSingle() {
        return execute(true);
      },
      single() {
        return execute(false);
      },
      then(resolve, reject) {
        return execute(false).then(resolve, reject);
      },
      _in: null,
      _is: null,
    };

    async function execute(maybe) {
      try {
        if (operation === "insert") {
          const row = { ...payload, id: payload.id || `${table}-${notificationSequence++}`, created_at: new Date().toISOString() };
          if (table === "human_handoffs") row.id = `handoff-${handoffSequence++}`;
          state[table].push(row);
          inserted = row;
          events.push({ type: "insert", table, row });
          return { data: selected ? { id: row.id, ...row } : row, error: null };
        }
        if (operation === "update") {
          const matches = rowsFor(table, filters);
          for (const row of matches) Object.assign(row, payload);
          events.push({ type: "update", table, payload, count: matches.length });
          return { data: matches[0] || null, error: null };
        }
        let rows = rowsFor(table, filters);
        if (query._in) rows = rows.filter((row) => query._in[1].includes(row[query._in[0]]));
        if (query._is) rows = rows.filter((row) => query._is[1] === null ? row[query._is[0]] == null : row[query._is[0]] === query._is[1]);
        if (orderDescending) rows = [...rows].reverse();
        if (limitValue != null) rows = rows.slice(0, limitValue);
        const data = maybe ? rows[0] || null : rows;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    }

    return query;
  }

  return {
    state,
    events,
    from(table) {
      if (table === "crm_messages") return builder("messages");
      if (table === "crm_customers") return builder("customer");
      if (table === "organization_customer_stages") return builder("stage");
      if (table === "human_handoffs") return builder("handoffs");
      if (table === "handoff_notifications") return builder("notifications");
      if (table === "organization_member_notification_preferences") return builder("preferences");
      throw new Error(`Unexpected table ${table}`);
    },
    async rpc(name, args) {
      events.push({ type: "rpc", name, args });
      if (name !== "create_real_estate_handoff_once") throw new Error(`Unexpected RPC ${name}`);
      const existing = state.handoffs.find(row => row.organization_id === args.p_organization_id && row.conversation_id === args.p_conversation_id && (row.correlation_id === args.p_correlation_id || ["open","assigned","in_progress","waiting_customer"].includes(row.status)));
      if (existing) return { data: {handoffId:existing.id,created:false},error:null };
      const row = {
        id: `handoff-${handoffSequence++}`,
        organization_id: args.p_organization_id,
        conversation_id: args.p_conversation_id,
        correlation_id: args.p_correlation_id,
        status: "open",
        assigned_membership_id: null,
        reason: args.p_reason,
        conversation_summary: null,
        created_at: new Date().toISOString(),
      };
      state.handoffs.push(row);
      return { data: {handoffId:row.id,created:true}, error: null };
    },
  };
}

const assignment = {
  membershipId: "membership-1",
  destinationPhone: null,
  notifyWhatsApp: true,
  notifyDashboard: true,
  source: "assignment_rule",
};

function eventTypes(admin) {
  return admin.events.map((event) => event.type === "rpc" ? "rpc" : `${event.type}:${event.table}`);
}

test("Limitless derives a concise CRM summary, persists before delivery, and reports persisted sent state", async () => {
  const admin = makeAdmin({
    messages: [
      { organization_id: ORG, conversation_id: baseInput.conversationId, direction: "inbound", content: "I need help confirming the title for the property.", created_at: "2026-10-24T09:00:00Z" },
      { organization_id: ORG, conversation_id: baseInput.conversationId, direction: "outbound", content: "I can connect you with a supervisor.", created_at: "2026-10-24T09:01:00Z" },
    ],
    customer: { organization_id: ORG, id: baseInput.customerId, full_name: "Ada Buyer", phone: "+234 801 222 3333", current_stage_id: "stage-1" },
    stage: { organization_id: ORG, id: "stage-1", name: "Qualified" },
    preferences: {
      organization_id: ORG,
      membership_id: "membership-1",
      whatsapp_phone: "+234 801 222 3333",
      notify_whatsapp_handoffs: true,
    },
  });
  let sendCount = 0;
  const result = await createLimitlessHumanHandoff({
    admin,
    input: baseInput,
    assignment,
    sendWhatsAppMessage: async (payload) => {
      sendCount += 1;
      assert.match(payload.text, /Customer: I need help confirming the title/);
      return { providerMessageId: "provider-1" };
    },
  });

  assert.equal(result.duplicate, false);
  assert.equal(result.conversationPaused, true);
  assert.equal(result.notificationStatus, "sent");
  assert.equal(result.notificationError, null);
  assert.equal(result.notificationRecipient, "2348012223333");
  assert.equal(result.missingDestination, false);
  assert.equal(sendCount, 1);
  assert.equal(admin.state.handoffs[0].conversation_summary.startsWith("Customer:"), true);
  assert.equal(admin.state.notifications.at(-1).status, "sent");
  assert.equal(admin.state.notifications.at(-1).provider_message_id, "provider-1");
  assert.ok(eventTypes(admin).indexOf("rpc") < eventTypes(admin).indexOf("insert:notifications"));
});

test("duplicate correlation and conversation return the persisted notification without auto-resending", async () => {
  const admin = makeAdmin({
    customer: { full_name: "Ada Buyer", phone: "2348012223333", current_stage_id: null },
    handoffs: [{
      id: "handoff-existing",
      organization_id: ORG,
      conversation_id: baseInput.conversationId,
      correlation_id: baseInput.correlationId,
      status: "open",
      assigned_membership_id: "membership-1",
      reason: baseInput.reason,
      conversation_summary: "Existing persisted handoff summary.",
      created_at: "2026-10-24T09:00:00Z",
    }],
    notifications: [{
      id: "notification-existing",
      organization_id: ORG,
      handoff_id: "handoff-existing",
      channel: "whatsapp",
      status: "failed",
      error_message: "Outside the WhatsApp service window.",
      recipient: "2348012223333",
      created_at: "2026-10-24T09:01:00Z",
    }],
  });
  let sendCount = 0;
  const result = await createLimitlessHumanHandoff({
    admin,
    input: baseInput,
    assignment,
    sendWhatsAppMessage: async () => { sendCount += 1; return { providerMessageId: "must-not-send" }; },
  });

  assert.equal(result.duplicate, true);
  assert.equal(result.handoffId, "handoff-existing");
  assert.equal(result.notificationStatus, "failed");
  assert.equal(result.notificationError, "Outside the WhatsApp service window.");
  assert.equal(sendCount, 0);
  assert.equal(admin.events.some((event) => event.type === "rpc"), false);
});

test("delivery failure is persisted and never reported as delivered", async () => {
  const admin = makeAdmin({
    customer: { organization_id: ORG, id: baseInput.customerId, full_name: "Ada Buyer", phone: "2348012223333", current_stage_id: null },
    preferences: { organization_id: ORG, membership_id: "membership-1", whatsapp_phone: "2348012223333", notify_whatsapp_handoffs: true },
  });
  const result = await createLimitlessHumanHandoff({
    admin,
    input: { ...baseInput, correlationId: "correlation-failure" },
    assignment,
    sendWhatsAppMessage: async () => { throw new Error("provider rejected handoff"); },
  });

  assert.equal(result.notificationStatus, "failed");
  assert.equal(result.notificationError, "provider rejected handoff");
  assert.equal(result.notificationStatus === "delivered", false);
  assert.equal(admin.state.handoffs[0].notified_at, undefined);
  assert.equal(admin.state.notifications.at(-1).status, "failed");
});

test("unassigned Limitless handoff is safely returned with an explicit missing destination", async () => {
  const admin = makeAdmin({
    customer: { full_name: "Queue Customer", phone: null, current_stage_id: null },
    messages: [],
  });
  let sendCount = 0;
  const result = await createLimitlessHumanHandoff({
    admin,
    input: { ...baseInput, correlationId: "correlation-queue" },
    assignment: { membershipId: null, destinationPhone: null, notifyWhatsApp: false, notifyDashboard: true, source: "unassigned_queue" },
    sendWhatsAppMessage: async () => { sendCount += 1; return {}; },
  });

  assert.equal(result.status, "open");
  assert.equal(result.conversationPaused, true);
  assert.equal(result.notificationStatus, "unassigned");
  assert.equal(result.missingDestination, true);
  assert.match(result.notificationError, /No WhatsApp notification destination/);
  assert.equal(sendCount, 0);
  assert.equal(admin.state.notifications.length, 0);
});

test("summary helper keeps speaker labels and bounds each message", () => {
  const summary = summarizeCrmMessages([{ direction: "inbound", content: "A".repeat(1000) }], "fallback");
  assert.match(summary, /^Customer: /);
  assert.ok(summary.length <= 2800);
});

test("concurrent calls create one canonical handoff and submit at most one notification", async () => {
  const admin=makeAdmin({customer:{organization_id:ORG,id:baseInput.customerId,full_name:"Test",phone:"234000000000",current_stage_id:null},preferences:{organization_id:ORG,membership_id:"membership-1",whatsapp_phone:"234000000000",notify_whatsapp_handoffs:true}});
  let sent=0; const send=async()=>{sent++;return{providerMessageId:"test-provider"};};
  const results=await Promise.all([1,2].map(()=>createLimitlessHumanHandoff({admin,input:baseInput,assignment,sendWhatsAppMessage:send})));
  assert.equal(admin.state.handoffs.length,1);assert.equal(sent,1);assert.ok(results.some(r=>r.duplicate));
});
