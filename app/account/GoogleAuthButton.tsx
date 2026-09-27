"use client";

import { useState } from "react";

export default function GoogleAuthButton({
  nextPath="/portal",
  label="Continue with Google",
  txRef="",
  trialPlan="",
  invitationToken="",
}:{
  nextPath?:string;
  label?:string;
  txRef?:string;
  trialPlan?:""|"basic";
  invitationToken?:string;
}){
  const [loading,setLoading]=useState(false);
  const safeNext=nextPath.startsWith("/")&&!nextPath.startsWith("//")?nextPath:"/portal";

  function start(){
    setLoading(true);
    const target=new URL("/api/client-auth/google/start",window.location.origin);
    target.searchParams.set("next",safeNext);
    if(txRef) target.searchParams.set("tx_ref",txRef);
    if(trialPlan==="basic") target.searchParams.set("trial","basic");
    if(invitationToken) target.searchParams.set("invitation_token",invitationToken);
    window.location.assign(target.toString());
  }

  return <button type="button" onClick={start} disabled={loading}>
    {loading?"Opening Google...":label}
  </button>;
}
