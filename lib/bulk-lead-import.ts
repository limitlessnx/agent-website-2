import {
  normalizeLeadPhone,
  saveProgressiveLead,
  type ProgressiveLeadInput,
} from "@/lib/lead-profile-service";

export type BulkLeadImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

const BATCH_SIZE = 50;

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function importProgressiveLeadsInBatches(
  inputs: ProgressiveLeadInput[],
): Promise<BulkLeadImportResult> {
  const result: BulkLeadImportResult = { imported: 0, skipped: 0, errors: [] };
  const seen = new Set<string>();
  const valid: ProgressiveLeadInput[] = [];

  for (const input of inputs) {
    const phone = normalizeLeadPhone(String(input.phone || ""));
    const name = String(input.name || "").trim();

    if (!name || !phone || seen.has(phone)) {
      result.skipped += 1;
      continue;
    }

    seen.add(phone);
    valid.push({
      ...input,
      name,
      phone,
      email: String(input.email || "").trim() || undefined,
      source: input.source || "admin_dashboard_import",
    });
  }

  for (const batch of chunks(valid, BATCH_SIZE)) {
    const settled = await Promise.allSettled(batch.map((lead) => saveProgressiveLead(lead)));

    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        result.imported += 1;
        return;
      }

      const lead = batch[index];
      const reason = outcome.reason instanceof Error ? outcome.reason.message : "Save failed";
      result.errors.push(`${lead.name || lead.phone}: ${reason}`);
    });
  }

  return result;
}
