"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleAuthButton({
  nextPath="/portal",
  label="Continue with Google",
}:{
  nextPath?:string;
  label?:string;
}){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const safeNext=nextPath.startsWith("/")?nextPath:"/portal";

  async function start(){
    setLoading(true);setError("");
    try{
      const supabase=createClient();
      const redirect=new URL("/auth/callback",window.location.origin);
      redirect.searchParams.set("next",safeNext);
      const {error:oauthError}=await supabase.auth.signInWithOAuth({
        provider:"google",
        options:{
          redirectTo:redirect.toString(),
          scopes:"openid email profile",
        },
      });
      if(oauthError) throw oauthError;
    }catch(err){
      setError(err instanceof Error?err.message:"Unable to start Google sign-in.");
      setLoading(false);
    }
  }

  return <div>
    <button type="button" onClick={()=>void start()} disabled={loading}>
      {loading?"Opening Google...":label}
    </button>
    {error?<p className="admin-error">{error}</p>:null}
  </div>;
}
