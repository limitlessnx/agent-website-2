"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Users } from "@/components/admin/ServerIcons";

export default function AccountModeClient(){
  const router=useRouter();
  const searchParams=useSearchParams();
  const isNewGoogleAccount=searchParams.get("source")==="google"&&searchParams.get("new_account")==="1";
  const [loading,setLoading]=useState<"organization"|"manager"|null>(null);
  const [error,setError]=useState("");

  async function choose(accountMode:"organization"|"manager"){
    setLoading(accountMode); setError("");
    try{
      const response=await fetch("/api/client-auth/account-mode",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account_mode:accountMode})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){setError(result.error||"Unable to save your account choice.");return;}
      router.push(result.redirect_to||"/account/setup");
      router.refresh();
    }catch{setError("We could not save your account choice. Please try again.");}
    finally{setLoading(null);}
  }

  return <div className="admin-login-card">
    <p className="admin-kicker">{isNewGoogleAccount?"Google sign-in successful":"Welcome to Fluxknight"}</p>
    <h1>{isNewGoogleAccount?"Continue creating your account":"How will you use Fluxknight?"}</h1>
    <p className="admin-muted">{isNewGoogleAccount?"Your Google identity is verified, but you have not finished creating your Fluxknight account. Choose how you want to continue.":"Choose how you want to use your account. You can manage organizations without creating a business workspace."}</p>
    <button type="button" onClick={()=>choose("organization")} disabled={Boolean(loading)}><Building2 size={19}/> <span><strong>Start an Organization</strong><small>Create and manage your own business workspace.</small></span></button>
    <button type="button" onClick={()=>choose("manager")} disabled={Boolean(loading)}><Users size={19}/> <span><strong>Manage Organizations</strong><small>Join organizations you are invited or approved to manage.</small></span></button>
    {error?<p className="admin-error">{error}</p>:null}
  </div>;
}
