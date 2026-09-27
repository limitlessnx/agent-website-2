"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  FLUX_CREDIT_MIN_TOPUP_USD,
  FLUX_CREDITS_PER_USD,
} from "@/lib/flux-topups";

const PRESETS=[10,25,50,100];

export default function FluxCreditTopUpForm(){
  const [amount,setAmount]=useState(10);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const credits=useMemo(()=>Math.max(0,Math.round((Number(amount)||0)*FLUX_CREDITS_PER_USD)),[amount]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setMessage("");
    if(!Number.isFinite(amount)||amount<FLUX_CREDIT_MIN_TOPUP_USD){
      setMessage("Minimum top-up is $10.");
      return;
    }
    setBusy(true);
    try{
      const response=await fetch("/api/portal/billing/top-up",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({amountUsd:amount}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||"Unable to start top-up.");
      if(!body.checkoutUrl) throw new Error("Payment checkout URL was not returned.");
      window.location.href=body.checkoutUrl;
    }catch(error){
      setMessage(error instanceof Error?error.message:"Unable to start top-up.");
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
    <div className="portal-actions" style={{marginBottom:14}}>
      {PRESETS.map((preset)=><button
        type="button"
        className="portal-button secondary"
        key={preset}
        onClick={()=>setAmount(preset)}
        disabled={busy}
      >{"$"+preset}</button>)}
    </div>
    <div className="portal-field">
      <label htmlFor="flux-topup-amount">Top-up amount (USD)</label>
      <input
        id="flux-topup-amount"
        type="number"
        min={FLUX_CREDIT_MIN_TOPUP_USD}
        step="0.01"
        value={amount}
        onChange={(event)=>setAmount(Number(event.target.value))}
        disabled={busy}
      />
    </div>
    <div className="portal-list" style={{marginTop:14}}>
      <div className="portal-list-row">
        <div><strong>You receive</strong><span>1 Flux Credit = $0.01</span></div>
        <em>{credits.toLocaleString()} credits</em>
      </div>
    </div>
    <div className="portal-actions" style={{marginTop:14}}>
      <button type="submit" className="portal-button" disabled={busy||amount<FLUX_CREDIT_MIN_TOPUP_USD}>
        {busy?"Opening secure checkout...":"Buy Flux Credits"}
      </button>
    </div>
    {message?<p className="portal-empty">{message}</p>:null}
  </form>;
}
