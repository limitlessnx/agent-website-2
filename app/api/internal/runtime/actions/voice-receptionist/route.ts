import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const rec = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const arr = (v: unknown) => Array.isArray(v) ? v : [];
const safeDate = (v: unknown) => { const s=text(v); if(!s) return null; const d=new Date(s); return Number.isNaN(d.getTime())?null:d.toISOString(); };

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body=rec(await request.json().catch(()=>({})));
    const organizationId=text(body.organization_id), agentId=text(body.agent_id), executionId=text(body.execution_id), customerKey=text(body.customer_key), idempotencyKey=text(body.idempotency_key);
    const eventType=text(body.event_type)||"voice.transcript_received", input=rec(body.input), decision=rec(body.decision), usage=rec(body.provider_usage);
    if(!organizationId||!agentId||!executionId||!customerKey||!idempotencyKey) return NextResponse.json({error:"Missing required tenant voice fields."},{status:400});
    const supabase=createAdminClient();

    const execution=await supabase.from("runtime_executions").select("id,organization_id,agent_id,conversation_id").eq("id",executionId).eq("organization_id",organizationId).eq("agent_id",agentId).single();
    if(execution.error||!execution.data) return NextResponse.json({error:"Tenant execution was not found."},{status:404});
    const agent=await supabase.from("agents").select("id,organization_id,status,configuration").eq("id",agentId).eq("organization_id",organizationId).single();
    if(agent.error||!agent.data) return NextResponse.json({error:"Agent does not belong to this organization."},{status:409});

    const duplicate=await supabase.from("conversation_messages").select("id").eq("organization_id",organizationId).contains("payload",{workflow_key:"voice_receptionist_v6",idempotency_key:idempotencyKey}).limit(1).maybeSingle();
    if(duplicate.error) throw duplicate.error;
    if(duplicate.data) return NextResponse.json({ok:true,duplicate:true,organization_id:organizationId,agent_id:agentId,execution_id:executionId,idempotency_key:idempotencyKey,actions:[]});

    const inputCustomer=rec(input.customer);
    let customerId=text(body.customer_id);
    if(customerId){ const c=await supabase.from("crm_customers").select("id").eq("id",customerId).eq("organization_id",organizationId).maybeSingle(); if(c.error) throw c.error; if(!c.data) customerId=""; }
    if(!customerId){
      const existing=await supabase.from("crm_customers").select("id").eq("organization_id",organizationId).eq("external_key",customerKey).maybeSingle(); if(existing.error) throw existing.error;
      if(existing.data) customerId=existing.data.id; else {
        const created=await supabase.from("crm_customers").insert({organization_id:organizationId,external_key:customerKey,full_name:text(inputCustomer.name)||text(inputCustomer.full_name)||"Unknown caller",email:text(inputCustomer.email)||null,phone:text(inputCustomer.phone)||text(input.caller_phone)||null,status:"active",profile:{preferred_channel:"voice"},metadata:{created_by_workflow:"voice_receptionist_v6",first_execution_id:executionId}}).select("id").single();
        if(created.error) throw created.error; customerId=created.data.id;
      }
    }

    let conversationId=text(body.conversation_id)||text(execution.data.conversation_id);
    if(conversationId){ const c=await supabase.from("agent_conversations").select("id").eq("id",conversationId).eq("organization_id",organizationId).eq("agent_id",agentId).maybeSingle(); if(c.error) throw c.error; if(!c.data) conversationId=""; }
    if(!conversationId){
      const c=await supabase.from("agent_conversations").insert({organization_id:organizationId,agent_id:agentId,customer_id:customerId,channel:"voice",status:Boolean(decision.handoff_required)?"human_handoff":"open",current_stage:text(decision.lead_stage)||"new",ai_paused:Boolean(decision.handoff_required),last_message_at:new Date().toISOString(),metadata:{workflow_key:"voice_receptionist_v6",event_type: eventType,call_id:text(input.call_id),provider:text(input.provider)}}).select("id").single();
      if(c.error) throw c.error; conversationId=c.data.id;
      await supabase.from("runtime_executions").update({conversation_id:conversationId}).eq("id",executionId).eq("organization_id",organizationId);
    }

    const transcript=text(input.transcript)||text(input.latest_transcript);
    if(transcript){ const m=await supabase.from("conversation_messages").insert({organization_id:organizationId,conversation_id:conversationId,sender_type:"customer",content_type:"voice_transcript",content:transcript,payload:{workflow_key:"voice_receptionist_v6",execution_id:executionId,idempotency_key:idempotencyKey,call_id:text(input.call_id),event_type:eventType,direction:text(input.direction)||"inbound"}}); if(m.error) throw m.error; }
    const reply=text(decision.reply_text);
    if(reply){ const m=await supabase.from("conversation_messages").insert({organization_id:organizationId,conversation_id:conversationId,sender_type:"assistant",sender_id:agentId,content_type:"voice_reply",content:reply,payload:{workflow_key:"voice_receptionist_v6",execution_id:executionId,idempotency_key:`${idempotencyKey}:reply`,call_id:text(input.call_id),event_type:eventType}}); if(m.error) throw m.error; }
    const audit=await supabase.from("conversation_messages").insert({organization_id:organizationId,conversation_id:conversationId,sender_type:"system",content_type:"workflow_decision",content:text(decision.summary)||"Voice event processed.",payload:{workflow_key:"voice_receptionist_v6",execution_id:executionId,idempotency_key:`${idempotencyKey}:decision`,event_type:eventType,action:text(decision.action),call_status:text(decision.call_status),intent:text(decision.intent),priority:text(decision.priority),qualification_score:Number(decision.qualification_score)||0}}); if(audit.error) throw audit.error;

    let leadId="";
    const recent=await supabase.from("crm_leads").select("id").eq("organization_id",organizationId).eq("customer_id",customerId).order("updated_at",{ascending:false}).limit(1).maybeSingle(); if(recent.error) throw recent.error;
    if(recent.data){ leadId=recent.data.id; const u=await supabase.from("crm_leads").update({stage:text(decision.lead_stage)||"contacted",score:Math.max(0,Math.min(100,Number(decision.qualification_score)||0)),summary:text(decision.summary)||"Voice interaction",details:{last_voice_execution_id:executionId,last_call_id:text(input.call_id),intent:text(decision.intent),department:text(decision.department),sentiment:text(decision.sentiment),crm_notes:text(decision.crm_notes)},updated_at:new Date().toISOString()}).eq("id",leadId).eq("organization_id",organizationId); if(u.error) throw u.error; }
    else { const l=await supabase.from("crm_leads").insert({organization_id:organizationId,customer_id:customerId,assigned_agent_id:agentId,source:"voice",stage:text(decision.lead_stage)||"new",score:Math.max(0,Math.min(100,Number(decision.qualification_score)||0)),summary:text(decision.summary)||"Voice interaction",details:{execution_id:executionId,call_id:text(input.call_id),intent:text(decision.intent),department:text(decision.department),sentiment:text(decision.sentiment),crm_notes:text(decision.crm_notes)}}).select("id").single(); if(l.error) throw l.error; leadId=l.data.id; }

    const actions: Record<string, unknown>[]=[];
    if(reply && text(decision.call_status)==="in_progress") actions.push({type:"reply",payload:{channel:"voice",recipient:text(input.caller_phone)||customerKey,content:reply,conversation_id:conversationId,customer_id:customerId,lead_id:leadId,call_id:text(input.call_id)}});
    if(Boolean(decision.appointment_requested)) actions.push({type:"appointment",payload:{...rec(decision.appointment_details),customer_id:customerId,lead_id:leadId,conversation_id:conversationId,source:"voice",call_id:text(input.call_id)}});
    if(Boolean(decision.follow_up_required)){ const due=safeDate(decision.follow_up_at)||new Date(Date.now()+24*60*60*1000).toISOString(); const t=await supabase.from("crm_tasks").insert({organization_id:organizationId,customer_id:customerId,lead_id:leadId,assigned_agent_id:agentId,task_type:"voice_follow_up",title:"Voice call follow-up",description:text(decision.follow_up_reason)||text(decision.summary)||"Follow up after voice interaction.",status:"scheduled",due_at:due,metadata:{workflow_key:"voice_receptionist_v6",source_execution_id:executionId,call_id:text(input.call_id),idempotency_key:`${idempotencyKey}:followup`}}).select("id,status,due_at").single(); if(t.error) throw t.error; actions.push({type:"follow_up",payload:{task_id:t.data.id,due_at:t.data.due_at,customer_id:customerId,lead_id:leadId}}); }
    let handoff=null;
    if(Boolean(decision.handoff_required)||text(decision.action)==="handoff"){
      const h=await supabase.from("handoff_requests").insert({organization_id:organizationId,conversation_id:conversationId,agent_id:agentId,reason:text(decision.handoff_reason)||text(decision.summary)||"Voice call requires human review.",priority:["urgent","high"].includes(text(decision.priority))?text(decision.priority):"normal",status:"open",notes:`Call ${text(input.call_id)||"unknown"}; execution ${executionId}`}).select("id,status,priority,reason").single(); if(h.error) throw h.error; handoff=h.data;
      await supabase.from("agent_conversations").update({status:"human_handoff",ai_paused:true,updated_at:new Date().toISOString()}).eq("id",conversationId).eq("organization_id",organizationId);
      actions.push({type:"handoff",payload:{handoff_id:h.data.id,conversation_id:conversationId,customer_id:customerId,lead_id:leadId}});
    }

    const memories=arr(decision.memory_facts).map(rec).filter(x=>text(x.summary)).map(x=>({organization_id:organizationId,customer_key:customerKey,memory_type:text(x.type)||"voice",summary:text(x.summary),confidence:Math.max(0,Math.min(1,Number(x.confidence)||0.8)),source_type:"runtime_execution",source_id:executionId,metadata:{agent_id:agentId,conversation_id:conversationId,lead_id:leadId,call_id:text(input.call_id),workflow_key:"voice_receptionist_v6"}}));
    if(memories.length){ const m=await supabase.from("customer_memories").insert(memories); if(m.error) throw m.error; }
    if(Object.keys(usage).length){ await supabase.from("usage_ledger").insert({organization_id:organizationId,agent_id:agentId,execution_id:executionId,usage_type:"ai_tokens",quantity:Number(usage.total_tokens)||Number(usage.total)||1,unit:"tokens",metadata:{workflow_key:"voice_receptionist_v6",provider_usage:usage}}); }
    await supabase.from("runtime_progress_events").insert({organization_id:organizationId,execution_id:executionId,event_type:"voice.outcome_persisted",message:"Tenant-safe voice outcome persisted.",payload:{conversation_id:conversationId,customer_id:customerId,lead_id:leadId,call_id:text(input.call_id),event_type:eventType,actions_count:actions.length}});

    return NextResponse.json({ok:true,organization_id:organizationId,agent_id:agentId,execution_id:executionId,conversation_id:conversationId,customer_id:customerId,lead_id:leadId,idempotency_key:idempotencyKey,event_type:eventType,call_id:text(input.call_id)||null,call_status:text(decision.call_status)||"in_progress",summary:text(decision.summary),reply_text:reply||null,handoff,actions});
  } catch(error){ const message=error instanceof Error?error.message:"Unable to persist voice outcome."; return NextResponse.json({error:message},{status:message==="Unauthorized."?401:409}); }
}
