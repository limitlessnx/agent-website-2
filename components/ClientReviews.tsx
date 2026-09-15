"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, MessageSquareText, Network, UsersRound } from "@/components/admin/ServerIcons";

const builtSystems = [
  {
    label: "Real estate operations",
    title: "Maia",
    status: "Implemented workflow",
    text: "Lead capture, buyer qualification, WhatsApp and email follow-up, inspection scheduling, reminders, CRM records, Leo admin visibility, and human handoff are designed as one connected real estate operating flow.",
    href: "/case-studies/maia",
    cta: "View Maia case study",
  },
  {
    label: "Acquisition & onboarding",
    title: "Gencouv",
    status: "Implemented workflow",
    text: "Lead sourcing, prospect organization, email nurture, website conversion, support, Telegram onboarding, and human escalation are connected across one customer-acquisition journey.",
    href: "/case-studies",
    cta: "View Gencouv build",
  },
];

const reviews = [
  { quote: "We stopped losing enquiries after hours. The AI handles the first conversation, captures what the guest needs, and gets the right request to our team without someone living inside WhatsApp.", name: "Ama Mensah", role: "Hotel Operations · Ghana" },
  { quote: "The biggest difference is response time. Prospects get answers immediately, and our agents receive qualified property enquiries instead of starting every conversation from zero.", name: "Thabo Mokoena", role: "Real Estate · South Africa" },
  { quote: "Our front desk used to repeat the same questions all day. Now the AI handles routine requests and our staff can focus on guests who actually need a human.", name: "Chiamaka Okafor", role: "Hospitality · Nigeria" },
  { quote: "The lead follow-up is the part I value most. People who would have gone cold now receive the right message at the right time without my team manually chasing every contact.", name: "Michael Carter", role: "Solar Installation · United States" },
  { quote: "We connected enquiries, bookings and follow-ups into one process. It feels less like adding another software tool and more like finally giving the business an operating system.", name: "Noura Al Mansouri", role: "Business Services · UAE" },
  { quote: "Customers can ask about our menu, availability and reservations without waiting for somebody to reply. That has made our evenings much easier to manage.", name: "Kwame Boateng", role: "Restaurant · Ghana" },
  { quote: "Our membership enquiries are no longer sitting in an inbox until the next morning. The AI answers questions, recommends the right option and gets people booked for a visit.", name: "Lerato Dlamini", role: "Fitness · South Africa" },
  { quote: "The automation removed a surprising amount of admin. Our team still makes the important decisions, but the repetitive handoffs now happen in the background.", name: "Daniel Adeyemi", role: "Real Estate · Nigeria" },
  { quote: "We finally have a consistent customer journey from the first enquiry to human support. The system remembers the context instead of making customers explain themselves again.", name: "Rachel Williams", role: "Home Services · United States" },
  { quote: "The value is not just the chatbot. It is what happens behind it: the lead is captured, the team is alerted, follow-up is scheduled and nothing gets forgotten.", name: "Omar Al Haddad", role: "Property Services · UAE" },
  { quote: "Automation gave our staff breathing room. We are still a human business, but the machines now handle the repetitive work that was quietly eating our day.", name: "Ifeoma Nwosu", role: "Professional Services · Nigeria" },
];

const proofThemes = [
  { icon: Clock3, title: "Faster response", text: "Customers get help before interest turns into silence." },
  { icon: MessageSquareText, title: "Stronger follow-up", text: "Conversations keep moving without relying on memory." },
  { icon: UsersRound, title: "More staff capacity", text: "Routine work moves into the background so people can focus." },
  { icon: Network, title: "Better continuity", text: "Context, next steps, and handoffs stay connected." },
];

