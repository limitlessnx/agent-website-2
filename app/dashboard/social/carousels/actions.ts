"use server";

import { revalidatePath } from "next/cache";
import { generateCarouselForPost } from "@/lib/social-carousels";

export async function generateCarouselAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "").trim();
  if (!postId) throw new Error("Post ID is missing.");

  await generateCarouselForPost(postId);

  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/posts");
  revalidatePath("/dashboard/social/assets");
}
