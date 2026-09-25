import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Privacy Policy | Fluxknight",
  description: "How Fluxknight collects, uses, stores and protects personal information.",
};

const sections = [
  ["1. Information we collect", <>We may collect information you provide directly, including your name, email address, phone number, company details, account information, enquiries, support requests and information submitted through forms, chat, WhatsApp, email, voice or other connected channels. When you use Fluxknight-powered services, we may also process conversation content, lead information, appointment details and other data needed to deliver the requested workflow.</>],
  ["2. Information collected automatically", <>We may collect technical and usage information such as IP address, browser and device information, pages visited, timestamps, diagnostic data and security logs. Where analytics or similar technologies are enabled, they may also provide aggregated information about how our services are used.</>],
  ["3. How we use information", <>We use information to provide and operate our services; configure AI agents and automations; respond to enquiries; qualify and route leads; provide customer support; process transactions; schedule appointments; improve reliability and performance; prevent fraud, abuse and security incidents; comply with legal obligations; and communicate about services where permitted.</>],
  ["4. AI and automated processing", <>Fluxknight provides AI-assisted customer operations and workflow automation. Information submitted to an AI-enabled feature may be processed automatically to understand requests, generate responses, retrieve relevant business information, classify or qualify enquiries, trigger workflows, schedule actions or route a conversation to a human. AI outputs can be inaccurate and should not be treated as professional, legal, financial or medical advice.</>],
  ["5. Our customers and their data", <>Businesses may use Fluxknight to communicate with their own customers and leads. In those situations, the business using Fluxknight may determine why and how personal information is processed, while Fluxknight processes information on its behalf to provide the service. Questions about a business's own collection or use of your information should normally be directed to that business.</>],
  ["6. Service providers and integrations", <>We may use third-party providers for cloud hosting, databases, communications, email, messaging, telephony, payments, analytics, automation, AI models and other infrastructure. We disclose information only as reasonably necessary for those providers to perform services for us or our customers, subject to applicable contractual and legal safeguards.</>],
  ["7. International data transfers", <>Because Fluxknight and its service providers may operate in multiple countries, information may be processed outside the country where it was collected. Where required, we use appropriate safeguards for international transfers and handle personal data in accordance with applicable data-protection requirements.</>],
  ["8. Data retention", <>We retain personal information for as long as reasonably necessary to provide the services, maintain legitimate business and security records, comply with legal obligations and resolve disputes. Retention periods vary depending on the type of information, the service involved and customer instructions. We delete or anonymize information when it is no longer reasonably required, subject to lawful retention requirements.</>],
  ["9. Security", <>We use reasonable technical and organisational measures designed to protect information against unauthorised access, loss, misuse, alteration and disclosure. No internet service or storage system can guarantee absolute security, so users and customers should also protect their credentials and access devices.</>],
  ["10. Your privacy rights", <>Depending on applicable law, you may have rights to request access to, correction of, deletion of, restriction of or objection to certain processing of your personal information, and in some cases data portability or withdrawal of consent. You may also have the right to lodge a complaint with an applicable data-protection authority. We may need to verify your identity before completing a request.</>],
  ["11. Marketing communications", <>Where we send marketing communications, you may opt out using the unsubscribe mechanism provided in the message or by contacting us. Transactional, security or service-related communications may still be sent where necessary to provide the service.</>],
  ["12. Children's privacy", <>Fluxknight's services are intended for businesses and are not directed to children. We do not knowingly seek to collect personal information from children through our business services. If you believe a child has provided personal information improperly, contact us so we can review the matter.</>],
  ["13. Changes to this policy", <>We may update this Privacy Policy to reflect changes to our services, practices or legal requirements. The updated version will be posted on this page with a revised effective date.</>],
];

export default function PrivacyPage() {
  return <><Navbar /><main style={{minHeight:"100vh",background:"#050607",color:"#f5f7f8",padding:"132px 24px 88px"}}>
    <article style={{maxWidth:860,margin:"0 auto"}}>
      <p style={{color:"#8bf5bd",fontSize:13,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase"}}>Legal</p>
      <h1 style={{fontSize:"clamp(40px,7vw,72px)",lineHeight:1,letterSpacing:"-0.045em",margin:"14px 0 18px"}}>Privacy Policy</h1>
      <p style={{color:"#a7afb7",fontSize:16,lineHeight:1.7,marginBottom:48}}>Effective: 25 September 2026</p>
      <p style={{fontSize:18,lineHeight:1.8,color:"#d8dde2",marginBottom:42}}>This Privacy Policy explains how Fluxknight (“Fluxknight”, “we”, “us” or “our”) handles personal information when you visit our website, contact us, create an account, use our AI automation services, or interact with a service powered by Fluxknight.</p>
      {sections.map(([title,body])=><section key={title as string} style={{padding:"28px 0",borderTop:"1px solid rgba(255,255,255,.1)"}}><h2 style={{fontSize:22,margin:"0 0 12px",letterSpacing:"-.02em"}}>{title}</h2><div style={{color:"#b8c0c7",fontSize:16,lineHeight:1.8}}>{body}</div></section>)}
      <section style={{padding:"28px 0",borderTop:"1px solid rgba(255,255,255,.1)"}}><h2 style={{fontSize:22,margin:"0 0 12px"}}>14. Contact us</h2><p style={{color:"#b8c0c7",fontSize:16,lineHeight:1.8}}>For privacy questions or requests, contact <a href="mailto:limitless@fluxknight.space" style={{color:"#8bf5bd"}}>limitless@fluxknight.space</a>. You can also use our <Link href="/contact" style={{color:"#8bf5bd"}}>contact page</Link>.</p></section>
      <p style={{color:"#77818a",fontSize:13,lineHeight:1.7,marginTop:28}}>This policy is intended to describe Fluxknight's current data practices and does not limit rights available under applicable data-protection law.</p>
    </article>
  </main><Footer /></>;
}