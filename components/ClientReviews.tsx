"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, MessageSquareText, Network, UsersRound } from "@/components/admin/ServerIcons";

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
    <section className="brand-section client-reviews-section" aria-label="Client reviews">
      <div className="brand-shell">
        <div className="client-reviews-heading">
          <span className="client-reviews-eyebrow">What businesses feel first</span>
          <h2>Less chasing. Faster responses. More room for the team to do real work.</h2>
          <p>The patterns below are the operational changes Fluxknight is designed to create across customer-facing teams.</p>
        </div>

        <div className="client-proof-grid" aria-label="Operational proof themes">
          {proofThemes.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span><Icon size={18} /></span>
              <div><strong>{title}</strong><p>{text}</p></div>
              <CheckCircle2 size={16} />
            </article>
          ))}
        </div>

        <div className="client-review-label">Client perspectives</div>
        <div ref={trackRef} className="client-reviews-track">
          {reviews.map((review) => (
            <article className="client-review-card" key={review.name}>
              <div className="client-review-quote" aria-hidden="true">“</div>
              <p>{review.quote}</p>
              <div className="client-review-person">
                <strong>{review.name}</strong>
                <span>{review.role}</span>
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
        .client-reviews-section{padding-top:76px;padding-bottom:72px;overflow:hidden}.client-reviews-heading{text-align:center;margin:0 auto 30px;max-width:860px}.client-reviews-eyebrow{display:inline-block;margin-bottom:12px;color:#a970ff;font-size:.7rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.client-reviews-heading h2{margin:0;font-size:clamp(1.9rem,3.7vw,3.15rem);line-height:1.06;letter-spacing:-.045em}.client-reviews-heading p{max-width:680px;margin:14px auto 0;color:#8f829f;font-size:.9rem;line-height:1.65}.client-proof-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:30px 0 34px}.client-proof-grid article{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:11px;padding:16px;border:1px solid rgba(190,151,255,.14);border-radius:15px;background:linear-gradient(145deg,rgba(23,12,40,.86),rgba(10,6,18,.9))}.client-proof-grid article>span{display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:10px;background:rgba(139,92,246,.11);color:#b982ff}.client-proof-grid strong{display:block;color:#f7f3fb;font-size:.79rem}.client-proof-grid p{margin:4px 0 0;color:#887b95;font-size:.72rem;line-height:1.45}.client-proof-grid article>svg{margin-top:2px;color:#7d5aac}.client-review-label{margin-bottom:12px;color:#746780;font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.client-reviews-track{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none;overscroll-behavior-x:contain;padding:2px 2px 8px}.client-reviews-track::-webkit-scrollbar{display:none}.client-review-card{flex:0 0 calc((100% - 32px)/3);min-height:230px;display:flex;flex-direction:column;scroll-snap-align:start;padding:20px 18px 18px;border:1px solid var(--flux-line);border-radius:16px;background:linear-gradient(145deg,rgba(24,12,43,.96),rgba(11,6,20,.94));box-shadow:inset 0 1px rgba(255,255,255,.03)}.client-review-quote{color:var(--flux-purple);font-size:3.2rem;line-height:.7;height:38px;font-family:Georgia,serif;font-weight:900}.client-review-card p{margin:3px 0 18px;color:#d7cde2;font-size:.86rem;line-height:1.55}.client-review-person{margin-top:auto;display:grid;gap:3px}.client-review-person strong{color:var(--flux-text);font-size:.82rem}.client-review-person span{color:#756985;font-size:.69rem}.client-review-dots{display:flex;justify-content:center;align-items:center;gap:7px;margin-top:22px}.client-review-dots button{width:7px;height:7px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.25);cursor:pointer;transition:transform .2s ease,background .2s ease}.client-review-dots button.active{width:8px;height:8px;background:var(--flux-purple);box-shadow:0 0 12px var(--flux-glow);transform:scale(1.08)}@media(max-width:900px){.client-proof-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.client-review-card{flex-basis:calc((100% - 16px)/2)}}@media(max-width:640px){.client-reviews-section{padding:58px 18px}.client-reviews-heading{margin-bottom:24px}.client-proof-grid{grid-template-columns:1fr;gap:9px;margin:24px 0 28px}.client-proof-grid article{padding:14px}.client-review-card{flex-basis:84%;min-height:205px;padding:18px 16px 16px}.client-review-card p{font-size:.82rem;line-height:1.5}.client-review-dots{gap:6px;margin-top:18px}.client-review-dots button,.client-review-dots button.active{width:7px;height:7px}}
      `}</style>
    </section>
  );
}
