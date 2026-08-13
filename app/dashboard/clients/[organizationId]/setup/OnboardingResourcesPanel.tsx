import { Download, ExternalLink, FileText } from "@/components/admin/ServerIcons";
import { createAdminClient } from "@/lib/supabase/admin";

function parseFileName(resources: unknown) {
  if (!resources || typeof resources !== "object" || Array.isArray(resources)) return "";
  const knowledgeFile = (resources as Record<string, unknown>).knowledgeFile;
  if (!knowledgeFile) return "";
  try {
    const parsed = typeof knowledgeFile === "string" ? JSON.parse(knowledgeFile) : knowledgeFile;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
    return String((parsed as Record<string, unknown>).name || "").trim();
  } catch {
    return "";
  }
}

function textValue(resources: unknown, key: string) {
  if (!resources || typeof resources !== "object" || Array.isArray(resources)) return "";
  return String((resources as Record<string, unknown>)[key] || "").trim();
}

export default async function OnboardingResourcesPanel({ organizationId }: { organizationId: string }) {
  const admin = createAdminClient();
  const { data: submissions } = await admin
    .from("client_onboarding_submissions")
    .select("id,business_resources,submitted_at,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1);

  const submission = submissions?.[0] || null;
  if (!submission) {
    return <p className="admin-empty">No onboarding resources were submitted for this client.</p>;
  }

  const { data: documents } = await admin
    .from("client_onboarding_documents")
    .select("id,file_name,mime_type,size_bytes,status")
    .eq("onboarding_id", submission.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  const storedDocument = documents?.[0] || null;
  const legacyFileName = parseFileName(submission.business_resources);
  const fileName = storedDocument?.file_name || legacyFileName;
  const businessDetails = textValue(submission.business_resources, "businessDetails");
  const resourceLinks = textValue(submission.business_resources, "resourceLinks");
  const hasDocument = Boolean(storedDocument || legacyFileName);

  return (
    <div className="admin-list">
      {hasDocument ? (
        <div className="admin-list-row" style={{ alignItems: "center", gap: 14 }}>
          <FileText size={18} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ overflowWrap: "anywhere" }}>{fileName || "Onboarding document"}</strong>
            <span>{storedDocument?.mime_type || "Submitted knowledge document"}{storedDocument?.size_bytes ? ` · ${Math.max(1, Math.round(Number(storedDocument.size_bytes) / 1024))} KB` : ""}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="admin-button secondary" href={`/api/admin/client-documents?onboardingId=${encodeURIComponent(submission.id)}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> View</a>
            <a className="admin-button secondary" href={`/api/admin/client-documents?onboardingId=${encodeURIComponent(submission.id)}&download=1`}><Download size={14} /> Download</a>
          </div>
        </div>
      ) : null}

      {businessDetails ? (
        <div className="admin-list-row"><div><strong>Business notes</strong><span>{businessDetails}</span></div></div>
      ) : null}

      {resourceLinks ? (
        <div className="admin-list-row"><div><strong>Resource links</strong><span style={{ overflowWrap: "anywhere" }}>{resourceLinks}</span></div></div>
      ) : null}

      {!hasDocument && !businessDetails && !resourceLinks ? <p className="admin-empty">No onboarding resources were submitted for this client.</p> : null}
    </div>
  );
}
