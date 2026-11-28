import { createAdminClient } from "@/lib/supabase/admin";
import { CampaignTemplateError, loadLinkedCampaignTemplates } from "@/lib/portal-campaign-templates";

/** Read-only provider discovery, with a tenant-scoped audit snapshot. Never
 * creates, activates, deactivates or substitutes an outbound template. */
export async function syncWhatsAppTemplateInventory(organizationId: string, deadline?: AbortSignal) {
  const admin = createAdminClient();
  const { inventory, missingMappings } = await loadLinkedCampaignTemplates(organizationId, true, null, deadline);
  const snapshot = {
    observed_at: new Date().toISOString(),
    count: inventory.length,
    approved: inventory.filter(item => item.status === "APPROVED").length,
    unlinked: inventory.filter(item => item.mapping_status === "unlinked").length,
    ambiguous: inventory.filter(item => item.mapping_status === "ambiguous").length,
    templates: inventory.map(({ id, name, language, status, category, purpose, mapping_status, suggested_purpose, placeholder_indexes, components }) => ({
      id, name, language, status, category, purpose, mapping_status, suggested_purpose, placeholder_indexes,
      components: components.map(component => ({ type: component.type, format: component.format, button_types: component.buttons?.map(button => button.type) || [] })),
    })),
    missing_mappings: missingMappings,
  };
  if (deadline?.aborted) throw new CampaignTemplateError("Template synchronization deadline reached.", 503);
  const { error } = await admin.from("audit_logs").insert({
    organization_id: organizationId, action: "whatsapp.template_inventory_synced",
    resource_type: "whatsapp_template_inventory", resource_id: organizationId, metadata: snapshot,
  });
  if (error) throw new CampaignTemplateError("Unable to save template inventory observation.", 503);
  return { count: snapshot.count, approved: snapshot.approved, unlinked: snapshot.unlinked, ambiguous: snapshot.ambiguous, missingMappings: missingMappings.length };
}