export default function ClientReviews() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const cards = Array.from(track.children) as HTMLElement[];
      if (!cards.length) return;
      const first = cards[0];
      const gap = parseFloat(getComputedStyle(track).columnGap || "16") || 16;
      const step = first.getBoundingClientRect().width + gap;
      setActive(Math.max(0, Math.min(reviews.length - 1, Math.round(track.scrollLeft / step))));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (index: number) => {
    const track = trackRef.current;
    const card = track?.children[index] as HTMLElement | undefined;
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
  };

  return (
    <section className="brand-section client-reviews-section" aria-label="Proof and client perspectives">
      <div className="brand-shell">
        <div className="client-reviews-heading">
          <span className="client-reviews-eyebrow">Proof before promises</span>
          <h2>Start with what has actually been built.</h2>
          <p>Fluxknight proof is separated into implemented system capability, operational improvement themes, and qualitative client perspectives. Performance percentages are not presented here unless approved source data supports them.</p>
        </div>

        <div className="built-proof-grid" aria-label="Implemented Fluxknight systems">
          {builtSystems.map((system) => (
            <article key={system.title}>
              <div className="built-proof-topline"><span>{system.label}</span><em><i /> {system.status}</em></div>
              <h3>{system.title}</h3>
              <p>{system.text}</p>
              <Link href={system.href}>{system.cta} <ArrowRight size={15} /></Link>
            </article>
          ))}
        </div>

        <div className="client-proof-grid" aria-label="Operational improvement themes">
          {proofThemes.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span><Icon size={18} /></span>
              <div><strong>{title}</strong><p>{text}</p></div>
              <CheckCircle2 size={16} />
            </article>
          ))}
        </div>

        <div className="client-review-header">
          <div className="client-review-label">Qualitative client perspectives <span>Operational feedback, not performance guarantees</span></div>
          <div className="client-review-count" aria-hidden="true"><strong>{String(active + 1).padStart(2, "0")}</strong><span>/ {String(reviews.length).padStart(2, "0")}</span></div>
        </div>

        <div ref={trackRef} className="client-reviews-track">
          {reviews.map((review, index) => (
            <article className="client-review-card" key={review.name}>
              <div className="client-review-card-top">
                <span className="client-review-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="client-review-rule" />
              </div>
              <p className="client-review-copy">“{review.quote}”</p>
              <div className="client-review-person">
                <span className="client-review-monogram" aria-hidden="true">{review.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                <div><strong>{review.name}</strong><span>{review.role}</span></div>
              </div>
            </article>
          ))}
        </div>

        <div className="client-review-dots" aria-label="Review navigation">
          {reviews.map((review, index) => (
            <button key={review.name} type="button" className={index === active ? "active" : ""} aria-label={`Show review ${index + 1}`} aria-current={index === active ? "true" : undefined} onClick={() => goTo(index)} />
          ))}
        </div>
      </div>
      <style jsx>{`
        .client-reviews-section{padding-top:82px;padding-bottom:82px;overflow:hidden}.client-reviews-heading{text-align:center;margin:0 auto 34px;max-width:860px}.client-reviews-eyebrow{display:inline-block;margin-bottom:12px;color:#a970ff;font-size:.7rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.client-reviews-heading h2{margin:0;font-size:clamp(1.9rem,3.7vw,3.15rem);line-height:1.06;letter-spacing:-.045em}.client-reviews-heading p{max-width:760px;margin:14px auto 0;color:#8f829f;font-size:.9rem;line-height:1.65}.built-proof-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:30px 0 20px}.built-proof-grid article{padding:22px;border:1px solid rgba(190,151,255,.18);border-radius:18px;background:radial-gradient(circle at 88% 12%,rgba(139,92,246,.13),transparent 32%),linear-gradient(145deg,rgba(28,14,49,.92),rgba(10,6,18,.96));box-shadow:inset 0 1px rgba(255,255,255,.03)}.built-proof-topline{display:flex;align-items:center;justify-content:space-between;gap:12px}.built-proof-topline>span{color:#9e8bab;font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.built-proof-topline em{display:inline-flex;align-items:center;gap:7px;color:#a99bbb;font-size:.64rem;font-style:normal}.built-proof-topline i{width:7px;height:7px;border-radius:50%;background:#9e64ff;box-shadow:0 0 12px rgba(158,100,255,.72)}.built-proof-grid h3{margin:16px 0 8px;color:#fff;font-size:1.5rem;letter-spacing:-.035em}.built-proof-grid p{margin:0;color:#a699b4;font-size:.82rem;line-height:1.62}.built-proof-grid a{display:inline-flex;align-items:center;gap:7px;margin-top:18px;color:#c598ff;font-size:.76rem;font-weight:800;text-decoration:none}.client-proof-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0 38px}.client-proof-grid article{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:11px;padding:16px;border:1px solid rgba(190,151,255,.14);border-radius:15px;background:linear-gradient(145deg,rgba(23,12,40,.86),rgba(10,6,18,.9))}.client-proof-grid article>span{display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:10px;background:rgba(139,92,246,.11);color:#b982ff}.client-proof-grid strong{display:block;color:#f7f3fb;font-size:.79rem}.client-proof-grid p{margin:4px 0 0;color:#887b95;font-size:.72rem;line-height:1.45}.client-proof-grid article>svg{margin-top:2px;color:#7d5aac}.client-review-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:14px}.client-review-label{color:#81758c;font-size:.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.client-review-label span{display:block;margin-top:5px;color:#62596b;font-size:.65rem;font-weight:600;letter-spacing:0;text-transform:none}.client-review-count{display:flex;align-items:baseline;gap:5px;color:#5f5569;font-size:.72rem;font-variant-numeric:tabular-nums}.client-review-count strong{color:#c9b6dc;font-size:1rem;font-weight:600}.client-reviews-track{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none;overscroll-behavior-x:contain;padding:2px 2px 10px}.client-reviews-track::-webkit-scrollbar{display:none}.client-review-card{position:relative;flex:0 0 calc((100% - 28px)/3);min-height:272px;display:flex;flex-direction:column;scroll-snap-align:start;padding:22px;border:1px solid rgba(255,255,255,.075);border-radius:18px;background:#0c0812;box-shadow:0 18px 46px rgba(0,0,0,.16);transition:border-color .25s ease,transform .25s ease,background .25s ease}.client-review-card:hover{border-color:rgba(179,128,255,.22);background:#100a18;transform:translateY(-2px)}.client-review-card-top{display:flex;align-items:center;gap:12px;margin-bottom:24px}.client-review-index{color:#9d74d4;font-size:.65rem;font-weight:800;letter-spacing:.1em}.client-review-rule{height:1px;flex:1;background:linear-gradient(90deg,rgba(164,111,236,.28),rgba(255,255,255,.035))}.client-review-copy{margin:0;color:#eee8f3;font-size:clamp(.9rem,1.05vw,1rem);font-weight:500;line-height:1.65;letter-spacing:-.012em}.client-review-person{margin-top:auto;padding-top:28px;display:flex;align-items:center;gap:11px;border-top:1px solid rgba(255,255,255,.055)}.client-review-monogram{display:inline-flex;width:34px;height:34px;flex:0 0 34px;align-items:center;justify-content:center;border:1px solid rgba(179,128,255,.2);border-radius:50%;background:rgba(139,92,246,.07);color:#c9a6f6;font-size:.62rem;font-weight:800;letter-spacing:.04em}.client-review-person>div{min-width:0;display:grid;gap:3px}.client-review-person strong{color:#f7f4fa;font-size:.79rem;font-weight:700}.client-review-person span{color:#746a7d;font-size:.67rem;line-height:1.35}.client-review-dots{display:flex;justify-content:center;align-items:center;gap:6px;margin-top:22px}.client-review-dots button{width:18px;height:2px;padding:0;border:0;border-radius:99px;background:rgba(255,255,255,.13);cursor:pointer;transition:width .2s ease,background .2s ease}.client-review-dots button.active{width:34px;background:#9d62ed;box-shadow:none}@media(max-width:900px){.client-proof-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.client-review-card{flex-basis:calc((100% - 14px)/2)}}@media(max-width:640px){.client-reviews-section{padding:60px 18px 64px}.client-reviews-heading{margin-bottom:26px}.built-proof-grid{grid-template-columns:1fr;gap:10px;margin:24px 0 16px}.built-proof-grid article{padding:18px}.built-proof-topline{align-items:flex-start;flex-direction:column;gap:7px}.client-proof-grid{grid-template-columns:1fr;gap:9px;margin:16px 0 30px}.client-proof-grid article{padding:14px}.client-review-header{align-items:flex-end;margin-bottom:12px}.client-review-label span{max-width:220px}.client-review-card{flex-basis:88%;min-height:260px;padding:20px}.client-review-card-top{margin-bottom:20px}.client-review-copy{font-size:.88rem;line-height:1.6}.client-review-person{padding-top:22px}.client-review-dots{gap:5px;margin-top:18px}.client-review-dots button{width:12px}.client-review-dots button.active{width:26px}}@media(prefers-reduced-motion:reduce){.client-reviews-track{scroll-behavior:auto}.client-review-card,.client-review-dots button{transition:none}.client-review-card:hover{transform:none}}
      `}</style>
    </section>
  );
}
