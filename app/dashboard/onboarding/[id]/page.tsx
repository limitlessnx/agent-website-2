import { notFound } from "next/navigation";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import OnboardingReviewClient from "./OnboardingReviewClient";
import DeliveryPreparationPanel from "./DeliveryPreparationPanel";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function OnboardingReviewPage({ params }: Params) {
  const { id } = await params;
  const safeId = encodeURIComponent(id);

  const [submissions, documents, notes, tasks, events, organizations, models, templates, notifications] = await Promise.all([
    supabaseServerRequest<any[]>(`client_onboarding_submissions?select=*,service_packages(id,name,slug,currency,billing_interval,included_modules),organizations(id,name,slug,status)&id=eq.${safeId}&limit=1`),
    supabaseServerRequest<any[]>(`client_onboarding_documents?select=*&onboarding_id=eq.${safeId}&order=created_at.desc`),
    supabaseServerRequest<any[]>(`client_onboarding_notes?select=*&onboarding_id=eq.${safeId}&order=created_at.desc`),
    supabaseServerRequest<any[]>(`organization_deployment_tasks?select=*&onboarding_id=eq.${safeId}&order=created_at.asc`),
    supabaseServerRequest<any[]>(`client_onboarding_status_events?select=*&onboarding_id=eq.${safeId}&order=created_at.desc`),
    supabaseServerRequest<any[]>("organizations?select=id,name,slug,status&order=name.asc"),
    supabaseServerRequest<any[]>("ai_model_catalog?select=id,provider,model_key,display_name,status&status=eq.active&order=provider.asc,display_name.asc"),
    supabaseServerRequest<any[]>("organization_templates?select=id,name,slug,industry,description,status&status=eq.active&order=name.asc"),
    supabaseServerRequest<any[]>(`client_delivery_notifications?select=*&onboarding_id=eq.${safeId}&order=created_at.desc`),
  ]);

  const submission = submissions[0];
  if (!submission) notFound();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Managed Delivery</p>
          <h1>{String(submission.business_information?.businessName || submission.purchaser_email)}</h1>
          <p>Review the client intake, provision the workspace, configure delivery, and activate only after testing is complete.</p>
        </div>
      </div>
      <OnboardingReviewClient
        submission={submission}
        documents={documents}
        initialNotes={notes}
        initialTasks={tasks}
        events={events}
        organizations={organizations}
        models={models}
        templates={templates}
      />
      <DeliveryPreparationPanel
        onboardingId={submission.id}
        organizationId={submission.organization_id}
        notifications={notifications}
      />
    </div>
  );
}
