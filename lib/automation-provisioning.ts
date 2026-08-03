import { activateN8nWorkflow, createN8nWorkflow, findN8nWorkflowByName, getN8nWorkflow, type N8nWorkflow } from "@/lib/n8n-api";
import { createAdminClient } from "@/lib/supabase/admin";

export type AutomationTemplate = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  channels: string[];
  required_plan: string | null;
  setup_price: number;
  recurring_price: number;
  currency: string;
  configuration_schema: Record<string, unknown>;
  status: "draft" | "available" | "paused" | "deprecated";
  latest_approved_version: number | null;
  created_at: string;
  updated_at: string;
};

export type AutomationTemplateVersion = {
  id: string;
  automation_template_id: string;
  version: number;
  source_n8n_workflow_id: string;
  source_n8n_workflow_name: string | null;
  configuration_defaults: Record<string, unknown>;
  validation_notes: string | null;
  status: "draft" | "approved" | "retired";
  approved_at: string | null;
};

export type OrganizationAutomationState = {
  id: string;
  organization_id: string;
  automation_template_id: string;
  automation_template_version_id: string;
  display_name: string;
  status: "payment_pending" | "queued" | "provisioning" | "active" | "paused" | "needs_attention" | "failed" | "cancelled";
  client_configuration: Record<string, unknown>;
  provisioned_version: number;
  activated_at: string | null;
  paused_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type OrganizationRow = { id: string; name: string; slug: string };
type WorkerJob = {
  id: string;
  organization_id: string;
  organization_automation_id: string;
  automation_template_version_id: string;
  payment_attempt_id: string | null;
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
};

type InstallationRow = OrganizationAutomationState & {
  backend_workflow_id: string | null;
  backend_workflow_name: string | null;
};

type ClientAutomation = OrganizationAutomationState & {
  template: Pick<AutomationTemplate, "name" | "slug" | "description" | "category" | "channels" | "required_plan" | "setup_price" | "recurring_price" | "currency"> | null;
};

type PaymentAttempt = { id: string; organization_id: string; quote_id: string };
type AutomationQuoteItem = {
  id: string;
  item_key: string;
  metadata?: Record<string, unknown> | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanWorkflowName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown provisioning error.");
  return message.replace(process.env.N8N_API_KEY || "", "[redacted]");
}

function replacePlaceholders(value: unknown, replacements: Record<string, string>): unknown {
  if (typeof value === "string") {
    return Object.entries(replacements).reduce((current, [key, replacement]) => current.replaceAll(key, replacement), value);
  }
  if (Array.isArray(value)) return value.map((item) => replacePlaceholders(item, replacements));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replacePlaceholders(entry, replacements)]));
  }
  return value;
}

function cloneWorkflowPayload(source: N8nWorkflow, name: string, metadata: Record<string, string>, configuration: Record<string, unknown>) {
  const replacements = {
    __FLUXKNIGHT_ORGANIZATION_ID__: metadata.organization_id,
    __FLUXKNIGHT_ORGANIZATION_NAME__: metadata.organization_name,
    __FLUXKNIGHT_ORGANIZATION_SLUG__: metadata.organization_slug,
    __FLUXKNIGHT_AUTOMATION_ID__: metadata.organization_automation_id,
    __FLUXKNIGHT_AUTOMATION_TEMPLATE_ID__: metadata.automation_template_id,
    __FLUXKNIGHT_AUTOMATION_VERSION__: metadata.automation_version,
  };

  return {
    name,
    active: false,
    nodes: replacePlaceholders(source.nodes || [], replacements) as unknown[],
    connections: replacePlaceholders(source.connections || {}, replacements) as Record<string, unknown>,
    settings: source.settings || {},
    staticData: {
      ...(source.staticData || {}),
      fluxknight: {
        ...metadata,
        configuration,
        cloned_at: new Date().toISOString(),
      },
    },
  };
}

function validateClone(workflow: N8nWorkflow, expectedName: string) {
  if (workflow.name !== expectedName) throw new Error("Cloned workflow name did not match the expected tenant name.");
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) throw new Error("Cloned workflow has no nodes.");
  if (!workflow.connections || typeof workflow.connections !== "object") throw new Error("Cloned workflow has no connection map.");
}

