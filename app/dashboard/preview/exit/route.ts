import { isSpeculativeRequest } from "@/lib/speculative-request";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(request: Request) {
  if (isSpeculativeRequest(request)) return new NextResponse(null, {status:204});
  const session = await getAdminSession();
  const response = NextResponse.redirect(new URL(session ? "/dashboard" : "/login", request.url));
  response.cookies.set("fluxknight_admin_tenant_preview_v2", "", {httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path: "/", maxAge: 0});
  for(const path of ["/", "/portal", "/portal/"]) response.headers.append("Set-Cookie", `fluxknight_admin_tenant_preview=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return response;
}
