"use client";

import { useEffect, useRef, useState } from "react";

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
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <section className="brand-section client-reviews-section" aria-label="Client reviews">
      <div className="brand-shell">
        <div className="client-reviews-heading">
          <span>Testimonials</span>
          <h2>Hear From Our Satisfied Clients</h2>
        </div>

        <div ref={trackRef} className="client-reviews-track">
          {reviews.map((review,index) => (
            <article className={`client-review-card ${index===active?"is-active":""}`} key={review.name}>
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
            <button
              key={review.name}
              type="button"
              className={index === active ? "active" : ""}
              aria-label={`Show review ${index + 1}`}
              aria-current={index === active ? "true" : undefined}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      </div>
      <style jsx>{`
        .client-reviews-section { padding-top: 112px; padding-bottom: 112px; overflow: hidden; background:#05020b; }
        .client-reviews-heading { text-align: center; margin: 0 auto 42px; }
        .client-reviews-heading span { display:inline-flex;padding:6px 10px;border:1px solid rgba(190,145,255,.18);border-radius:999px;color:#aa82e9;font-size:.68rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;background:rgba(126,60,224,.07) }
        .client-reviews-heading h2 { margin: 15px 0 0; font-size: clamp(2.2rem, 4.5vw, 4.1rem); line-height: 1.02; letter-spacing: -.052em; font-weight:540; }
        .client-reviews-track { display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; overscroll-behavior-x: contain; padding: 32px max(18px,calc((100vw - 720px)/2)) 42px; margin-inline:calc(50% - 50vw); }
        .client-reviews-track::-webkit-scrollbar { display: none; }
        .client-review-card { flex: 0 0 min(680px,72vw); min-height: 250px; display: flex; flex-direction: column; scroll-snap-align: center; padding: 30px 34px 26px; border: 1px solid var(--flux-line); border-radius: 19px; background: linear-gradient(145deg, rgba(24,12,43,.96), rgba(9,4,18,.96)); box-shadow: inset 0 1px rgba(255,255,255,.03); opacity:.38; transform:scale(.9); transition:opacity .35s ease,transform .35s ease,border-color .35s ease; }
        .client-review-card.is-active {opacity:1;transform:scale(1);border-color:rgba(194,145,255,.38);box-shadow:0 24px 85px rgba(0,0,0,.46),0 0 45px rgba(130,52,230,.14),inset 0 1px rgba(255,255,255,.05)}
        .client-review-quote { color: var(--flux-purple); font-size: 3.2rem; line-height: .7; height: 38px; font-family: Georgia, serif; font-weight: 900; }
        .client-review-card p { margin: 3px 0 24px; color: #d7cde2; font-size: 1rem; line-height: 1.7; text-align:center; }
        .client-review-person { margin-top: auto; display: grid; gap: 3px; text-align:center; }
        .client-review-person strong { color: var(--flux-text); font-size: .82rem; }
        .client-review-person span { color: #756985; font-size: .69rem; }
        .client-review-dots { display: flex; justify-content: center; align-items: center; gap: 7px; margin-top: 22px; }
        .client-review-dots button { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,.25); cursor: pointer; transition: transform .2s ease, background .2s ease; }
        .client-review-dots button.active { width: 8px; height: 8px; background: var(--flux-purple); box-shadow: 0 0 12px var(--flux-glow); transform: scale(1.08); }
        @media (max-width: 640px) { .client-reviews-section { padding: 82px 0; } .client-reviews-heading { margin:0 18px 24px; } .client-review-card { flex-basis: 84vw; min-height: 245px; padding: 24px 20px 20px; } .client-review-card p { font-size: .88rem; line-height: 1.6; } .client-review-dots { gap: 6px; margin-top: 8px; } .client-review-dots button, .client-review-dots button.active { width: 7px; height: 7px; } }
      `}</style>
    </section>
  );
}
