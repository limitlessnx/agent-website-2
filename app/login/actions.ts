"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function loginErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("Supabase configuration error")) {
      return "Login service is not configured correctly. Please contact the administrator.";
    }

    if (error.message.toLowerCase().includes("fetch failed")) {
      return "Login service is temporarily unreachable. Please try again shortly.";
    }

    return error.message;
  }

  return "Unable to sign in. Please try again.";
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
  } catch (error) {
    redirect(`/login?error=${encodeURIComponent(loginErrorMessage(error))}`);
  }

  redirect(next.startsWith("/dashboard") ? next : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
