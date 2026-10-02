"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck, Sparkles } from "@/components/admin/ServerIcons";
import type { ClientOnboardingProfile } from "@/lib/client-workspace-onboarding";

const outcomes = [
  ["answer_questions", "Answer customer questions"], ["generate_leads", "Capture new leads"],
  ["qualify_prospects", "Qualify prospects"], ["follow_up_leads", "Follow up with prospects"],
  ["book_appointments", "Book appointments"], ["customer_support", "Handle customer support"],
  ["explain_offers", "Explain products or services"], ["send_reminders", "Send reminders"],
  ["collect_customer_info", "Collect customer information"], ["human_handoff", "Transfer conversations to my team"],
];
const toggle=(values:string[],value:string)=>values.includes(value)?values.filter(v=>v!==value):[...values,value];

type FormState={
  business_name:string; industry:string; business_description:string; website:string; country:string;
  timezone:string; business_email:string; phone:string; business_goals:string[]; ai_requirements:string;
  business_knowledge:Record<string,string>;
  whatsapp_preferences:{connection_path:"already_have_whatsapp_business"|"need_help";preferred_number:string};
};

export default function OnboardingForm({initialProfile}:{initialProfile:ClientOnboardingProfile}){
  const router=useRouter();
  const [step,setStep]=useState(Math.min(initialProfile.current_step||1,5));
  const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const [form,setForm]=useState<FormState>({
    business_name:initialProfile.business_name||"",industry:initialProfile.industry||"",
    business_description:initialProfile.business_description||"",website:initialProfile.website||"",
    country:initialProfile.country||"Nigeria",timezone:initialProfile.timezone||"Africa/Lagos",
    business_email:initialProfile.business_email||"",phone:initialProfile.phone||"",
    business_goals:initialProfile.business_goals||[],ai_requirements:initialProfile.ai_requirements||"",
    business_knowledge:initialProfile.business_knowledge||{},
    whatsapp_preferences:{
      connection_path:initialProfile.whatsapp_preferences?.connection_path||"need_help",
      preferred_number:initialProfile.whatsapp_preferences?.preferred_number||initialProfile.phone||"",
    },
  });
  const progress=useMemo(()=>`${Math.round(step/5*100)}%`,[step]);

  async function save(nextStep=step){
    setSaving(true);setError("");
    const response=await fetch("/api/client-onboarding",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,current_step:nextStep,channels:["WhatsApp"],existing_tools:[],requested_agents:[]})});
    const result=await response.json().catch(()=>({}));setSaving(false);
    if(!response.ok)throw new Error(result.error||"Unable to save onboarding progress.");
  }
  async function next(){
    try{
      if(step===1&&(!form.business_name.trim()||!form.business_description.trim()))return setError("Business name and a short description are required.");
      if(step===2&&(!form.business_goals.length||!form.ai_requirements.trim()))return setError("Choose at least one outcome and tell us what you want your AI to handle.");
      if(step===3&&!Object.values(form.business_knowledge).some(v=>v.trim()))return setError("Add at least one piece of business knowledge.");
      const nextStep=Math.min(5,step+1);await save(nextStep);setStep(nextStep);
    }catch(e){setError(e instanceof Error?e.message:"Unable to continue.");}
  }
  async function submit(){
    try{
      setSaving(true);setError("");await save(5);
      const response=await fetch("/api/client-onboarding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"complete"})});
      const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Unable to submit setup.");
      router.push("/portal");router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Unable to submit setup.");}finally{setSaving(false);}
  }

  return <div className="onboarding-shell">
    <div className="onboarding-topline"><div className="onboarding-brandmark"><Sparkles size={14}/> Fluxknight</div><span>Private workspace setup</span></div>
    <div className="onboarding-progress"><span style={{width:progress}}/></div>
    <div className="onboarding-heading"><div><div className="small-label"><Sparkles size={13}/> Business setup</div><p>Step {step} of 5</p></div><strong>{progress}</strong></div>

    {step===1&&<section><h1>Tell Fluxknight about your business.</h1><p>Give us the context. We handle the technical architecture behind your AI team.</p>
      <div className="form-grid two">
        <label>Business name<input value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} placeholder="e.g. Acme Properties"/></label>
        <label>Business type<input value={form.industry} onChange={e=>setForm({...form,industry:e.target.value})} placeholder="e.g. Real estate agency"/></label>
        <label className="full">What does your business do?<textarea rows={4} value={form.business_description} onChange={e=>setForm({...form,business_description:e.target.value})} placeholder="Describe what you sell, who you serve, and what customers usually come to you for."/></label>
        <label>Website <span className="optional">optional</span><input type="url" value={form.website} onChange={e=>setForm({...form,website:e.target.value})} placeholder="https://"/></label>
        <label>Business email<input type="email" value={form.business_email} onChange={e=>setForm({...form,business_email:e.target.value})}/></label>
        <label>WhatsApp / phone <span className="optional">optional</span><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value,whatsapp_preferences:{...form.whatsapp_preferences,preferred_number:e.target.value}})} placeholder="+234..."/></label>
        <label>Business location <span className="optional">optional</span><input value={form.country} onChange={e=>setForm({...form,country:e.target.value})} placeholder="Country or city"/></label>
      </div>
    </section>}

    {step===2&&<section><h1>What should your AI handle?</h1><p>Pick the outcomes you want. Fluxknight turns these into the right agent behavior.</p>
      <div className="choice-grid">{outcomes.map(([value,label])=><button type="button" key={value} className={form.business_goals.includes(value)?"selected":""} onClick={()=>setForm({...form,business_goals:toggle(form.business_goals,value)})}>{form.business_goals.includes(value)&&<Check size={16}/>}<span>{label}</span></button>)}</div>
      <label className="stacked-field">Anything else you want the AI to handle?<textarea rows={5} value={form.ai_requirements} onChange={e=>setForm({...form,ai_requirements:e.target.value})} placeholder="Describe the conversations, tasks or decisions you want Fluxknight to take care of."/></label>
    </section>}

    {step===3&&<section><h1>Teach Fluxknight your business.</h1><p>The more useful context you give us, the more accurately your AI can represent your business.</p>
      <div className="knowledge-stack">{[
        ["services","Products & services","What do you offer? Include the important differences between services."],
        ["faqs","FAQs","Paste common customer questions and the answers you want the agent to use."],
        ["pricing","Pricing","Share prices, packages, starting prices or explain where pricing varies."],
        ["hours","Opening hours","Tell us when you are open and when customers should expect replies."],
        ["policies","Policies","Refunds, cancellations, eligibility, delivery, privacy or other rules."],
        ["booking","Booking / sales process","Explain how a customer moves from enquiry to booking or purchase."],
      ].map(([key,label,placeholder])=><label key={key}>{label}<textarea rows={4} value={form.business_knowledge[key]||""} onChange={e=>setForm({...form,business_knowledge:{...form.business_knowledge,[key]:e.target.value}})} placeholder={placeholder}/></label>)}</div>
      <p className="knowledge-note">Website sources and documents can be connected by the Fluxknight team during setup. You do not need to configure APIs or webhooks.</p>
    </section>}

    {step===4&&<section><div className="setup-card"><div className="setup-card-icon"><ShieldCheck size={20}/></div><div><strong>WhatsApp AI agent is included in your trial.</strong><p>We handle the technical setup. You only need to tell us which starting path applies to you.</p></div></div>
      <h1>Connect your WhatsApp.</h1><p>We handle the connection and technical setup for you.</p>
      <div className="choice-grid whatsapp-choice">
        <button type="button" className={form.whatsapp_preferences.connection_path==="already_have_whatsapp_business"?"selected":""} onClick={()=>setForm({...form,whatsapp_preferences:{...form.whatsapp_preferences,connection_path:"already_have_whatsapp_business"}})}><Check size={16}/><span><strong>I already have WhatsApp Business</strong><small>Use my existing business number during setup.</small></span></button>
        <button type="button" className={form.whatsapp_preferences.connection_path==="need_help"?"selected":""} onClick={()=>setForm({...form,whatsapp_preferences:{...form.whatsapp_preferences,connection_path:"need_help"}})}><Check size={16}/><span><strong>I need help setting it up</strong><small>Fluxknight will guide the connection.</small></span></button>
      </div>
      <label className="stacked-field">Preferred WhatsApp number <span className="optional">optional</span><input value={form.whatsapp_preferences.preferred_number} onChange={e=>setForm({...form,whatsapp_preferences:{...form.whatsapp_preferences,preferred_number:e.target.value}})} placeholder="+234..."/></label>
    </section>}

    {step===5&&<section><h1>Your setup brief is ready.</h1><p>Review the handoff. Once submitted, it goes to the Fluxknight setup team for configuration and testing.</p>
      <div className="review-list">
        <article><span>Business</span><strong>{form.business_name||"Not provided"}</strong><p>{form.business_description||"No description provided"}</p></article>
        <article><span>AI responsibilities</span><strong>{form.business_goals.length} selected outcomes</strong><p>{form.ai_requirements}</p></article>
        <article><span>Business knowledge</span><strong>{Object.values(form.business_knowledge).filter(Boolean).length} knowledge sections</strong><p>Services, FAQs, pricing, hours, policies and booking information are included where provided.</p></article>
        <article><span>WhatsApp</span><strong>Included with trial</strong><p>{form.whatsapp_preferences.connection_path==="already_have_whatsapp_business"?"Existing WhatsApp Business number":"Needs setup assistance"}</p></article>
      </div>
      <div className="submission-note"><ShieldCheck size={18}/><div><strong>What happens next</strong><p>Fluxknight reviews your brief, configures your AI agent, prepares its knowledge and handles the WhatsApp setup. You will see the activation status in your workspace.</p></div></div>
    </section>}

    {error&&<p className="onboarding-error" role="alert">{error}</p>}
    <div className="onboarding-actions"><button type="button" className="back" disabled={step===1||saving} onClick={()=>setStep(Math.max(1,step-1))}><ArrowLeft size={17}/> Back</button>{step<5?<button type="button" className="next" disabled={saving} onClick={next}>{saving?<Loader2 className="spin" size={17}:null} Save and continue <ArrowRight size={17}/></button>:<button type="button" className="next" disabled={saving} onClick={submit}>{saving?<Loader2 className="spin" size={17}:<Check size={17}/>} Submit setup</button>}</div>
  </div>;
}
