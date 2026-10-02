import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { internalRuntimeIdentity, runPhase12Agent } from "@/lib/ai-runtime/migration";
import { preflightChargeableFluxAi, recordChargeableFluxAiUsage } from "@/lib/flux-ai-metering-core";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let executionId = "";
  let organizationId = "";
  let agentId = "";
  let testRunId = "";
  const startedAt = new Date().toISOString();

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    organizationId = String(body.organizationId || "").trim();
    agentId = String(body.agentId || "").trim();
    const message = String(body.message || "").trim();
    if (!organizationId || !agentId || message.length < 5) {
      return NextResponse.json({ error: "Organization, agent and a test message of at least 5 characters are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: agent, error: agentError } = await admin
      .from("agents")
      .select("id,name,system_prompt,communication_channels,human_handoff_destination,status,configuration")
      .eq("organization_id", organizationId)
      .eq("id", agentId)
      .maybeSingle();
    if (agentError) throw agentError;
    if (!agent || agent.status === "deleted") return NextResponse.json({ error: "Agent not found in this tenant." }, { status: 404 });

    const checks = {
      prompt_present: Boolean(agent.system_prompt?.trim()),
      channels_declared: Array.isArray(agent.communication_channels) && agent.communication_channels.length > 0,
      handoff_configured: Boolean(agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length),
    };
    if (!checks.prompt_present || !checks.channels_declared || !checks.handoff_configured) {
      const { data, error } = await admin.from("agent_test_runs").insert({
        organization_id: organizationId,
        agent_id: agentId,
        initiated_by: null,
        test_type: "admin_conversation",
        input: { message },
        output: { mode: "runtime_validation", agent_name: agent.name, checks },
        status: "failed",
        score: 0,
        notes: "Live runtime test blocked because required agent configuration is incomplete.",
        completed_at: new Date().toISOString(),
      }).select("id,status,score,created_at").single();
      if (error) throw error;
      return NextResponse.json({ ok: false, test: data, checks }, { status: 409 });
    }

    executionId = randomUUID();
    const { data: execution, error: executionError } = await admin.from("runtime_executions").insert({
      id: executionId,
      organization_id: organizationId,
      agent_id: agentId,
      status: "running",
      execution_context: {
        source: "super_admin_live_agent_test",
        test_run: true,
        initiated_by_admin_email: session.email,
      },
      input: { message, channel: "api", test: true },
      started_at: startedAt,
    }).select("id,organization_id,agent_id,status").single();
    if (executionError || !execution) throw executionError || new Error("Runtime test execution could not be created.");

    const { data: testRun, error: testError } = await admin.from("agent_test_runs").insert({
      organization_id: organizationId,
      agent_id: agentId,
      initiated_by: null,
      test_type: "admin_conversation",
      input: { message, channel: "api", live_runtime: true },
      output: { mode: "live_runtime", execution_id: executionId },
      status: "pending",
      notes: "Super Admin live runtime test. Model execution is real; external channel delivery and tool execution are not performed.",
    }).select("id").single();
    if (testError || !testRun) throw testError || new Error("Runtime test record could not be created.");
    testRunId = testRun.id;

    await preflightChargeableFluxAi({ organizationId, feature: "core_ai_support", action: "web_ai" });

    const runtime = await runPhase12Agent({
      kind: "specialist",
      organizationId,
      agentId,
      channel: "api",
      externalConversationId: `admin-test:${testRunId}`,
      objective: message,
      metadata: {
        source: "super_admin_live_agent_test",
        testRunId,
        executionId,
        configuration: agent.configuration || {},
      },
      identity: internalRuntimeIdentity(organizationId, "api"),
    });

    await recordChargeableFluxAiUsage({
      organizationId,
      action: "web_ai",
      source: "super_admin_live_agent_test",
      provider: runtime.model.provider,
      model: runtime.model.modelKey,
      providerUsage: runtime.usage || {},
      metadata: { agent_id: agentId, test_run_id: testRunId, runtime_execution_id: runtime.executionId },
    });

    const replyPresent = Boolean(runtime.reply?.trim());
    const passed = replyPresent;
    const completedAt = new Date().toISOString();
    await admin.from("runtime_executions").update({
      status: passed ? "completed" : "failed",
      output: {
        reply: runtime.reply,
        intent: runtime.intent,
        confidence: runtime.confidence,
        needs_human_review: runtime.needsHumanReview,
        model: runtime.model,
        tool_calls: runtime.toolCalls,
        runtime_execution_id: runtime.executionId,
        runtime_session_id: runtime.sessionId || null,
      },
      token_usage: runtime.usage || {},
      completed_at: completedAt,
    }).eq("id", executionId).eq("organization_id", organizationId).eq("agent_id", agentId);

    const { data, error } = await admin.from("agent_test_runs").update({
      output: {
        mode: "live_runtime",
        execution_id: executionId,
        runtime_execution_id: runtime.executionId,
        runtime_session_id: runtime.sessionId || null,
        reply: runtime.reply,
        intent: runtime.intent,
        confidence: runtime.confidence,
        needs_human_review: runtime.needsHumanReview,
        model: runtime.model,
        proposed_tool_calls: runtime.toolCalls,
        checks: { ...checks, reply_present: replyPresent, no_external_delivery: true, tools_not_executed: true },
      },
      status: passed ? "passed" : "failed",
      score: passed ? 100 : 0,
      notes: "Real AgentRuntimeSDK model execution. Proposed tools are recorded but not executed and no external channel message is sent.",
      completed_at: completedAt,
    }).eq("id", testRunId).eq("organization_id", organizationId).eq("agent_id", agentId)
      .select("id,status,score,created_at,completed_at").single();
    if (error) throw error;

    await admin.from("runtime_progress_events").insert({
      organization_id: organizationId,
      execution_id: executionId,
      event_type: passed ? "super_admin.live_test.passed" : "super_admin.live_test.failed",
      message: passed ? "Super Admin live runtime test completed." : "Super Admin live runtime test returned no usable response.",
      payload: { test_run_id: testRunId, runtime_execution_id: runtime.executionId, tool_calls_proposed: runtime.toolCalls.length },
    });

    const { error: readinessError } = await admin.rpc("refresh_agent_runtime_readiness", {
      p_organization_id: organizationId,
      p_agent_id: agentId,
    });
    if (readinessError) throw readinessError;

    if (passed) {
      await admin.from("client_onboarding_profiles").update({ status: "testing" })
        .eq("organization_id", organizationId)
        .eq("status", "configuration");
    }

    return NextResponse.json({
      ok: passed,
      test: data,
      reply: runtime.reply,
      intent: runtime.intent,
      confidence: runtime.confidence,
      model: runtime.model,
      needs_human_review: runtime.needsHumanReview,
      proposed_tool_calls: runtime.toolCalls,
      external_delivery: "not_sent",
      tools_executed: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run the live agent test.";
    const completedAt = new Date().toISOString();

    if (executionId) {
      const admin = createAdminClient();
      await admin.from("runtime_executions").update({
        status: "failed",
        error_code: "ADMIN_LIVE_TEST_FAILED",
        error_message: message,
        completed_at: completedAt,
      }).eq("id", executionId).eq("organization_id", organizationId).eq("agent_id", agentId);
    }
    if (testRunId) {
      const admin = createAdminClient();
      await admin.from("agent_test_runs").update({
        status: "failed",
        score: 0,
        notes: `Live AgentRuntimeSDK test failed: ${message}`,
        completed_at: completedAt,
      }).eq("id", testRunId).eq("organization_id", organizationId).eq("agent_id", agentId);
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
