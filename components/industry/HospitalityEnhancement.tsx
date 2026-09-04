type Scenario = { title: string; description: string };
type PlanNote = { plan: "Basic" | "Starter" | "Business" | "Business+"; text: string };

type HospitalityConfig = {
  eyebrow: string;
  title: string;
  intro: string;
  scenarios: Scenario[];
  planNotes: PlanNote[];
  databaseTitle: string;
  databaseText: string;
};

const configs: Record<string, HospitalityConfig> = {
  hotels: {
    eyebrow: "Hospitality workflow",
    title: "From guest question to booking-ready handoff.",
    intro: "The hotel system is designed around response speed, reservation intent and front-desk relief. The AI handles approved information and intake, while staff keep control of exceptions, payments, room allocation and service recovery.",
    scenarios: [
      { title: "Room and amenity questions", description: "Guests can ask about room types, rates or rate ranges, check-in and check-out, breakfast, Wi-Fi, parking, airport pickup, facilities and approved hotel policies." },
      { title: "Reservation intake", description: "The agent captures stay dates, number of guests, room preference, special requests and contact details before routing the enquiry toward booking or staff review." },
      { title: "Group and high-value enquiries", description: "Configured qualification can identify longer stays, group bookings, corporate requests or other enquiries that deserve faster human attention." },
      { title: "Reminder and recovery", description: "Starter can follow up on unfinished booking conversations and send reservation reminders through the same channel the guest used." },
      { title: "Cross-channel guest follow-up", description: "Business can coordinate WhatsApp and email follow-up while preserving the conversation context for authorized staff." },
      { title: "Front-desk handoff", description: "Complex changes, complaints, payment issues and exceptional requests are escalated to staff with a concise conversation summary." }
    ],
    planNotes: [
      { plan: "Basic", text: "Best for a hotel that mainly wants 24/7 guest Q&A, reservation intake and clean handoff to reception without automated follow-up." },
      { plan: "Starter", text: "Adds same-channel booking follow-up, reservation reminders and recovery for guests who stop midway through an enquiry." },
      { plan: "Business", text: "Adds higher credits, admins, WhatsApp + email follow-up, inbound voice, reporting and Leo for reservation and guest-conversation visibility." },
      { plan: "Business+", text: "Adds the planned guest + booking operations database, subject to the property-management and booking integrations available." }
    ],
    databaseTitle: "Guest + booking operations database · Coming Soon",
    databaseText: "Business+ is intended to connect guest profiles, booking context, stay history, service requests and lifecycle visibility where supported by hotel systems and integrations."
  },
  restaurants: {
    eyebrow: "Hospitality workflow",
    title: "From menu question to reservation, catering lead or staff handoff.",
    intro: "The restaurant system is built to protect service time. It handles repetitive customer questions and structured intake without pretending an AI should make kitchen, allergy, payment or service decisions that belong with staff.",
    scenarios: [
      { title: "Menu and service questions", description: "Customers can get approved answers about opening hours, location, menu items, reservation policy, delivery or pickup options and other configured information." },
      { title: "Reservation intake", description: "The agent captures date, time, party size, customer details and relevant notes, then routes the request into the configured reservation process." },
      { title: "Catering qualification", description: "For catering or event enquiries, it can capture event date, guest count, location, budget range and service requirements before staff follow up." },
      { title: "Reminder and no-response recovery", description: "Starter can send reservation reminders and continue an unfinished enquiry through the same originating channel." },
      { title: "Cross-channel follow-up", description: "Business can combine WhatsApp and email follow-up for larger catering leads, repeat-customer campaigns and staff-managed conversations." },
      { title: "Human escalation", description: "Allergy concerns, complaints, unusual requests, payment issues and operational exceptions are routed to staff rather than guessed by the AI." }
    ],
    planNotes: [
      { plan: "Basic", text: "Best for restaurants that need instant menu/service Q&A, reservation or catering intake and staff handoff with no automated follow-up." },
      { plan: "Starter", text: "Adds same-channel reservation reminders, enquiry recovery and configured follow-up after an incomplete booking conversation." },
      { plan: "Business", text: "Adds admins, higher credits, WhatsApp + email follow-up, inbound voice, reporting and Leo for reservation and lead visibility." },
      { plan: "Business+", text: "Adds the planned customer + reservation database for deeper history, segmentation and loyalty-style operations where supported." }
    ],
    databaseTitle: "Customer + reservation database · Coming Soon",
    databaseText: "Business+ is intended to connect customer profiles, reservation history, catering enquiries and repeat-customer context into a structured operational view."
  }
};

export default function HospitalityEnhancement({ slug }: { slug: string }) {
  const config = configs[slug];
  if (!config) return null;

  return (
    <section style={{ background: "#080311", color: "#fbf8ff", padding: "88px 24px 110px", borderTop: "1px solid rgba(168,85,247,.22)" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <span style={{ color: "#d8b4fe", fontSize: 11, fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase" }}>{config.eyebrow}</span>
        <h2 style={{ margin: "12px 0", maxWidth: 900, fontSize: "clamp(2.2rem,4.5vw,3.8rem)", letterSpacing: "-.05em" }}>{config.title}</h2>
        <p style={{ maxWidth: 820, margin: "0 0 34px", color: "#aaa0bb", lineHeight: 1.8 }}>{config.intro}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          {config.scenarios.map((item, index) => (
            <article key={item.title} style={{ padding: 24, borderRadius: 18, background: "rgba(18,9,31,.92)", border: "1px solid rgba(168,85,247,.22)" }}>
              <span style={{ color: "#d8b4fe", fontSize: 11, fontWeight: 900 }}>FLOW {String(index + 1).padStart(2, "0")}</span>
              <h3 style={{ margin: "10px 0 8px", fontSize: 20 }}>{item.title}</h3>
              <p style={{ margin: 0, color: "#aaa0bb", fontSize: 14, lineHeight: 1.7 }}>{item.description}</p>
            </article>
          ))}
        </div>

        <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
          {config.planNotes.map((item) => (
            <div key={item.plan} style={{ padding: 20, borderRadius: 16, background: "rgba(126,34,206,.1)", border: "1px solid rgba(168,85,247,.22)" }}>
              <strong style={{ display: "block", marginBottom: 7 }}>{item.plan}</strong>
              <p style={{ margin: 0, color: "#aaa0bb", fontSize: 13, lineHeight: 1.65 }}>{item.text}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, padding: 22, borderRadius: 18, background: "rgba(255,255,255,.025)", border: "1px solid rgba(192,132,252,.34)" }}>
          <strong style={{ display: "block", marginBottom: 8, color: "#d8b4fe" }}>{config.databaseTitle}</strong>
          <p style={{ margin: 0, color: "#aaa0bb", lineHeight: 1.7 }}>{config.databaseText}</p>
        </div>
      </div>
    </section>
  );
}
