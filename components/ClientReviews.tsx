const reviews = [
  { quote: "We stopped losing enquiries after hours. The AI handles the first conversation, captures what the guest needs, and gets the right request to our team without someone living inside WhatsApp.", name: "Ama M…..", role: "Hotel Operations", location: "Ghana" },
  { quote: "The biggest difference is response time. Prospects get answers immediately, and our agents receive qualified property enquiries instead of starting every conversation from zero.", name: "Thabo M…..", role: "Real Estate", location: "South Africa" },
  { quote: "Our front desk used to repeat the same questions all day. Now the AI handles routine requests and our staff can focus on guests who actually need a human.", name: "Chiamaka O…..", role: "Hospitality", location: "Nigeria" },
  { quote: "The lead follow-up is the part I value most. People who would have gone cold now receive the right message at the right time without my team manually chasing every contact.", name: "Michael C…..", role: "Solar Installation", location: "United States" },
  { quote: "We connected enquiries, bookings and follow-ups into one process. It feels less like adding another software tool and more like finally giving the business an operating system.", name: "Noura A…..", role: "Business Services", location: "UAE" },
  { quote: "Customers can ask about our menu, availability and reservations without waiting for somebody to reply. That has made our evenings much easier to manage.", name: "Kwame B…..", role: "Restaurant", location: "Ghana" },
  { quote: "Our membership enquiries are no longer sitting in an inbox until the next morning. The AI answers questions, recommends the right option and gets people booked for a visit.", name: "Lerato D…..", role: "Fitness", location: "South Africa" },
  { quote: "The automation removed a surprising amount of admin. Our team still makes the important decisions, but the repetitive handoffs now happen in the background.", name: "Daniel A…..", role: "Real Estate", location: "Nigeria" },
  { quote: "We finally have a consistent customer journey from the first enquiry to human support. The system remembers the context instead of making customers explain themselves again.", name: "Rachel W…..", role: "Home Services", location: "United States" },
  { quote: "The value is not just the chatbot. It is what happens behind it: the lead is captured, the team is alerted, follow-up is scheduled and nothing gets forgotten.", name: "Omar A…..", role: "Property Services", location: "UAE" },
  { quote: "Automation gave our staff breathing room. We are still a human business, but the machines now handle the repetitive work that was quietly eating our day.", name: "Ifeoma N…..", role: "Professional Services", location: "Nigeria" },
];

function Stars() {
  return (
    <div
      className="review-stars"
      aria-label="5 out of 5 stars"
      style={{ display: "flex", gap: 3, color: "#f5a900", alignItems: "center" }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          width="17"
          height="17"
          fill="currentColor"
          aria-hidden="true"
          style={{ display: "block", flex: "0 0 auto" }}
        >
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
        </svg>
      ))}
    </div>
  );
}

function CodeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flex: "0 0 auto" }}
    >
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flex: "0 0 auto" }}
    >
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export default function ClientReviews() {
  const loop = [...reviews, ...reviews];

  return (
    <section className="testimonial-section" aria-labelledby="testimonial-title">
      <div className="testimonial-heading">
        <div className="testimonial-kicker"><span />CLIENT STORIES<span /></div>
        <h2 id="testimonial-title">What businesses say about <em>working with Fluxknight</em></h2>
        <p>A few words from teams using Fluxknight to handle repetitive customer and business tasks.</p>
      </div>

      <div className="testimonial-window">
        <div className="testimonial-track">
          {loop.map((review, index) => (
            <article className="testimonial-card" key={`${review.name}-${index}`}>
              <div className="testimonial-person">
                <strong>{review.name}</strong>
                <span>{review.role}</span>
              </div>
              <div className="testimonial-divider" />
              <div className="testimonial-rating"><b>5.0</b><Stars /></div>
              <p className="testimonial-copy">“{review.quote}”</p>
              <div className="testimonial-meta">
                <span className="testimonial-tag"><CodeIcon />{review.role}</span>
              </div>
              <div className="testimonial-location"><PinIcon />{review.location}</div>
            </article>
          ))}
        </div>
        <div className="fade fade-left" />
        <div className="fade fade-right" />
        <div className="fade fade-top" />
        <div className="fade fade-bottom" />
      </div>

      <style>{`
        .testimonial-section{position:relative;overflow:hidden;content-visibility:auto;contain-intrinsic-size:720px;padding:96px 0 100px;background:radial-gradient(circle at 50% 18%,rgba(126,55,190,.12),transparent 29%),radial-gradient(circle at 50% 100%,rgba(92,34,160,.13),transparent 30%),#080a10;color:#fff}
        .testimonial-heading{position:relative;z-index:5;text-align:center;margin:0 auto 62px;padding:0 22px}
        .testimonial-kicker{display:flex;align-items:center;justify-content:center;gap:18px;color:#cf80ff;font-size:.72rem;font-weight:700;letter-spacing:.32em}
        .testimonial-kicker span{width:50px;height:1px;background:linear-gradient(90deg,transparent,#9b55d4)}
        .testimonial-kicker span:last-child{background:linear-gradient(90deg,#9b55d4,transparent)}
        .testimonial-heading h2{margin:18px 0 12px;font-size:clamp(2.45rem,5vw,4.45rem);line-height:.98;letter-spacing:-.055em;font-weight:750}
        .testimonial-heading h2 em{font-style:normal;background:linear-gradient(90deg,#d996ff,#9859e9);-webkit-background-clip:text;background-clip:text;color:transparent}
        .testimonial-heading p{margin:0;color:#b0b4c5;font-size:clamp(.98rem,1.5vw,1.18rem)}
        .testimonial-window{position:relative;width:100%;overflow:hidden;padding:18px 0 36px}
        .testimonial-track{display:flex;width:max-content;gap:18px;animation:testimonial-scroll 82s linear infinite}
        .testimonial-window:hover .testimonial-track{animation-play-state:paused}
        .testimonial-card{width:365px;min-height:455px;display:flex;flex-direction:column;flex-shrink:0;padding:32px 34px;border:1px solid rgba(118,121,139,.58);border-radius:26px;background:linear-gradient(145deg,rgba(25,27,37,.92),rgba(17,18,27,.78) 62%,rgba(50,29,69,.36));box-shadow:inset 0 1px rgba(255,255,255,.035),0 26px 70px rgba(0,0,0,.28);transition:transform .25s ease,border-color .25s ease}
        .testimonial-card:hover{transform:translateY(-5px);border-color:rgba(158,119,203,.72)}
        .testimonial-person strong{display:block;color:#fafafa;font-size:1.04rem;font-weight:700;letter-spacing:-.02em}
        .testimonial-person span{display:block;margin-top:5px;color:#c1c1ce;font-size:.83rem}
        .testimonial-divider{height:1px;margin:22px 0;background:rgba(205,207,220,.22)}
        .testimonial-rating{display:flex;align-items:center;gap:16px}
        .testimonial-rating b{font-size:.95rem;color:#f4f4f5}
        .review-stars{display:flex;gap:3px;color:#f5a900}
        .review-stars svg{width:17px;height:17px;fill:currentColor}
        .testimonial-copy{margin:22px 0 0;color:#e1e2e8;font-size:.96rem;line-height:1.72}
        .testimonial-meta{margin-top:auto;padding-top:25px}
        .testimonial-tag{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border:1px solid rgba(249,115,22,.85);border-radius:999px;background:rgba(249,115,22,.06);color:#ff8a2b;font-size:.72rem;font-weight:700}
        .testimonial-tag svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
        .testimonial-location{display:flex;align-items:center;gap:6px;margin-top:18px;color:#8e91a2;font-size:.73rem}
        .testimonial-location svg{width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:1.8}
        .fade{position:absolute;z-index:4;pointer-events:none}
        .fade-left{inset:0 auto 0 0;width:10vw;min-width:70px;background:linear-gradient(90deg,#080a10 8%,rgba(8,10,16,.9) 35%,transparent)}
        .fade-right{inset:0 0 0 auto;width:10vw;min-width:70px;background:linear-gradient(270deg,#080a10 8%,rgba(8,10,16,.9) 35%,transparent)}
        .fade-top{inset:0 0 auto;height:42px;background:linear-gradient(#080a10,transparent)}
        .fade-bottom{inset:auto 0 0;height:54px;background:linear-gradient(transparent,#080a10)}
        @keyframes testimonial-scroll{from{transform:translateX(0)}to{transform:translateX(calc(-50% - 9px))}}
        @media(max-width:700px){
          .testimonial-section{padding:72px 0 76px}
          .testimonial-heading{margin-bottom:40px}
          .testimonial-kicker{gap:12px;font-size:.63rem;letter-spacing:.25em}
          .testimonial-kicker span{width:32px}
          .testimonial-heading h2{font-size:clamp(2.25rem,11vw,3.2rem)}
          .testimonial-heading p{font-size:.9rem}
          .testimonial-window{padding:10px 0 28px}
          .testimonial-track{gap:13px;animation-duration:68s}
          .testimonial-card{width:305px;min-height:420px;padding:25px 24px;border-radius:23px}
          .testimonial-copy{font-size:.89rem;line-height:1.65}
          .fade-left,.fade-right{width:34px;min-width:34px}
        }
        @media(prefers-reduced-motion:reduce){
          .testimonial-track{animation:none}
          .testimonial-card{transition:none}
          .testimonial-card:hover{transform:none}
        }
      `}</style>
    </section>
  );
}
