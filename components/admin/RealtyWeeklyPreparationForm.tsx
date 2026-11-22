"use client";
import {useActionState} from "react";
import {prepareRealtyWeekAction} from "@/app/dashboard/social/real-estate-actions";
import {ReviewSubmitButton} from "@/app/dashboard/social/review/ReviewSubmitButton";
export default function RealtyWeeklyPreparationForm({week,requestId,ready}:{week:string;requestId:string;ready:boolean}){
  const[state,action]=useActionState(prepareRealtyWeekAction,{error:null,message:null});
  return <form action={action} style={{display:"grid",gap:14}}>
    <input type="hidden" name="request_id" value={requestId}/>
    <label>Week starting Monday<input type="date" name="week_start" required defaultValue={week} style={{display:"block",padding:12,minWidth:0,maxWidth:"100%",background:"var(--fk-surface)",color:"var(--fk-text)",border:"1px solid var(--fk-border)",borderRadius:10}}/></label>
    {state.error?<p role="alert">{state.error}</p>:null}{state.message?<p role="status">{state.message}</p>:null}
    <ReviewSubmitButton kind="primary" disabled={!ready} pendingLabel="Requesting weekly preparation…">Prepare weekly carousels</ReviewSubmitButton>
  </form>;
}
