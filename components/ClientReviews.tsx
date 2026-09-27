const reviews = [
  {
    quote: "The automation removed a surprising amount of admin. Our team still makes the important decisions, but repetitive handoffs now happen in the background.",
    name: "Daniel A…..",
    role: "Real Estate",
    location: "Nigeria",
  },
  {
    quote: "We connected enquiries, bookings and follow-ups into one process. It feels less like another software tool and more like a system keeping the business moving.",
    name: "Noura A…..",
    role: "Business Services",
    location: "UAE",
  },
  {
    quote: "The biggest difference is response time. Prospects get answers immediately, and our agents receive qualified property enquiries instead of starting every conversation from zero.",
    name: "Thabo M…..",
    role: "Real Estate",
    location: "South Africa",
  },
];

function Stars() {
  return (
    <div className="flex items-center gap-1 text-amber-400" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
        </svg>
      ))}
    </div>
  );
}

export default function ClientReviews() {
  return (
    <section className="relative overflow-hidden bg-[#080a10] px-6 py-20 text-white md:py-24" aria-labelledby="testimonial-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(126,55,190,.12),transparent_30%)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-12">
          <span className="text-xs font-semibold uppercase tracking-[.28em] text-purple-300">Client stories</span>
          <h2 id="testimonial-title" className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Proof should be easier to scan than promises.</h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-400">A few examples of what teams value when Fluxknight handles repetitive customer work.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {reviews.map((review) => (
            <article key={review.name} className="flex min-h-[300px] flex-col rounded-3xl border border-white/10 bg-white/[.035] p-6 md:p-7">
              <Stars />
              <p className="mt-6 text-[15px] leading-7 text-neutral-200">“{review.quote}”</p>
              <div className="mt-auto pt-8">
                <strong className="block text-sm font-semibold text-white">{review.name}</strong>
                <span className="mt-1 block text-xs text-neutral-400">{review.role} · {review.location}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
