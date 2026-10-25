import { createAdminClient } from "@/lib/supabase/admin";

export type EstateStatus = "draft" | "published" | "archived";
export type KnowledgeStatus = "draft" | "approved";
export type JsonObject = Record<string, unknown>;

export type Estate = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  location: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: EstateStatus;
  cover_image_url: string | null;
  payment_terms: unknown;
  operating_instructions: string | null;
  terms_of_service: string | null;
  knowledge_status: KnowledgeStatus;
  provenance: JsonObject;
  created_at: string;
  updated_at: string;
  linked_property_count?: number;
};

export type EstateFaq = {
  id: string;
  organization_id: string;
  estate_id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  provenance: JsonObject;
  created_at: string;
  updated_at: string;
};

export type CanonicalProperty = {
  id: string;
  organization_id: string;
  title: string | null;
  type: string | null;
  location_city: string | null;
  location_area: string | null;
  price: unknown;
  status: string | null;
  features: unknown;
  description: string | null;
  drive_photos_link: string | null;
  drive_brochure_link: string | null;
  image_urls: unknown;
  cover_image_url: string | null;
  estate_id: string | null;
  updated_at: string | null;
};

export type EstateWithRelations = {
  estate: Estate;
  faqs: EstateFaq[];
  linkedProperties: CanonicalProperty[];
};

export type EstateSaveInput = {
  id?: string | null;
  name: string;
  description?: string | null;
  location?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  status?: EstateStatus;
  cover_image_url?: string | null;
  payment_terms?: unknown;
  operating_instructions?: string | null;
  terms_of_service?: string | null;
  knowledge_status?: KnowledgeStatus;
  provenance?: JsonObject;
};

export type EstateFaqSaveInput = {
  id?: string | null;
  question: string;
  answer: string;
  category?: string | null;
  sort_order?: number;
  provenance?: JsonObject;
};

const PROPERTY_SELECT = [
  "id", "organization_id", "title", "type", "location_city", "location_area", "price", "status",
  "features", "description", "drive_photos_link", "drive_brochure_link", "image_urls", "cover_image_url",
  "estate_id", "updated_at",
].join(",");

function required(value: unknown, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function organization(value: string) {
  return required(value, "An explicit organization is required");
}

function optionalText(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function estateStatus(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!["draft", "published", "archived"].includes(normalized)) throw new Error("status must be draft, published, or archived.");
  return normalized as EstateStatus;
}

function knowledgeStatus(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!["draft", "approved"].includes(normalized)) throw new Error("knowledge_status must be draft or approved.");
  return normalized as KnowledgeStatus;
}

function sortOrder(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("sort_order must be a non-negative integer.");
  return parsed;
}

function dbError(error: unknown): void {
  if (error) throw error;
}

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};
function objectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isEstate(value: unknown): value is Estate {
  return objectRecord(value) && typeof value.id === "string" && typeof value.organization_id === "string" && typeof value.name === "string";
}
function isEstateFaq(value: unknown): value is EstateFaq {
  return objectRecord(value) && typeof value.id === "string" && typeof value.organization_id === "string" && typeof value.estate_id === "string" && typeof value.question === "string" && typeof value.answer === "string";
}
function isCanonicalProperty(value: unknown): value is CanonicalProperty {
  return objectRecord(value) && typeof value.id === "string" && typeof value.organization_id === "string";
}

async function auditedRow<T>(client:unknown,name:string,args:Record<string,unknown>,isRow:(value:unknown)=>value is T,message:string):Promise<T>{
  const {data,error}=await (client as RpcClient).rpc(name,args);dbError(error);
  const row=Array.isArray(data)?data[0]:data;if(!isRow(row))throw new Error(message);return row;
}

async function requireEstate(organizationId: string, estateId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("real_estate_estates")
    .select("id,organization_id")
    .eq("organization_id", organizationId)
    .eq("id", required(estateId, "estateId"))
    .maybeSingle();
  dbError(error);
  if (!data) throw new Error("Estate was not found in this organization.");
  return data as { id: string; organization_id: string };
}

