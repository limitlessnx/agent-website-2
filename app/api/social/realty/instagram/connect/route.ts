import {NextResponse} from "next/server";
import {getAdminSession} from "@/lib/admin-auth";
import {requireRealtySocialAdmin} from "@/lib/social-real-estate-access";
import {buildInstagramAuthorizationUrl} from "@/lib/instagram-login";
import {createRealtyInstagramState,realtyInstagramCookie} from "@/lib/social-realty-instagram-state";
import {realtyInstagramApp,realtyInstagramOrigin,REALTY_INSTAGRAM_CALLBACK} from "@/lib/social-realty-instagram";

export async function GET(request:Request){
  const url=new URL(request.url);
  let origin=url.origin;
  try{
    const session=await getAdminSession();if(!session)throw new Error("Sign in as an administrator first.");
    await requireRealtySocialAdmin();
    origin=realtyInstagramOrigin(request);
    const {appId}=await realtyInstagramApp();
    const state=createRealtyInstagramState(session.email,session.issuedAt,url.searchParams.get("account")||"");
    const response=NextResponse.redirect(buildInstagramAuthorizationUrl({appId,redirectUri:new URL(REALTY_INSTAGRAM_CALLBACK,origin).href,state}));
    response.cookies.set(realtyInstagramCookie(),state,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:600});
    return response;
  }catch(error){
    const target=new URL("/dashboard/social/integrations",origin);target.searchParams.set("error",error instanceof Error?error.message:"Unable to start Instagram authorization.");return NextResponse.redirect(target);
  }
}