export async function listAutomationTemplates() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("automation_templates")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as AutomationTemplate[];
}

export async function listAutomationTemplateVersions(templateId?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("automation_template_versions")
    .select("*")
    .order("created_at", { ascending: false });
  if (templateId) query = query.eq("automation_template_id", templateId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AutomationTemplateVersion[];
}

export async function listAutomationProvisioningJobs(limit = 50) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("automation_provisioning_jobs")
    .select("id,organization_id,organization_automation_id,status,attempts,max_attempts,last_error,available_at,started_at,completed_at,created_at,result")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getClientAutomations(organizationId: string) {
  const admin = createAdminClient();
  const [{ data: templates, error: templateError }, { data: installations, error: installationError }] = await Promise.all([
    admin
      .from("automation_templates")
      .select("id,name,slug,description,category,channels,required_plan,setup_price,recurring_price,currency,status,latest_approved_version,configuration_schema,created_at,updated_at")
      .eq("status", "available")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("organization_automations")
      .select("id,organization_id,automation_template_id,automation_template_version_id,display_name,status,client_configuration,provisioned_version,activated_at,paused_at,last_error,created_at,updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);
  if (templateError) throw templateError;
  if (installationError) throw installationError;

  const templateRows = (templates || []) as AutomationTemplate[];
  const installationRows = (installations || []) as OrganizationAutomationState[];
  const templateById = new Map(templateRows.map((template) => [template.id, template]));
  const installed: ClientAutomation[] = installationRows.map((installation) => {
    const template = templateById.get(installation.automation_template_id);
    return {
      ...installation,
      template: template ? {
        name: template.name,
        slug: template.slug,
        description: template.description,
        category: template.category,
        channels: template.channels,
        required_plan: template.required_plan,
        setup_price: template.setup_price,
        recurring_price: template.recurring_price,
        currency: template.currency,
      } : null,
    };
  });
  const installedTemplateIds = new Set(installed.map((item) => item.automation_template_id));
  const library = templateRows.filter((template) => !installedTemplateIds.has(template.id));
  return { installed, library };
}

export async function saveAutomationTemplate(input: {
  name: string;
  slug: string;
  description?: string;
  category?: string;
  channels?: string[];
  required_plan?: string;
  setup_price?: number;
  recurring_price?: number;
  currency?: string;
  status?: AutomationTemplate["status"];
}) {
  const admin = createAdminClient();
  const payload = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    description: input.description?.trim() || null,
    category: input.category?.trim() || "operations",
    channels: input.channels || [],
    required_plan: input.required_plan?.trim() || null,
    setup_price: Number(input.setup_price || 0),
    recurring_price: Number(input.recurring_price || 0),
    currency: input.currency || "NGN",
    status: input.status || "draft",
  };
  if (!payload.name || !/^[a-z0-9][a-z0-9-]{1,80}$/.test(payload.slug)) {
    throw new Error("Template name and a lowercase slug are required.");
  }

  const { data, error } = await admin
    .from("automation_templates")
    .upsert(payload, { onConflict: "slug" })
    .select("*")
    .single();
  if (error) throw error;
  return data as AutomationTemplate;
}

export async function saveAutomationTemplateVersion(input: {
  automation_template_id: string;
  version: number;
  source_n8n_workflow_id: string;
  source_n8n_workflow_name?: string;
  configuration_defaults?: Record<string, unknown>;
  validation_notes?: string;
  status?: AutomationTemplateVersion["status"];
}) {
  const admin = createAdminClient();
  const status = input.status || "draft";
  const payload = {
    automation_template_id: input.automation_template_id,
    version: Number(input.version),
    source_n8n_workflow_id: input.source_n8n_workflow_id.trim(),
    source_n8n_workflow_name: input.source_n8n_workflow_name?.trim() || null,
    configuration_defaults: input.configuration_defaults || {},
    validation_notes: input.validation_notes?.trim() || null,
    status,
    approved_at: status === "approved" ? new Date().toISOString() : null,
  };
  if (!payload.automation_template_id || !payload.source_n8n_workflow_id || !Number.isInteger(payload.version) || payload.version < 1) {
    throw new Error("Template, version number, and source n8n workflow ID are required.");
  }

  const { data, error } = await admin
    .from("automation_template_versions")
    .upsert(payload, { onConflict: "automation_template_id,version" })
    .select("*")
    .single();
  if (error) throw error;
  return data as AutomationTemplateVersion;
}

export async function queuePaidAutomationProvisioning(payment: PaymentAttempt) {
  const admin = createAdminClient();
  const { data: items, error: itemError } = await admin
    .from("organization_quote_items")
    .select("id,item_key,metadata")
    .eq("organization_id", payment.organization_id)
    .eq("quote_id", payment.quote_id)
    .eq("item_type", "automation");
  if (itemError) throw itemError;
  if (!items?.length) return [];

  const created: string[] = [];
  for (const item of items as AutomationQuoteItem[]) {
    const { data: template, error: templateError } = await admin
      .from("automation_templates")
      .select("*")
      .eq("slug", item.item_key)
      .eq("status", "available")
      .single();
    if (templateError) throw templateError;
    const typedTemplate = template as AutomationTemplate;

    const { data: version, error: versionError } = await admin
      .from("automation_template_versions")
      .select("*")
      .eq("automation_template_id", typedTemplate.id)
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1)
      .single();
    if (versionError) throw versionError;
    const typedVersion = version as AutomationTemplateVersion;

    const { data: existingInstallation, error: existingError } = await admin
      .from("organization_automations")
      .select("id,status,backend_workflow_id")
      .eq("organization_id", payment.organization_id)
      .eq("automation_template_id", typedTemplate.id)
      .maybeSingle();
    if (existingError) throw existingError;

    const installation = existingInstallation || null;
    if (!installation) {
      const { data: insertedInstallation, error: installationError } = await admin
        .from("organization_automations")
        .insert({
          organization_id: payment.organization_id,
          automation_template_id: typedTemplate.id,
          automation_template_version_id: typedVersion.id,
          payment_attempt_id: payment.id,
          quote_item_id: item.id,
          display_name: typedTemplate.name,
          status: "queued",
          client_configuration: item.metadata || {},
          provisioned_version: typedVersion.version,
          last_error: null,
        })
        .select("id,status,backend_workflow_id")
        .single();
      if (installationError) throw installationError;
      created.push(String(insertedInstallation.id));
      await admin
        .from("automation_provisioning_jobs")
        .insert({
          organization_id: payment.organization_id,
          organization_automation_id: insertedInstallation.id,
          automation_template_version_id: typedVersion.id,
          payment_attempt_id: payment.id,
          idempotency_key: `${payment.organization_id}:${typedTemplate.id}:v${typedVersion.version}`,
          payload: { quote_id: payment.quote_id, quote_item_id: item.id },
        })
        .then(({ error }) => {
          if (error && error.code !== "23505") throw error;
        });
      continue;
    }

    if (!installation.backend_workflow_id) {
      const { error: updateError } = await admin
        .from("organization_automations")
        .update({
          organization_id: payment.organization_id,
          automation_template_id: typedTemplate.id,
          automation_template_version_id: typedVersion.id,
          payment_attempt_id: payment.id,
          quote_item_id: item.id,
          display_name: typedTemplate.name,
          status: "queued",
          client_configuration: item.metadata || {},
          provisioned_version: typedVersion.version,
          last_error: null,
        })
        .eq("id", installation.id);
      if (updateError) throw updateError;
    }

    const idempotencyKey = `${payment.organization_id}:${typedTemplate.id}:v${typedVersion.version}`;
    const { error: jobError } = await admin
      .from("automation_provisioning_jobs")
      .insert({
        organization_id: payment.organization_id,
        organization_automation_id: installation.id,
        automation_template_version_id: typedVersion.id,
        payment_attempt_id: payment.id,
        idempotency_key: idempotencyKey,
        payload: { quote_id: payment.quote_id, quote_item_id: item.id },
      });
    if (jobError && jobError.code !== "23505") throw jobError;
    created.push(String(installation.id));
  }
  return created;
}

async function claimNextAutomationProvisioningJob() {
  const admin = createAdminClient();
  const { data: candidates, error } = await admin
    .from("automation_provisioning_jobs")
    .select("*")
    .in("status", ["queued", "failed"])
    .lt("attempts", 5)
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  const candidate = candidates?.[0] as WorkerJob | undefined;
  if (!candidate) return null;

  const { data, error: claimError } = await admin
    .from("automation_provisioning_jobs")
    .update({
      status: "running",
      attempts: candidate.attempts + 1,
      locked_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", candidate.id)
    .in("status", ["queued", "failed"])
    .select("*")
    .maybeSingle();
  if (claimError) throw claimError;
  return data as WorkerJob | null;
}

export async function runNextAutomationProvisioningJob() {
  const admin = createAdminClient();
  const job = await claimNextAutomationProvisioningJob();
  if (!job) return { processed: false, reason: "no_job" };

  try {
    const [{ data: organization, error: orgError }, { data: installation, error: installError }, { data: version, error: versionError }] = await Promise.all([
      admin.from("organizations").select("id,name,slug").eq("id", job.organization_id).single(),
      admin.from("organization_automations").select("*").eq("id", job.organization_automation_id).single(),
      admin.from("automation_template_versions").select("*").eq("id", job.automation_template_version_id).single(),
    ]);
    if (orgError) throw orgError;
    if (installError) throw installError;
    if (versionError) throw versionError;

    const typedOrg = organization as OrganizationRow;
    const typedInstallation = installation as InstallationRow;
    const typedVersion = version as AutomationTemplateVersion;
    const { data: template, error: templateError } = await admin
      .from("automation_templates")
      .select("*")
      .eq("id", typedInstallation.automation_template_id)
      .single();
    if (templateError) throw templateError;
    const typedTemplate = template as AutomationTemplate;

    await admin
      .from("organization_automations")
      .update({ status: "provisioning", last_provisioning_job_id: job.id, last_error: null })
      .eq("id", typedInstallation.id);

    const cloneName = cleanWorkflowName(`${typedOrg.name} - ${typedTemplate.name} - v${typedVersion.version}`);
    const configuration = {
      ...asObject(typedVersion.configuration_defaults),
      ...asObject(typedInstallation.client_configuration),
    };

    let workflow: N8nWorkflow | null = null;
    if (typedInstallation.backend_workflow_id) {
      workflow = await getN8nWorkflow(typedInstallation.backend_workflow_id);
    } else {
      workflow = await findN8nWorkflowByName(cloneName);
      if (!workflow) {
        const source = await getN8nWorkflow(typedVersion.source_n8n_workflow_id);
        workflow = await createN8nWorkflow(cloneWorkflowPayload(source, cloneName, {
          organization_id: typedOrg.id,
          organization_name: typedOrg.name,
          organization_slug: typedOrg.slug,
          organization_automation_id: typedInstallation.id,
          automation_template_id: typedTemplate.id,
          automation_version: String(typedVersion.version),
        }, configuration));
      }
    }

    const verified = await getN8nWorkflow(workflow.id);
    validateClone(verified, cloneName);
    const activated = verified.active ? verified : await activateN8nWorkflow(verified.id);

    const result = {
      backend_workflow_id: activated.id,
      backend_workflow_name: cloneName,
      activated_at: new Date().toISOString(),
    };

    await admin
      .from("organization_automations")
      .update({
        status: "active",
        backend_workflow_id: activated.id,
        backend_workflow_name: cloneName,
        activated_at: result.activated_at,
        last_error: null,
      })
      .eq("id", typedInstallation.id);

    await admin
      .from("automation_provisioning_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString(), result, last_error: null })
      .eq("id", job.id);

    return { processed: true, job_id: job.id, organization_automation_id: typedInstallation.id, status: "active" };
  } catch (error) {
    const message = publicError(error);
    const finalFailure = job.attempts >= job.max_attempts;
    await Promise.all([
      admin
        .from("automation_provisioning_jobs")
        .update({
          status: finalFailure ? "failed" : "queued",
          last_error: message,
          available_at: new Date(Date.now() + Math.min(60, 2 ** (job.attempts + 1)) * 60_000).toISOString(),
        })
        .eq("id", job.id),
      admin
        .from("organization_automations")
        .update({ status: finalFailure ? "failed" : "needs_attention", last_error: message })
        .eq("id", job.organization_automation_id),
    ]);
    return { processed: false, job_id: job.id, error: message };
  }
}