export async function listEstates(organizationId: string, limit = 100): Promise<Estate[]> {
  const org = organization(organizationId);
  const boundedLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("real_estate_estates")
    .select("*")
    .eq("organization_id", org)
    .order("updated_at", { ascending: false })
    .limit(boundedLimit);
  dbError(error);

  const estates = (data || []) as Estate[];
  return Promise.all(estates.map(async (estate) => {
    const { data: properties, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("organization_id", org)
      .eq("estate_id", estate.id);
    dbError(propertyError);
    return { ...estate, linked_property_count: (properties || []).length };
  }));
}

export async function listEstateFaqs(organizationId: string, estateId: string): Promise<EstateFaq[]> {
  const org = organization(organizationId);
  const estate = required(estateId, "estateId");
  await requireEstate(org, estate);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("real_estate_estate_faqs")
    .select("*")
    .eq("organization_id", org)
    .eq("estate_id", estate)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  dbError(error);
  return (data || []) as EstateFaq[];
}

export async function getEstate(organizationId: string, estateId: string): Promise<EstateWithRelations | null> {
  const org = organization(organizationId);
  const estate = required(estateId, "estateId");
  const admin = createAdminClient();
  const { data: estateRow, error: estateError } = await admin
    .from("real_estate_estates")
    .select("*")
    .eq("organization_id", org)
    .eq("id", estate)
    .maybeSingle();
  dbError(estateError);
  if (!estateRow) return null;

  const { data: linkedProperties, error: propertyError } = await admin
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("organization_id", org)
    .eq("estate_id", estate)
    .order("updated_at", { ascending: false, nullsFirst: false });
  dbError(propertyError);

  const { data: faqs, error: faqError } = await admin
    .from("real_estate_estate_faqs")
    .select("*")
    .eq("organization_id", org)
    .eq("estate_id", estate)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  dbError(faqError);

  return {
    estate: { ...(estateRow as Estate), linked_property_count: (linkedProperties || []).length },
    faqs: (faqs || []) as EstateFaq[],
    linkedProperties: (linkedProperties || []) as unknown as CanonicalProperty[],
  };
}

export async function saveEstate(organizationId: string, input: EstateSaveInput, actorId:string): Promise<Estate> {
  const org = organization(organizationId);
  const name = required(input?.name, "name");
  const id = optionalText(input?.id);
  const payload: Record<string, unknown> = { name };
  const fields = ["description", "location", "address", "contact_name", "contact_email", "contact_phone", "cover_image_url", "operating_instructions", "terms_of_service"] as const;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(input || {}, field)) payload[field] = optionalText(input[field]);
  }
  if (Object.prototype.hasOwnProperty.call(input || {}, "payment_terms")) payload.payment_terms = input.payment_terms ?? {};
  if (input?.status !== undefined) payload.status = estateStatus(input.status);
  if (input?.knowledge_status !== undefined) payload.knowledge_status = knowledgeStatus(input.knowledge_status);
  if (input?.provenance !== undefined) payload.provenance = input.provenance;

  return auditedRow<Estate>(createAdminClient(),"save_real_estate_estate_with_audit",{p_organization_id:org,p_actor_id:required(actorId,"actorId"),p_estate_id:id,p_payload:payload},isEstate,"Estate was not found in this organization.");
}

function faqPayload(input: EstateFaqSaveInput) {
  const payload: Record<string, unknown> = {
    question: required(input?.question, "question"),
    answer: required(input?.answer, "answer"),
  };
  if (Object.prototype.hasOwnProperty.call(input || {}, "category")) payload.category = optionalText(input.category);
  if (Object.prototype.hasOwnProperty.call(input || {}, "sort_order")) payload.sort_order = sortOrder(input.sort_order);
  if (input?.provenance !== undefined) payload.provenance = input.provenance;
  return payload;
}

export async function saveEstateFaq(organizationId: string, estateId: string, input: EstateFaqSaveInput, actorId:string): Promise<EstateFaq> {
  const org = organization(organizationId);
  const estate = required(estateId, "estateId");
  const id = optionalText(input?.id);
  return auditedRow<EstateFaq>(createAdminClient(),"save_real_estate_estate_faq_with_audit",{p_organization_id:org,p_actor_id:required(actorId,"actorId"),p_estate_id:estate,p_faq_id:id,p_payload:faqPayload(input)},isEstateFaq,"FAQ was not found in this estate and organization.");
}

export async function deleteEstateFaq(organizationId: string, estateId: string, faqId: string, actorId:string): Promise<boolean> {
  const org = organization(organizationId);
  const estate = required(estateId, "estateId");
  const faq = required(faqId, "faqId");
  const {data,error}=await createAdminClient().rpc("delete_real_estate_estate_faq_with_audit",{p_organization_id:org,p_actor_id:required(actorId,"actorId"),p_estate_id:estate,p_faq_id:faq});dbError(error);
  return Boolean(data);
}

export async function reorderEstateFaqs(organizationId: string, estateId: string, orderedFaqIds: string[], actorId:string): Promise<EstateFaq[]> {
  const org = organization(organizationId);
  const estate = required(estateId, "estateId");
  const ids = orderedFaqIds.map((id) => required(id, "FAQ id"));
  if (new Set(ids).size !== ids.length) throw new Error("FAQ reorder IDs must be unique.");
  const {data,error}=await createAdminClient().rpc("reorder_real_estate_estate_faqs_with_audit",{p_organization_id:org,p_actor_id:required(actorId,"actorId"),p_estate_id:estate,p_faq_ids:ids});dbError(error);
  return (Array.isArray(data)?data:data?[data]:[]) as EstateFaq[];
}

export async function assignPropertyToEstate(organizationId: string, propertyId: string, estateId: string | null, actorId:string): Promise<CanonicalProperty> {
  const org = organization(organizationId);
  const property = required(propertyId, "propertyId");
  const targetEstate = estateId === null ? null : required(estateId, "estateId");
  const row=await auditedRow<CanonicalProperty>(createAdminClient(),"assign_real_estate_property_with_audit",{p_organization_id:org,p_actor_id:required(actorId,"actorId"),p_property_id:property,p_estate_id:targetEstate},isCanonicalProperty,"Property was not found in this organization.");
  return row;
}
