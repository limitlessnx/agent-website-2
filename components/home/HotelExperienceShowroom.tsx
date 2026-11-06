"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BedDouble, UtensilsCrossed, Dumbbell, Waves, ConciergeBell } from "lucide-react";
import styles from "./HotelExperienceShowroom.module.css";
const experiences = [
 {id:"rooms",label:"Suites & stays",Icon:BedDouble,image:"https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=85",title:"Explore the stay before you book",detail:"Discover rooms, ambience and the kind of experience the property offers."},
 {id:"dining",label:"Dining",Icon:UtensilsCrossed,image:"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=85",title:"Discover the dining experience",detail:"See restaurant spaces and explore what the hotel has to offer."},
 {id:"fitness",label:"Gym",Icon:Dumbbell,image:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1400&q=85",title:"See wellness and fitness amenities",detail:"Preview the gym and wellness experience before arrival."},
 {id:"pool",label:"Pool & leisure",Icon:Waves,image:"https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1400&q=85",title:"Imagine the moments between bookings",detail:"Explore poolside leisure and the spaces that make a stay memorable."},
 {id:"service",label:"Guest services",Icon:ConciergeBell,image:"https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=85",title:"Service, from discovery to arrival",detail:"A guest-facing concierge can help visitors discover amenities and prepare booking enquiries."},
] as const;
export default function HotelExperienceShowroom(){
 const [active,setActive]=useState<string>("rooms");
 const selected=experiences.find(item=>item.id===active)??experiences[0];
 return <section className={styles.section} aria-labelledby="hotel-experience-title" id="hotel-experience">
 <div className={styles.shell}><div className={styles.heading}><div><span className={styles.eyebrow}>Fluxknight for hospitality</span><h2 id="hotel-experience-title">Let guests experience your hotel <em>before they arrive.</em></h2></div><p>Not just a booking form. A premium digital showroom that helps guests explore the property, imagine their stay and move naturally toward a reservation.</p></div>
 <div className={styles.frame}><div className={styles.tabs} role="group" aria-label="Explore hotel experiences">{experiences.map(({id,label,Icon})=><button key={id} type="button" aria-pressed={active===id} className={active===id?styles.active:styles.tab} onClick={()=>setActive(id)}><Icon size={17} aria-hidden="true"/>{label}</button>)}</div>
 <div className={styles.visual}><img key={selected.id} src={selected.image} alt={selected.label+" illustrative hospitality preview"} loading="lazy" decoding="async"/><div className={styles.overlay}><span className={styles.preview}>ILLUSTRATIVE GUEST EXPERIENCE</span><h3>{selected.title}</h3><p>{selected.detail}</p></div></div>
 <div className={styles.foot}><div><strong>Explore. Discover. Book.</strong><span>Guest-facing discovery, booking enquiries and concierge support in one connected journey.</span></div><Link href="/industries/hotels">Explore hotel solutions <ArrowRight size={17} aria-hidden="true"/></Link></div></div>
 </div></section>;
}