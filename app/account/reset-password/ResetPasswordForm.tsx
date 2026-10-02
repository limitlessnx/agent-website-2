"use client";

import Link from "next/link";
import { useState } from "react";
import PasswordField from "../PasswordField";

export default function ResetPasswordForm(){
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const data=new FormData(event.currentTarget);
    const password=String(data.get("password")||"");
    const confirmation=String(data.get("password_confirmation")||"");
    if(password!==confirmation){setError("Passwords do not match.");setLoading(false);return;}
    try{
      const response=await fetch("/api/client-auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password,password_confirmation:confirmation})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){setError(result.error||"Unable to update your password.");return;}
      setMessage("Your password has been updated. You can now sign in.");
    }catch{setError("We could not connect to the account service. Check your connection and try again.");}
    finally{setLoading(false);}
  }

  return <form onSubmit={submit} className="admin-login-card">
    <div><h1>Choose a new password</h1><p className="admin-muted">Use a password you haven’t used elsewhere.</p></div>
    {message?<p className="admin-form-message">{message}</p>:null}
    {error?<p className="admin-error">{error}</p>:null}
    {!message?<><PasswordField name="password" label="New password" autoComplete="new-password" minLength={8}/><PasswordField name="password_confirmation" label="Confirm new password" autoComplete="new-password" minLength={8}/><button type="submit" disabled={loading}>{loading?"Updating...":"Update password"}</button></>:null}
    {message?<p className="admin-muted"><Link href="/account/login">Return to sign in</Link></p>:null}
  </form>;
}
