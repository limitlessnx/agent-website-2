"use server";

import { revalidatePath } from "next/cache";
import { generateStaticGraphicForPost } from "@/lib/social-static-graphics";

export async function generateStaticGraphicAction(formData: FormData) {
  const postId = String(formData.get("post_id") || "").trim();
  if (!postId) throw new Error("Post ID is missing.");

  await generateStaticGraphicForPost(postId);

  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/posts");
  revalidatePath("/dashboard/social/assets");
}
