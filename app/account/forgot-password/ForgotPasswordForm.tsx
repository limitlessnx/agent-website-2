"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordForm({nextPath="/portal"}:{nextPath?:string}){
  const [email,setEmail]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);
  const safeNext=nextPath.startsWith("/")&&!nextPath.startsWith("//")?nextPath:"/portal";

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try{
      const response=await fetch("/api/client-auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,next:safeNext})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){setError(result.error||"Unable to send the reset email.");return;}
      setMessage("If an account exists for that email, a Fluxknight password reset link is on its way.");
    }catch{setError("We could not connect to the account service. Check your connection and try again.");}
    finally{setLoading(false);}
  }

  return <form onSubmit={submit} className="admin-login-card">
    <div><h1>Reset your password</h1><p className="admin-muted">Enter your email and we’ll send a secure Fluxknight reset link.</p></div>
    {message?<p className="admin-form-message">{message}</p>:null}
    {error?<p className="admin-error">{error}</p>:null}
    <label>Email<input name="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <button type="submit" disabled={loading}>{loading?"Sending...":"Send reset link"}</button>
    <p className="admin-muted"><Link href={`/account/login?next=${encodeURIComponent(safeNext)}`}>Back to sign in</Link></p>
  </form>;
}
