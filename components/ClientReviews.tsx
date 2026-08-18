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
    </section>
  );
}
