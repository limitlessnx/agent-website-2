"use client";
import {useActionState,useState} from "react";
import {saveRealtyIdentityAction} from "@/app/dashboard/social/real-estate-brand-actions";
import {ReviewSubmitButton} from "@/app/dashboard/social/review/ReviewSubmitButton";

export default function RealtyBrandIdentityForm({identity,weekly}:{identity:Record<string,unknown>;weekly:boolean}){
  const [state,action]=useActionState(saveRealtyIdentityAction,{error:null,message:null});
  const [values,setValues]=useState(()=>Object.fromEntries(['background','surface','accent','text','muted','font','footer','website'].map(key=>[key,String(identity[key]||(key==='font'?'geist':''))])));
  const [approved,setApproved]=useState(false),[automatic,setAutomatic]=useState(weekly);
  const input={minWidth:0,width:"100%",padding:12,borderRadius:10,border:"1px solid var(--fk-border)",background:"var(--fk-surface)",color:"var(--fk-text)"};
  return <section className="admin-panel"><h2>Limitless Realty visual identity</h2><p>Upload the approved PNG logo in Brand assets, then approve the colors, typography and footer used on carousel slides.</p>
    <form action={action} style={{display:"grid",gap:18}}>
      <div className="admin-grid two">{['background','surface','accent','text','muted'].map(key=><label key={key} style={{display:"grid",gap:6}}>{key[0].toUpperCase()+key.slice(1)} color<input name={key} required pattern="#[0-9a-fA-F]{6}" placeholder="#RRGGBB" value={values[key]} onChange={event=>setValues(current=>({...current,[key]:event.target.value}))} style={input}/></label>)}</div>
      <label>Typeface<select name="font" value={values.font} onChange={event=>setValues(current=>({...current,font:event.target.value}))} style={input}><option value="geist">Geist (bundled)</option></select></label>
      <label>Approved slide footer<input name="footer" required maxLength={110} value={values.footer} onChange={event=>setValues(current=>({...current,footer:event.target.value}))} style={input}/></label>
      <label>Organization website (optional)<input name="website" type="url" placeholder="https://your-approved-website" value={values.website} onChange={event=>setValues(current=>({...current,website:event.target.value}))} style={input}/></label>
      <label style={{display:"flex",gap:12,alignItems:"flex-start"}}><input type="checkbox" name="approved" value="yes" required checked={approved} onChange={event=>setApproved(event.target.checked)}/>I approve the current logo, palette, typography and footer for Limitless Realty content.</label>
      <label style={{display:"flex",gap:12,alignItems:"flex-start"}}><input type="checkbox" name="weekly_automation" value="yes" checked={automatic} onChange={event=>setAutomatic(event.target.checked)}/>Prepare seven researched carousels automatically each Monday using the connected AI services. Each batch still requires human review; this does not enable automatic publishing.</label>
      {state.error?<p role="alert">{state.error}</p>:null}{state.message?<p role="status">{state.message}</p>:null}
      <ReviewSubmitButton kind="primary" pendingLabel="Saving identity…">Save approved identity</ReviewSubmitButton>
    </form>
  </section>;
}
