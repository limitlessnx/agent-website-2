"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MessagesSquare, UsersRound, Bot, Workflow, ChartNoAxesCombined, CheckCircle2 } from "lucide-react";
import styles from "./ProductShowcase.module.css";

const views = [
  { id:"inbox", label:"Conversations", Icon:MessagesSquare, title:"Keep customer conversations in context.", description:"See how an enquiry can move from a first message to a useful next step, with human handoff when needed.", items:["New WhatsApp enquiry","Maia captures customer requirements","Team receives a qualified handoff"], previewTitle:"Customer conversation", previewRows:[["Customer","Hi, I'd like to know more about your services."],["Maia","Happy to help. What are you looking for?"],["Customer","I'd like to arrange a viewing."],["Maia","I'll collect the details and pass the request to the team."]]},
  { id:"crm", label:"CRM", Icon:UsersRound, title:"Give every lead a clear next step.", description:"Organize customer details and engagement so your team can follow through without losing the conversation.", items:["Customer details captured","Lead stage made visible","Next action recorded"], previewTitle:"Example lead record", previewRows:[["Lead","New enquiry"],["Interest","Property inspection"],["Status","Awaiting team confirmation"],["Next action","Contact customer to confirm availability"]]},
  { id:"ai", label:"AI workforce", Icon:Bot, title:"Let Maia handle the first response.", description:"Maia can answer approved questions, qualify requests and escalate when human attention is needed.", items:["Approved business knowledge","Customer qualification","Human escalation"], previewTitle:"Example Maia workflow", previewRows:[["01","Receive enquiry"],["02","Answer approved questions"],["03","Capture requirements"],["04","Escalate to your team"]]},
  { id:"workflows", label:"Workflows", Icon:Workflow, title:"Make follow-through part of the process.", description:"Coordinate reminders, booking requests and follow-ups according to your organization's enabled configuration.", items:["Trigger from customer activity","Route the next task","Track handoff or reminder"], previewTitle:"Example follow-up sequence", previewRows:[["Trigger","Customer requests an appointment"],["Action","Capture preferred date and time"],["Review","Team confirms availability"],["Follow-up","Send confirmation or reminder when configured"]]},
  { id:"analytics", label:"Visibility", Icon:ChartNoAxesCombined, title:"See what needs attention.", description:"Bring customer activity and workflow status into one place, without relying on disconnected updates.", items:["Conversation visibility","Lead and handoff status","Operational follow-through"], previewTitle:"Example operational overview", previewRows:[["Conversations","Review recent enquiries"],["Leads","Identify pending qualification"],["Bookings","Check requests awaiting confirmation"],["Follow-ups","Review configured reminders"]]},
] as const;

export default function ProductShowcase() {
  const [active,setActive]=useState<string>("inbox");
  const selected=views.find(view=>view.id===active) ?? views[0];
  return <section className={styles.section} id="platform" aria-labelledby="product-showcase-title">
    <div className={styles.shell}>
      <div className={styles.intro}><span className={styles.eyebrow}>Explore the platform</span><h2 id="product-showcase-title">One place for the work behind every customer.</h2><p>Explore how customer conversations, records, AI assistance and follow-through connect. The examples below are illustrative, not live customer data.</p></div>
      <div className={styles.tabs} role="tablist" aria-label="Explore Fluxknight capabilities">
        {views.map(view=><button key={view.id} id={`showcase-tab-${view.id}`} type="button" role="tab" aria-selected={active===view.id} aria-controls="showcase-panel" tabIndex={active===view.id?0:-1} className={active===view.id?styles.active:styles.tab} onClick={()=>setActive(view.id)} onKeyDown={event=>{const index=views.findIndex(item=>item.id===active);const next=event.key==="ArrowRight"?(index+1)%views.length:event.key==="ArrowLeft"?(index+views.length-1)%views.length:-1;if(next>=0){event.preventDefault();setActive(views[next].id);const target=document.getElementById(`showcase-tab-${views[next].id}`);target?.focus();}}}><view.Icon size={17} aria-hidden="true"/>{view.label}</button>)}
      </div>
      <div className={styles.panel} id="showcase-panel" role="tabpanel" aria-labelledby={`showcase-tab-${selected.id}`} tabIndex={0}>
        <div className={styles.copy}><span className={styles.eyebrow}>Connected by design</span><h3>{selected.title}</h3><p>{selected.description}</p><ul>{selected.items.map(item=><li key={item}><CheckCircle2 size={18} aria-hidden="true"/>{item}</li>)}</ul><Link href="/evaluation" className={styles.link}>Explore what fits your business <ArrowRight size={17} aria-hidden="true"/></Link></div>
        <div className={styles.preview}><div className={styles.previewHeader}><div><span className={styles.previewDot}/><span className={styles.previewDot}/><span className={styles.previewDot}/></div><strong>{selected.previewTitle}</strong><span className={styles.demo}>DEMO</span></div><div className={styles.previewContent}>{selected.previewRows.map(([label,detail],index)=><div className={styles.previewRow} key={`${selected.id}-${index}`}><span>{label}</span><p>{detail}</p></div>)}</div><div className={styles.previewFooter}>Illustrative product experience · No customer data</div></div>
      </div>
    </div>
  </section>;
}
