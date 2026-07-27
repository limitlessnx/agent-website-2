import {
  activateN8nWorkflow,
  getN8nWorkflow,
  updateN8nWorkflow,
} from "@/lib/n8n-api";

const ACTION_WORKFLOW_ID = "ZdRPo2dzteuK5Gup";
const CLIENT_WORKFLOW_ID = "lwNLfBjKA0tK0e1v";
const CAMPAIGN_NODE = "Prepare WhatsApp Campaign";
const PROMPT_NODE = "Build AI Prompt";
const OPENAI_NODE = "OpenAI - Generate Response2";

const TEMPLATE_MESSAGE_LIMIT = 1024;

type WorkflowNode = {
  name: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
};

function replaceRequired(source: string, before: string, after: string, label: string) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Unable to patch ${label}: expected source block was not found.`);
  return source.replace(before, after);
}

async function saveWorkflow(workflow: Record<string, any>, nodes: WorkflowNode[]) {
  const updated = await updateN8nWorkflow(String(workflow.id), {
    name: workflow.name,
    nodes,
    connections: workflow.connections || {},
    settings: workflow.settings || {},
  });
  if (workflow.active && !updated.active) await activateN8nWorkflow(String(workflow.id));
}

function patchCampaignCode(source: string) {
  let code = source;

  const originalCampaignStart = `const customMessage = params.custom_message || params.message || params.message_text || '';
const topicParts = [];`;
  const brandedCampaignStart = `const customMessage = params.custom_message || params.message || params.message_text || '';
const campaignTitle = 'Update🚨🚨';
const campaignFooter = 'This is Agent Maia your Real estate support assistance';
const cleanCampaignCopy = value => String(value || '')
  .replace(/^\\s*(?:Update🚨🚨|New Estate Brief)\\s*/i, '')
  .replace(/\\s*(?:Reply YES if you want details or VIEWING if you want to schedule an inspection\\.?|This is Agent Maia your Real estate support assistance)\\s*$/i, '')
  .trim();
const topicParts = [];`;
  const directCampaignStart = `const customMessage = params.custom_message || params.message || params.message_text || '';
const cleanCampaignCopy = value => String(value || '').trim();
const topicParts = [];`;

  if (code.includes(brandedCampaignStart)) {
    code = code.replace(brandedCampaignStart, directCampaignStart);
  } else if (code.includes(originalCampaignStart)) {
    code = code.replace(originalCampaignStart, directCampaignStart);
  }

  const originalMessageWrapper = `const messageTemplate = customMessage || (
  'Hello {{name}}, this is Limitless Realty. Here is a quick summary of ' + topic + ':\\n\\n' +
  (propertySummary || 'I will share the matching property briefs with you shortly.') +
  '\\n\\nReply here if you want details, pricing, or inspection booking. You can also contact Limitless on +2348127753308.'
);`;
  const brandedMessageWrapper = `const campaignCoreMessage = cleanCampaignCopy(customMessage) || (
  'Hello {{name}}, this is Limitless Realty. Here is a quick summary of ' + topic + ':\\n\\n' +
  (propertySummary || 'I will share the matching property briefs with you shortly.')
);
const messageTemplate = campaignTitle + '\\n\\n' + campaignCoreMessage + '\\n\\n' + campaignFooter;`;
  const directMessageWrapper = `const campaignCoreMessage = cleanCampaignCopy(customMessage) || (
  'Hello {{name}}, this is Limitless Realty. Here is a quick summary of ' + topic + ':\\n\\n' +
  (propertySummary || 'I will share the matching property briefs with you shortly.')
);
const messageTemplate = campaignCoreMessage;`;

  if (code.includes(brandedMessageWrapper)) {
    code = code.replace(brandedMessageWrapper, directMessageWrapper);
  } else if (code.includes(originalMessageWrapper)) {
    code = code.replace(originalMessageWrapper, directMessageWrapper);
  }

  if (code.includes(`template_name: 'estate_brief_update',`)) {
    code = code.replace(
      `template_name: 'estate_brief_update',`,
      `template_name: params.template_name || 'estate_brief_update',`,
    );
  }

  const originalTemplateSummary = `const templateSummary = safeTemplateText(rawTemplateSummary || 'New property updates are available from Limitless Realty.', 240);`;
  const brandedTemplateSummary = `const templateSummary = safeTemplateText(
    campaignTitle + ' ' + (rawTemplateSummary || 'New property updates are available from Limitless Realty.') + ' ' + campaignFooter,
    240
  );`;
  const directTemplateSummary = `const templateSummary = safeTemplateText(
    cleanCampaignCopy(customMessage) || rawTemplateSummary || 'New property updates are available from Limitless Realty.',
    ${TEMPLATE_MESSAGE_LIMIT}
  );`;

  if (code.includes(brandedTemplateSummary)) {
    code = code.replace(brandedTemplateSummary, directTemplateSummary);
  } else if (code.includes(originalTemplateSummary)) {
    code = code.replace(originalTemplateSummary, directTemplateSummary);
  }

  if (!code.includes("const messageTemplate = campaignCoreMessage;")) {
    throw new Error("Unable to patch campaign passthrough: the direct message block was not installed.");
  }

  if (!code.includes(`cleanCampaignCopy(customMessage) || rawTemplateSummary`)) {
    throw new Error("Unable to patch campaign template fallback: full dashboard copy was not installed.");
  }

  return code;
}

function patchPromptCode(source: string) {
  let code = source;

  code = replaceRequired(
    code,
    `const campaignPropertyNames = Array.isArray(latestCampaign?.property_names) ? latestCampaign.property_names : [];

