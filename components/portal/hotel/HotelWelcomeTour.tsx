"use client";
import { useEffect, useState } from "react";
import styles from "./HotelWelcomeTour.module.css";
const steps=[
 {title:"Welcome to your hotel workspace",description:"This is your command centre for bookings, rooms, guest conversations and hotel operations.",target:"hotel-dashboard-header"},
 {title:"Your daily operations",description:"Review arrivals, departures and the reservations that need attention.",target:"hotel-dashboard-stays"},
 {title:"Room availability",description:"Check room inventory and availability before confirming a reservation.",target:"hotel-dashboard-rooms"},
 {title:"Recent bookings",description:"Open and review the latest guest reservations.",target:"hotel-dashboard-bookings"},
 {title:"Guest conversations",description:"Find guest messages and continue conversations from your inbox.",target:"hotel-dashboard-conversations"},
 {title:"Needs your attention",description:"Outstanding requests and important operational tasks appear here.",target:"hotel-dashboard-attention"}
];
const key="fluxknight-hotel-welcome-tour-v1";
export default function HotelWelcomeTour(){
 const [step,setStep]=useState<number|null>(null);
 useEffect(()=>{try{if(localStorage.getItem(key)!=="done")setStep(0);}catch{}},[]);
 useEffect(()=>{if(step===null)return;const element=document.querySelector('[data-tour="'+steps[step].target+'"]');element?.scrollIntoView({behavior:"smooth",block:"center"});},[step]);
 function close(){try{localStorage.setItem(key,"done");}catch{}setStep(null);}
 if(step===null)return <button type="button" className={styles.replay} onClick={()=>setStep(0)}>Take dashboard tour</button>;
 const current=steps[step];
 return <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Hotel dashboard tour"><div className={styles.panel}><span className={styles.count}>GETTING STARTED · {step+1} OF {steps.length}</span><h2>{current.title}</h2><p>{current.description}</p><div className={styles.actions}><button type="button" className={styles.skip} onClick={close}>Skip tour</button><button type="button" className={styles.next} onClick={()=>step===steps.length-1?close():setStep(step+1)}>{step===steps.length-1?"Finish":"Next"}</button></div></div></div>;
}
