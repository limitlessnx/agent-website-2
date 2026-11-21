import Link from "next/link";
import { randomUUID } from "node:crypto";
import type { SocialBrand } from "@/lib/social";
import { isRealtySocialBrand } from "@/lib/social-real-estate-policy";
import { setupRealtySocialAction } from "@/app/dashboard/social/real-estate-actions";
import { ReviewSubmitButton } from "@/app/dashboard/social/review/ReviewSubmitButton";
import RealtySocialDraftForm from "@/components/admin/RealtySocialDraftForm";

export default function RealtySocialCenter({brand,error}:{brand:SocialBrand|null;error?:string}) {
  const ready=isRealtySocialBrand(brand);
  return <main className="admin-page" data-flux-ui>
    <header className="admin-page-header"><div><p className="admin-kicker">Limitless Realty · Flux Social</p><h1>Real estate content studio</h1><p>Nigerian property coverage and your ideas, developed into drafts for review.</p></div><span className="admin-status">Human approval required</span></header>
    {error?<p className="admin-panel" role="alert">{error}</p>:null}
    {!ready?<section className="admin-panel"><h2>Set up this organization&apos;s Brand Brain</h2><p>Create Limitless Realty&apos;s own voice, audience and Nigerian real estate strategy. Research and publishing do not start automatically.</p><form action={setupRealtySocialAction}><ReviewSubmitButton pendingLabel="Setting up…" kind="primary">Set up Limitless Realty Social</ReviewSubmitButton></form></section>:<>
      <div className="admin-grid two">
        <section className="admin-panel"><h2>Explore recent property coverage</h2><p>Research Nigerian real estate, including relevant Edo State and Benin City developments, and prepare three sourced drafts. Coverage is a topic signal, not a verified popularity ranking.</p><RealtySocialDraftForm mode="research" requestId={randomUUID()}/></section>
        <section className="admin-panel"><h2>Start with your idea</h2><RealtySocialDraftForm mode="idea" requestId={randomUUID()}/></section>
      </div>
      <nav className="admin-panel" aria-label="Limitless Realty social tools" style={{display:"flex",gap:16,flexWrap:"wrap"}}>{[["/dashboard/social/review?week=all","Review drafts"],["/dashboard/social/posts","Posts"],["/dashboard/social/calendar","Calendar"],["/dashboard/social/assets","Brand assets"],["/dashboard/social/brand","Brand Brain"],["/dashboard/social/integrations","Connection status"]].map(([href,label])=><Link key={href} href={href} className="admin-status">{label}</Link>)}</nav>
      <section className="admin-panel"><h2>From draft to publication</h2><p>Review the sources and caption, prepare the final graphic, then approve and explicitly schedule it through the existing workflow. Instagram publishing requires Limitless Realty&apos;s own authorized connection. Fluxknight&apos;s accounts and automatic daily queue are separate.</p></section>
    </>}
  </main>;
}
