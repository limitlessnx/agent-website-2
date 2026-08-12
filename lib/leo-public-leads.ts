import { createAdminClient } from "@/lib/supabase/admin";

export type LeoPublicLead = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  industry: string | null;
  recommended_plan: string | null;
  qualification: Record<string, unknown>;
  notes: string | null;
  source: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function getLeoPublicLeads(limit = 100): Promise<LeoPublicLead[]> {
  const supabase = createAdminClient();
  const result = await supabase
    .from("leo_public_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));
  if (result.error) throw result.error;
  return (result.data || []) as LeoPublicLead[];
}