const genericTokens`,
    `const campaignPropertyNames = Array.isArray(latestCampaign?.property_names) ? latestCampaign.property_names : [];
const campaignReferenceAsk = /\\b(these|those|them|the estates|the properties|more details|details on|tell me more|show me more|all of them|each of them|the ones you sent|the update|yes)\\b/i.test(currentMessage);
const explicitPropertyMention = campaignProperties.some(property => {
  const title = norm(property.title || property.name || '');
  return Boolean(title && currentNorm.includes(title));
});
const campaignLockedRows = campaignProperties
  .map(contextProperty => {
    const contextId = String(contextProperty.id || '');
    const contextTitle = norm(contextProperty.title || contextProperty.name || '');
    const full = propertyRows.find(property => {
      const propertyId = String(property.id || '');
      const propertyTitle = norm(property.title || property.name || '');
      return Boolean(
        (contextId && propertyId === contextId) ||
        (contextTitle && propertyTitle && (propertyTitle === contextTitle || propertyTitle.includes(contextTitle) || contextTitle.includes(propertyTitle)))
      );
    });
    return full ? { ...contextProperty, ...full } : contextProperty;
  })
  .filter(property => property && (property.id || property.title || property.name));
const campaignContextLocked = Boolean(latestCampaign && campaignReferenceAsk && !explicitPropertyMention && campaignLockedRows.length);

const genericTokens`,
    "campaign context lock",
  );

  code = replaceRequired(
    code,
    `let scored = propertyRows.map(scoreProperty).filter(item => item.score > 0).sort((a, b) => b.score - a.score);`,
    `let scored = campaignContextLocked
  ? campaignLockedRows.map((property, index) => ({
      property,
      score: 2000 - index,
      reasons: ['locked to the exact properties in the latest campaign sent to this contact'],
      price: parseMoney(property.price || property.price_text || property.amount || ''),
    }))
  : propertyRows.map(scoreProperty).filter(item => item.score > 0).sort((a, b) => b.score - a.score);`,
    "campaign-scoped recommendations",
  );

  code = replaceRequired(
    code,
    `- If the client names a property/estate, answer for that named property only. Do not substitute another estate.
