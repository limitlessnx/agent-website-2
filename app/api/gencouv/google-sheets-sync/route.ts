import { NextResponse } from "next/server";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

const GENCOUV_ORG_ID = "05737e03-f8f0-4202-8e9b-0a8982a1091c";

function text(value: unknown, max = 5000) {
  return value == null ? "" : String(value).trim().slice(0, max);
}

function stageFor(row: Record<string, unknown>) {
  const raw = text(row.lead_status || row.stage || row.lifecycle_status, 80).toLowerCase();
  if (["qualified", "nurture", "support_only", "human_review", "onboarding", "onboarded", "lost"].includes(raw)) return raw;
  return row.qualified === true || text(row.qualified).toLowerCase() === "true" ? "qualified" : "new";
}

export async function POST(request: Request) {
  const expected = process.env.GENCOUV_SHEETS_SYNC_SECRET || process.env.GENCOUV_DASHBOARD_SECRET;
  const supplied = request.headers.get("x-gencouv-sync-secret");
  if (expected && supplied !== expected) {
    return NextResponse.json({ success: false, message: "Invalid sync secret." }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  let runId: string | undefined;

  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 2000) : [];
    const runRows = await supabaseServerRequest<any[]>("gencouv_sync_runs", {
      method: "POST",
      body: JSON.stringify({
        organization_id: GENCOUV_ORG_ID,
        source: "google_sheets",
        direction: "inbound",
        status: "running",
        records_read: rows.length,
        records_written: 0,
        records_failed: 0,
        started_at: startedAt,
        metadata: { spreadsheet_id: body.spreadsheet_id || null, sheet_name: body.sheet_name || null },
      }),
    });
    runId = runRows[0]?.id;

    let written = 0;
    let failed = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const externalId = text(row.session_id || row.id || row.row_number || `${body.sheet_name || "sheet"}:${index + 2}`, 300);
      try {
        const mapRows = await supabaseServerRequest<any[]>(
          `gencouv_external_record_map?select=id,local_entity_id&organization_id=eq.${GENCOUV_ORG_ID}&source=eq.google_sheets&external_record_id=eq.${encodeURIComponent(externalId)}&limit=1`,
        );
        const existingMap = mapRows[0];
        const payload = {
          organization_id: GENCOUV_ORG_ID,
          source: text(row.source, 120) || "google_sheets",
          stage: stageFor(row),
          score: row.qualified === true || text(row.qualified).toLowerCase() === "true" ? 80 : 30,
          value_estimate: Number(row.capital || row.available_capital_usd || 0) || null,
          currency: "USD",
          summary: text(row.summary || row.message || row.main_question, 2000),
          details: {
            name: text(row.name, 300),
            email: text(row.email, 500),
            phone: text(row.phone, 100),
            interest: text(row.interest || row.product_interest || row.preferred_product, 500),
            broker: text(row.broker, 300),
            country: text(row.country, 200),
            trading_experience: text(row.trading_experience, 1000),
            intent: text(row.intent, 120),
            telegram_url: text(row.telegram_url || row.telegram_link, 1000),
            sheet_payload: row,
          },
          updated_at: new Date().toISOString(),
        };

        let lead: any;
        if (existingMap?.local_entity_id) {
          const updated = await supabaseServerRequest<any[]>(`crm_leads?id=eq.${existingMap.local_entity_id}&organization_id=eq.${GENCOUV_ORG_ID}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          lead = updated[0];
        } else {
          const created = await supabaseServerRequest<any[]>("crm_leads", {
            method: "POST",
            body: JSON.stringify({ ...payload, created_at: new Date().toISOString() }),
          });
          lead = created[0];
        }

        if (!lead?.id) throw new Error("Lead was not saved.");

        const mapPayload = {
          organization_id: GENCOUV_ORG_ID,
          source: "google_sheets",
          external_record_id: externalId,
          local_entity_type: "crm_lead",
          local_entity_id: lead.id,
          source_updated_at: text(row.received_at || row.timestamp, 100) || null,
          last_synced_at: new Date().toISOString(),
          metadata: { sheet_name: body.sheet_name || null, row_number: row.row_number || index + 2 },
        };

        if (existingMap?.id) {
          await supabaseServerRequest(`gencouv_external_record_map?id=eq.${existingMap.id}`, {
            method: "PATCH",
            body: JSON.stringify(mapPayload),
          });
        } else {
          await supabaseServerRequest("gencouv_external_record_map", {
            method: "POST",
            body: JSON.stringify(mapPayload),
          });
        }
        written += 1;
      } catch {
        failed += 1;
      }
    }

    if (runId) {
      await supabaseServerRequest(`gencouv_sync_runs?id=eq.${runId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: failed ? "completed_with_errors" : "completed",
          records_written: written,
          records_failed: failed,
          completed_at: new Date().toISOString(),
        }),
      });
    }

    return NextResponse.json({ success: true, records_read: rows.length, records_written: written, records_failed: failed });
  } catch (error) {
    if (runId) {
      await supabaseServerRequest(`gencouv_sync_runs?id=eq.${runId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "failed", error_message: error instanceof Error ? error.message : "Sync failed.", completed_at: new Date().toISOString() }),
      }).catch(() => undefined);
    }
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Sync failed." }, { status: 500 });
  }
}
