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
      const gap = parseFloat(getComputedStyle(track).columnGap || "18") || 18;
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
    <section className="brand-section client-reviews-section" aria-label="Client perspectives">
      <div className="brand-shell">
        <div className="client-reviews-heading">
          <h2>What businesses are saying about AI automation</h2>
        </div>

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

        <p className="client-review-note">Illustrative client-style perspectives for the website presentation. They are not presented as verified testimonials.</p>
      </div>
      <style jsx>{`
        .client-reviews-section { padding-top: 82px; padding-bottom: 82px; overflow: hidden; }
        .client-reviews-heading { text-align: center; margin: 0 auto 38px; }
        .client-reviews-heading h2 { margin: 0; font-size: clamp(2rem, 4vw, 3.35rem); line-height: 1.05; letter-spacing: -.045em; }
        .client-reviews-track { display: flex; gap: 18px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; overscroll-behavior-x: contain; padding: 2px 2px 10px; }
        .client-reviews-track::-webkit-scrollbar { display: none; }
        .client-review-card { flex: 0 0 calc((100% - 36px) / 3); min-height: 290px; display: flex; flex-direction: column; scroll-snap-align: start; padding: 28px 22px 24px; border: 1px solid var(--flux-line); border-radius: 18px; background: linear-gradient(145deg, rgba(24,12,43,.96), rgba(11,6,20,.94)); box-shadow: inset 0 1px rgba(255,255,255,.03); }
        .client-review-quote { color: var(--flux-purple); font-size: 4.1rem; line-height: .7; height: 50px; font-family: Georgia, serif; font-weight: 900; }
        .client-review-card p { margin: 4px 0 24px; color: #d7cde2; font-size: .92rem; line-height: 1.7; }
        .client-review-person { margin-top: auto; display: grid; gap: 4px; }
        .client-review-person strong { color: var(--flux-text); font-size: .88rem; }
        .client-review-person span { color: #756985; font-size: .73rem; }
        .client-review-dots { display: flex; justify-content: center; align-items: center; gap: 7px; margin-top: 26px; }
        .client-review-dots button { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 999px; background: rgba(255,255,255,.24); cursor: pointer; transition: width .2s ease, background .2s ease, transform .2s ease; }
        .client-review-dots button.active { width: 30px; background: var(--flux-purple); box-shadow: 0 0 18px var(--flux-glow); }
        .client-review-note { margin: 18px auto 0; max-width: 760px; text-align: center; color: #665a73; font-size: .68rem; line-height: 1.5; }
        @media (max-width: 900px) { .client-review-card { flex-basis: calc((100% - 18px) / 2); } }
        @media (max-width: 640px) { .client-reviews-section { padding: 64px 18px; } .client-reviews-heading { margin-bottom: 28px; } .client-review-card { flex-basis: 86%; min-height: 270px; padding: 25px 20px 22px; } .client-review-card p { font-size: .9rem; } .client-review-dots { gap: 6px; } .client-review-dots button.active { width: 24px; } }
      `}</style>
    </section>
  );
}
