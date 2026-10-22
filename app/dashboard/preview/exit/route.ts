import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const session = await getAdminSession();
  const response = NextResponse.redirect(new URL(session ? "/dashboard" : "/login", request.url));
  response.cookies.set("fluxknight_admin_tenant_preview", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: 0,
  });
  return response;
}
