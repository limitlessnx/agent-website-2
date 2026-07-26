"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const steps = [
  "Business Information",
  "Business & Services",
  "Contact & Communication",
  "AI Automation Requirements",
  "Business Resources",
  "Review & Submit",
];

type Submission = {
  id: string;
  status: string;
  current_step: number;
  business_information: Record<string, unknown>;
  business_services: Record<string, unknown>;
  communication_details: Record<string, unknown>;
  automation_requirements: Record<string, unknown>;
  business_resources: Record<string, unknown>;
  service_packages?: { name?: string; slug?: string };
};

type Props = { onboardingId: string; token: string };

function readString(source: Record<string, unknown> | undefined, key: string) {
  return typeof source?.[key] === "string" ? String(source[key]) : "";
}

export default function OnboardingClient({ onboardingId, token }: Props) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    "x-onboarding-id": onboardingId,
    "x-onboarding-token": token,
  }), [onboardingId, token]);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/onboarding", { headers, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load onboarding.");
        setSubmission(result.submission);
        setStep(Math.min(6, Math.max(1, result.submission.current_step || 1)));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load onboarding.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [headers]);

  async function saveStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submission || step === 6) return;
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));

    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ step, data }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save this step.");
      const fieldNames = ["", "business_information", "business_services", "communication_details", "automation_requirements", "business_resources"] as const;
      const field = fieldNames[step];
      setSubmission((current) => current ? { ...current, [field]: data, current_step: result.currentStep } : current);
      setStep(Math.min(6, step + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save this step.");
    } finally {
      setSaving(false);
    }
  }

  async function submitOnboarding() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers,
        body: JSON.stringify({ confirmed: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to submit onboarding.");
      setSubmission((current) => current ? { ...current, status: "submitted" } : current);
      setMessage("Your onboarding details have been submitted for review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit onboarding.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="onboarding-shell"><section className="onboarding-card"><p>Loading your onboarding workspace...</p></section></main>;
  if (!submission) return <main className="onboarding-shell"><section className="onboarding-card"><h1>Onboarding unavailable</h1><p>{message}</p></section></main>;

  const locked = ["submitted", "under_review", "provisioning", "internal_testing", "live"].includes(submission.status);

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card">
        <header className="onboarding-header">
          <div>
            <p className="admin-kicker">Fluxknight Managed Setup</p>
            <h1>{locked ? "Onboarding submitted" : "Tell us about your business"}</h1>
            <p>{submission.service_packages?.name || "Managed AI package"} · Your answers help the Fluxknight team configure the right system for you.</p>
          </div>
          <span className="admin-status live">Payment confirmed</span>
        </header>

        <div className="onboarding-progress">
          {steps.map((label, index) => (
            <button key={label} type="button" disabled={locked || index + 1 > submission.current_step} className={index + 1 === step ? "active" : index + 1 < step ? "done" : ""} onClick={() => setStep(index + 1)}>
              <span>{index + 1}</span>{label}
            </button>
          ))}
        </div>

        {locked ? (
          <section className="admin-panel">
            <div className="admin-panel-header"><div><h2>We have received your details</h2><p>Your system is now waiting for Super Admin review and configuration.</p></div></div>
            <div className="admin-list"><div className="admin-list-row"><div><strong>Current status</strong><span>{submission.status.replaceAll("_", " ")}</span></div><em className="good">received</em></div></div>
          </section>
        ) : (
          <>
            {step === 1 && <StepForm title="Business Information" description="Basic information about the company we are configuring." onSubmit={saveStep} saving={saving}>
              <label>Business name<input name="businessName" required defaultValue={readString(submission.business_information, "businessName")} /></label>
              <label>Industry<input name="industry" required defaultValue={readString(submission.business_information, "industry")} /></label>
              <label>Website<input name="website" type="url" defaultValue={readString(submission.business_information, "website")} /></label>
              <label>Country<input name="country" defaultValue={readString(submission.business_information, "country") || "Nigeria"} /></label>
              <label className="full">Business description<textarea name="businessDescription" rows={5} defaultValue={readString(submission.business_information, "businessDescription")} /></label>
            </StepForm>}

            {step === 2 && <StepForm title="Business & Services" description="Explain what you sell and who you serve. Plain language is better than brochure fog." onSubmit={saveStep} saving={saving}>
              <label className="full">Products or services<textarea name="productsServices" rows={5} required defaultValue={readString(submission.business_services, "productsServices")} /></label>
              <label className="full">Target customers<textarea name="targetCustomers" rows={4} defaultValue={readString(submission.business_services, "targetCustomers")} /></label>
              <label className="full">Pricing or payment plans<textarea name="pricing" rows={4} defaultValue={readString(submission.business_services, "pricing")} /></label>
              <label className="full">Frequently asked questions<textarea name="faqs" rows={6} defaultValue={readString(submission.business_services, "faqs")} /></label>
            </StepForm>}

            {step === 3 && <StepForm title="Contact & Communication" description="The channels customers already use to reach your business." onSubmit={saveStep} saving={saving}>
              <label>Business email<input name="businessEmail" type="email" required defaultValue={readString(submission.communication_details, "businessEmail")} /></label>
              <label>Phone number<input name="phoneNumber" defaultValue={readString(submission.communication_details, "phoneNumber")} /></label>
              <label>WhatsApp number<input name="whatsappNumber" defaultValue={readString(submission.communication_details, "whatsappNumber")} /></label>
              <label>Telegram username<input name="telegram" defaultValue={readString(submission.communication_details, "telegram")} /></label>
              <label>Business hours<input name="businessHours" defaultValue={readString(submission.communication_details, "businessHours")} /></label>
              <label>Human escalation contact<input name="escalationContact" defaultValue={readString(submission.communication_details, "escalationContact")} /></label>
            </StepForm>}

            {step === 4 && <StepForm title="AI Automation Requirements" description="Describe the business outcomes you want. The Super Admin decides the technical implementation." onSubmit={saveStep} saving={saving}>
              <label className="full">What should the AI system help you achieve?<textarea name="goals" rows={6} required defaultValue={readString(submission.automation_requirements, "goals")} /></label>
              <label className="full">Tasks the system should handle<textarea name="tasks" rows={6} placeholder="Customer support, lead qualification, appointment booking, follow-up, email automation..." defaultValue={readString(submission.automation_requirements, "tasks")} /></label>
              <label className="full">When should a human take over?<textarea name="handoffRules" rows={4} defaultValue={readString(submission.automation_requirements, "handoffRules")} /></label>
              <label className="full">Additional requirements<textarea name="additionalRequirements" rows={4} defaultValue={readString(submission.automation_requirements, "additionalRequirements")} /></label>
            </StepForm>}

            {step === 5 && <StepForm title="Business Resources" description="List the materials available for your setup. Secure upload support will attach the actual files to this record." onSubmit={saveStep} saving={saving}>
              <label className="full">Available documents<textarea name="availableDocuments" rows={5} placeholder="Logo, product catalogue, SOPs, price lists, policies, scripts..." defaultValue={readString(submission.business_resources, "availableDocuments")} /></label>
              <label className="full">Brand voice and style<textarea name="brandVoice" rows={4} defaultValue={readString(submission.business_resources, "brandVoice")} /></label>
              <label className="full">Important policies or restrictions<textarea name="policies" rows={5} defaultValue={readString(submission.business_resources, "policies")} /></label>
              <label className="full">Links to cloud files<textarea name="resourceLinks" rows={4} placeholder="Google Drive, Dropbox, website pages..." defaultValue={readString(submission.business_resources, "resourceLinks")} /></label>
            </StepForm>}

            {step === 6 && <section className="admin-panel">
              <div className="admin-panel-header"><div><h2>Review & Submit</h2><p>Confirm the information below. After submission, editing is locked while the Super Admin configures your system.</p></div></div>
              <div className="onboarding-review">
                <Review title="Business" data={submission.business_information} />
                <Review title="Services" data={submission.business_services} />
                <Review title="Communication" data={submission.communication_details} />
                <Review title="Automation requirements" data={submission.automation_requirements} />
                <Review title="Resources" data={submission.business_resources} />
              </div>
              <div className="admin-inline-actions"><button className="admin-button secondary" type="button" onClick={() => setStep(5)}>Back</button><button className="admin-button" type="button" disabled={saving} onClick={submitOnboarding}>{saving ? "Submitting..." : "Confirm and submit"}</button></div>
            </section>}
          </>
        )}

        {message ? <p className="admin-form-message">{message}</p> : null}
      </section>
    </main>
  );
}

function StepForm({ title, description, onSubmit, saving, children }: { title: string; description: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean; children: React.ReactNode }) {
  return <form className="admin-panel admin-form" onSubmit={onSubmit}><div className="admin-panel-header"><div><h2>{title}</h2><p>{description}</p></div></div><div className="admin-form-grid onboarding-form-grid">{children}</div><div className="admin-inline-actions"><button className="admin-button" disabled={saving} type="submit">{saving ? "Saving..." : "Save and continue"}</button></div></form>;
}

function Review({ title, data }: { title: string; data: Record<string, unknown> }) {
  return <article><h3>{title}</h3>{Object.entries(data || {}).map(([key, value]) => <div key={key}><strong>{key.replace(/([A-Z])/g, " $1")}</strong><span>{String(value || "Not provided")}</span></div>)}</article>;
}
