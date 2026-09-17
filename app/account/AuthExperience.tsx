import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./AuthExperience.module.css";

type AuthExperienceProps = {
  mode: "login" | "signup";
  children: ReactNode;
};

const steps = [
  ["01", "Customer channels", "WhatsApp · Web · Calls"],
  ["02", "Fluxknight AI", "Qualifies · Responds · Routes"],
  ["03", "Business systems", "CRM · Follow-up · Booking"],
];

export default function AuthExperience({ mode, children }: AuthExperienceProps) {
  const isSignup = mode === "signup";

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.orbA} />
        <span className={styles.orbB} />
        <span className={styles.grid} />
      </div>

      <div className={styles.shell}>
        <aside className={styles.contextPanel} aria-label="Fluxknight workspace preview">
          <Link href="/" className={styles.brand} aria-label="Fluxknight home">
            <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /></span>
            <span>FLUXKNIGHT</span>
          </Link>

          <div className={styles.contextCopy}>
            <span className={styles.eyebrow}>{isSignup ? "WORKSPACE SETUP" : "CLIENT ACCESS"}</span>
            <h1>{isSignup ? "Build your Fluxknight workspace." : "Your business, connected."}</h1>
            <p>
              {isSignup
                ? "Create the workspace your team will use to connect conversations, follow-up and operations."
                : "Access the system that connects customer conversations, follow-up and day-to-day operations."}
            </p>
          </div>

          <div className={styles.productFrame}>
            <div className={styles.productTopbar}>
              <div className={styles.productTitle}><span className={styles.liveDot} /> Operations live</div>
              <span className={styles.secure}>SECURE WORKSPACE</span>
            </div>

            <div className={styles.flow}>
              {steps.map(([number, title, detail], index) => (
                <div className={styles.flowRow} key={number}>
                  <div className={styles.stepNumber}>{number}</div>
                  <div className={styles.flowNode}>
                    <strong>{title}</strong>
                    <span>{detail}</span>
                  </div>
                  {index < steps.length - 1 ? <div className={styles.connector} aria-hidden="true" /> : null}
                </div>
              ))}
            </div>

            <div className={styles.signalBar}>
              <span><b>24/7</b> AI coverage</span>
              <span><b>1</b> connected workspace</span>
              <span><b>Live</b> operational context</span>
            </div>
          </div>

          <div className={styles.contextFooter}>
            <span className={styles.liveDot} />
            Fluxknight systems online
          </div>
        </aside>

        <section className={styles.formPanel}>
          <div className={styles.mobileBrand}>
            <Link href="/" className={styles.brand} aria-label="Fluxknight home">
              <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /></span>
              <span>FLUXKNIGHT</span>
            </Link>
          </div>
          <div className={styles.formWrap}>{children}</div>
          <div className={styles.mobileStatus}><span className={styles.liveDot} /> AI systems online</div>
        </section>
      </div>
    </main>
  );
}
