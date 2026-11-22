import {requireTenant} from "@/lib/tenant";
import {realtyBrandReadiness} from "@/lib/social-realty-brand";
import {socialWeekStart} from "@/lib/social-week";
import RealtyWeeklyPreparationForm from "@/components/admin/RealtyWeeklyPreparationForm";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import type { SocialBrand } from "@/lib/social";
import { isRealtySocialBrand } from "@/lib/social-real-estate-policy";
import { setupRealtySocialAction } from "@/app/dashboard/social/real-estate-actions";
import { ReviewSubmitButton } from "@/app/dashboard/social/review/ReviewSubmitButton";
import RealtySocialDraftForm from "@/components/admin/RealtySocialDraftForm";

export default async function RealtySocialCenter({brand,error,manual=false}:{brand:SocialBrand|null;error?:string;manual?:boolean}) {
  const {supabase,organizationId}=await requireTenant();
  const readiness=await realtyBrandReadiness(supabase,brand).catch(()=>({ready:false,identity:undefined,blockers:["Brand readiness is unavailable. Refresh to retry before generating media."]}));
  const posts=brand?await supabase.from("social_posts").select("status,metadata").eq("organization_id",organizationId).eq("brand_id",brand.id).order("created_at",{ascending:false}).limit(50):null;
  const run=brand?await supabase.from("social_weekly_runs").select("week_start,status,last_error").eq("organization_id",organizationId).eq("brand_id",brand.id).order("updated_at",{ascending:false}).limit(1).maybeSingle():null;
  const today=new Date();const planningWeek=socialWeekStart(today.getUTCDay()===0?new Date(today.getTime()+86400000):today);
  const ready=isRealtySocialBrand(brand);
  return <main className="admin-page" data-flux-ui>
    <header className="admin-page-header"><div><p className="admin-kicker">Limitless Realty · Flux Social</p><h1>{manual?"Manual generation":"Real estate social control center"}</h1><p>{manual?"Turn your own idea or a researched topic into a branded carousel.":"Your brand, Nigerian real estate research, weekly carousels and review pipeline."}</p></div><span className="admin-status">Human approval required</span></header>
    {error?<p className="admin-panel" role="alert">{error}</p>:null}
    {!ready?<section className="admin-panel"><h2>Set up this organization&apos;s Brand Brain</h2><p>Create Limitless Realty&apos;s own voice, audience and Nigerian real estate strategy. Research and publishing do not start automatically.</p><form action={setupRealtySocialAction}><ReviewSubmitButton pendingLabel="Setting up…" kind="primary">Set up Limitless Realty Social</ReviewSubmitButton></form></section>:<>
      <section className="admin-panel"><h2>Brand readiness</h2>{readiness.ready?<p>Approved logo and visual identity are ready for carousel preparation.</p>:<><p>Complete these requirements before generating branded media.</p><ul>{readiness.blockers.map(blocker=><li key={blocker}>{blocker}</li>)}</ul></>}<div style={{display:"flex",gap:16,flexWrap:"wrap"}}><Link href="/dashboard/social/assets">Upload approved logo</Link><Link href="/dashboard/social/brand">Configure brand identity</Link></div></section>
      {!manual?<>
        <section className="admin-panel"><h2>Weekly content engine</h2><p>Research Nigerian real estate, including relevant Edo State and Benin City coverage, and prepare seven distinct carousels using your approved logo, colors and typography. Each carousel uses the shared slide-rendering pipeline and remains in Review.</p><p>Automatic Monday preparation: {brand?.metadata.weekly_review_enabled===true?"Enabled":"Off"}. Videos are deferred.</p><RealtyWeeklyPreparationForm week={planningWeek} requestId={randomUUID()} ready={readiness.ready}/></section>
        <section className="admin-panel"><h2>Recent carousel preparation</h2>{run?.error?<p role="alert">Weekly preparation status is unavailable. Refresh to retry.</p>:run?.data?<><p>Week of {run.data.week_start}: {String(run.data.status).replaceAll("_"," ")}</p>{run.data.last_error?<p role="alert">{run.data.last_error}</p>:null}</>:<p>No weekly batch has been prepared yet.</p>}{posts?.error?<p role="alert">Recent preparation status is unavailable. Refresh to retry.</p>:<div style={{display:"flex",gap:20,flexWrap:"wrap"}}><span>{posts?.data?.filter(post=>post.metadata?.carousel_render_status==="ready").length||0} media ready</span><span>{posts?.data?.filter(post=>["queued","rendering"].includes(post.metadata?.carousel_render_status)).length||0} preparing</span><span>{posts?.data?.filter(post=>["failed","queue_failed"].includes(post.metadata?.carousel_render_status)).length||0} need attention</span></div>}<p><Link href="/dashboard/social/review?week=all">Open review queue</Link></p></section>
        <section className="admin-panel"><h2>Manual generation</h2><p>Create additional carousels from a specific idea in the separate manual workspace.</p><Link href="/dashboard/social/manual" className="admin-status">Open manual generation</Link></section>
      </>:<div className="admin-grid two">
        <section className="admin-panel"><h2>Explore recent property coverage</h2><p>Research Nigerian real estate, including relevant Edo State and Benin City developments, and prepare three sourced drafts. Coverage is a topic signal, not a verified popularity ranking.</p><RealtySocialDraftForm mode="research" requestId={randomUUID()}/></section>
        <section className="admin-panel"><h2>Start with your idea</h2><RealtySocialDraftForm mode="idea" requestId={randomUUID()}/></section>
      </div>}
      <nav className="admin-panel" aria-label="Limitless Realty social tools" style={{display:"flex",gap:16,flexWrap:"wrap"}}>{[["/dashboard/social","Control center"],["/dashboard/social/manual","Manual generation"],["/dashboard/social/review?week=all","Review drafts"],["/dashboard/social/posts","Posts"],["/dashboard/social/calendar","Calendar"],["/dashboard/social/assets","Brand assets"],["/dashboard/social/brand","Brand Brain"],["/dashboard/social/integrations","Connection status"]].map(([href,label])=><Link key={href} href={href} className="admin-status">{label}</Link>)}</nav>
      <section className="admin-panel"><h2>From draft to publication</h2><p>Review the sources and caption, inspect the generated carousel slides, then approve and explicitly schedule it through the existing workflow. Instagram publishing requires Limitless Realty&apos;s own authorized connection. Fluxknight&apos;s accounts and automatic daily queue are separate.</p></section>
    </>}
  </main>;
}
