import { requireTenant } from "@/lib/tenant";
import type { SocialPost, SocialPostFormat } from "@/lib/social";

export type SocialReviewReadiness = {
  ready: boolean;
  reason: string | null;
};

function hasString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function mediaReady(format: SocialPostFormat, metadata: Record<string, unknown>): SocialReviewReadiness {
  if (format === "text") return { ready: true, reason: null };

  if (format === "image") {
    return hasString(metadata.primary_asset_id)
      ? { ready: true, reason: null }
      : { ready: false, reason: "Generate or upload the final static graphic before approval." };
  }

  if (format === "carousel") {
    const ids = Array.isArray(metadata.carousel_asset_ids) ? metadata.carousel_asset_ids.filter(hasString) : [];
    return ids.length >= 2
      ? { ready: true, reason: null }
      : { ready: false, reason: "Generate the final carousel slides before approval." };
  }

  if (format === "reel" || format === "video") {
    const ready = hasString(metadata.reel_asset_id) && metadata.reel_render_status === "ready";
    return ready
      ? { ready: true, reason: null }
      : { ready: false, reason: "Render the final Reel/video before approval." };
  }

  if (format === "story") {
    return hasString(metadata.primary_asset_id)
      ? { ready: true, reason: null }
      : { ready: false, reason: "Attach the final Story asset before approval." };
  }

  return { ready: false, reason: "This post format is not ready for approval." };
}

export function getSocialReviewReadiness(post: Pick<SocialPost, "format" | "metadata">): SocialReviewReadiness {
  return mediaReady(post.format, post.metadata || {});
}

function historyEntry(type: string, details: Record<string, unknown> = {}) {
  return { type, at: new Date().toISOString(), ...details };
}

function appendHistory(metadata: Record<string, unknown>, entry: Record<string, unknown>) {
  const prior = Array.isArray(metadata.review_history) ? metadata.review_history : [];
  return [...prior.slice(-19), entry];
}

export async function updateSocialPostReview(input: {
  postId: string;
  title: string;
  hook: string;
  caption: string;
  cta: string;
}) {
  const { supabase, organizationId } = await requireTenant();
  const { data: post, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", input.postId)
    .single();
  if (error) throw error;
  if (["scheduled", "published"].includes(post.status)) {
    throw new Error("Scheduled or published posts cannot be edited from Review.");
  }

  const metadata = (post.metadata || {}) as Record<string, unknown>;
  const content = (post.content || {}) as Record<string, unknown>;
  const snapshot = {
    title: post.title,
    caption: post.caption,
    hook: content.hook || "",
    cta: content.cta || "",
    status: post.status,
  };

  const nextStatus = post.status === "approved" ? "review" : post.status;
  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      title: input.title.trim(),
      caption: input.caption.trim(),
      status: nextStatus,
      approved_at: nextStatus === "approved" ? post.approved_at : null,
      content: {
        ...content,
        hook: input.hook.trim(),
        cta: input.cta.trim(),
      },
      metadata: {
        ...metadata,
        review_history: appendHistory(metadata, historyEntry("edited", { snapshot })),
        last_review_edit_at: new Date().toISOString(),
      },
    })
    .eq("organization_id", organizationId)
    .eq("id", input.postId);
  if (updateError) throw updateError;
}

export async function rejectSocialPostReview(postId: string, reason: string) {
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("Add a rejection reason so the next revision knows what to fix.");

  const { supabase, organizationId } = await requireTenant();
  const { data: post, error } = await supabase
    .from("social_posts")
    .select("id,status,metadata")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .single();
  if (error) throw error;
  if (!["review", "approved"].includes(post.status)) throw new Error("Only review/approved posts can be rejected.");

  const metadata = (post.metadata || {}) as Record<string, unknown>;
  const rejectedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      status: "draft",
      approved_at: null,
      metadata: {
        ...metadata,
        review_rejection_reason: cleanReason,
        review_rejected_at: rejectedAt,
        review_history: appendHistory(metadata, historyEntry("rejected", { reason: cleanReason })),
      },
    })
    .eq("organization_id", organizationId)
    .eq("id", postId);
  if (updateError) throw updateError;
}

export async function approveSocialPostReview(postId: string) {
  const { supabase, organizationId } = await requireTenant();
  const { data: post, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .single();
  if (error) throw error;
  if (post.status !== "review") throw new Error("Only posts currently in Review can be approved.");

  const typedPost = post as SocialPost;
  const readiness = getSocialReviewReadiness(typedPost);
  if (!readiness.ready) throw new Error(readiness.reason || "Finish the creative before approval.");

  const metadata = (typedPost.metadata || {}) as Record<string, unknown>;
  const approvedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      status: "approved",
      approved_at: approvedAt,
      metadata: {
        ...metadata,
        review_rejection_reason: null,
        review_approved_at: approvedAt,
        review_history: appendHistory(metadata, historyEntry("approved")),
      },
    })
    .eq("organization_id", organizationId)
    .eq("id", postId);
  if (updateError) throw updateError;
}