- If a close catalog match exists, use it. For example, "Iwinosa Estate" should match "Iwinosa Mega City" if that is the saved catalog title.`,
    `- If the client names a property/estate, answer for that named property only. Do not substitute another estate.
- STRICT CAMPAIGN CONTEXT LOCK: When the client says "these estates", "those properties", "them", "more details", "tell me more", "the ones you sent", or gives a generic reply to the latest campaign, answer only from the exact properties recorded in Recent outbound WhatsApp campaign context. Never introduce, recommend, or mention any property outside that campaign context. If several properties were sent, list those same properties briefly or ask which exact title they want expanded.
- If the campaign context contains Iwinosa properties, never replace them with Landsmith Crest or any unrelated property.
- If a close catalog match exists, use it. For example, "Iwinosa Estate" should match "Iwinosa Mega City" if that is the saved catalog title.`,
    "strict prompt grounding rules",
  );

  code = replaceRequired(
    code,
    `    latest_campaign_context: latestCampaign,
    active_property_context: activePropertyMemory,`,
    `    latest_campaign_context: latestCampaign,
    campaign_context_locked: campaignContextLocked,
    campaign_context_property_names: campaignLockedRows.map(property => property.title || property.name).filter(Boolean),
    active_property_context: activePropertyMemory,`,
    "grounding diagnostics",
  );

  return code;
}

export async function repairMaiaQuality() {
  const [actionWorkflow, clientWorkflow] = await Promise.all([
    getN8nWorkflow(ACTION_WORKFLOW_ID),
    getN8nWorkflow(CLIENT_WORKFLOW_ID),
  ]);

  const actionNodes = (Array.isArray(actionWorkflow.nodes) ? actionWorkflow.nodes : []) as WorkflowNode[];
  const campaignNode = actionNodes.find((node) => node.name === CAMPAIGN_NODE);
  if (!campaignNode) throw new Error(`${CAMPAIGN_NODE} was not found.`);
  const campaignCode = String(campaignNode.parameters?.jsCode || "");
  const nextCampaignCode = patchCampaignCode(campaignCode);
  if (nextCampaignCode !== campaignCode) {
    campaignNode.parameters = { ...(campaignNode.parameters || {}), jsCode: nextCampaignCode };
    await saveWorkflow(actionWorkflow, actionNodes);
  }

  const clientNodes = (Array.isArray(clientWorkflow.nodes) ? clientWorkflow.nodes : []) as WorkflowNode[];
  const promptNode = clientNodes.find((node) => node.name === PROMPT_NODE);
  const openAiNode = clientNodes.find((node) => node.name === OPENAI_NODE);
  if (!promptNode || !openAiNode) throw new Error("Maia client prompt or OpenAI node was not found.");

  const promptCode = String(promptNode.parameters?.jsCode || "");
  const nextPromptCode = patchPromptCode(promptCode);
  const openAiBody = String(openAiNode.parameters?.body || "");
  const nextOpenAiBody = openAiBody.replace("temperature: 0.7", "temperature: 0.1");
  const clientChanged = nextPromptCode !== promptCode || nextOpenAiBody !== openAiBody;
  if (clientChanged) {
    promptNode.parameters = { ...(promptNode.parameters || {}), jsCode: nextPromptCode };
    openAiNode.parameters = { ...(openAiNode.parameters || {}), body: nextOpenAiBody };
    await saveWorkflow(clientWorkflow, clientNodes);
  }

  return {
    actionWorkflow: actionWorkflow.name,
    clientWorkflow: clientWorkflow.name,
    campaignFormattingRepaired: nextCampaignCode !== campaignCode,
    campaignContextLockRepaired: nextPromptCode !== promptCode,
    modelTemperature: nextOpenAiBody.includes("temperature: 0.1") ? 0.1 : null,
    campaignMode: "exact_message_passthrough",
    campaignTitle: null,
    campaignFooter: null,
    templateCharacterLimit: TEMPLATE_MESSAGE_LIMIT,
    approvedTemplateName: "estate_brief_update",
  };
}
