import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./AuthExperience.module.css";

type AuthExperienceProps = {
  mode: "login" | "signup";
  children: ReactNode;
};

export default function AuthExperience({ mode, children }: AuthExperienceProps) {
  const isSignup = mode === "signup";

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.glowTop} />
        <span className={styles.glowSide} />
      </div>

      <section className={`${styles.card} ${isSignup ? styles.signupCard : ""}`} aria-label={isSignup ? "Create Fluxknight workspace" : "Fluxknight sign in"}>
        <Link href="/" className={styles.brand} aria-label="Fluxknight home">
          <span className={styles.mark} aria-hidden="true"><i /><i /><i /></span>
          <span>FLUXKNIGHT</span>
        </Link>

        <div className={styles.formWrap}>{children}</div>
      </section>

      <p className={styles.status}><span /> Secure client workspace</p>
    </main>
  );
}
