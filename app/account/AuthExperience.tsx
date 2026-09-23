import Link from "next/link";
import type { ReactNode } from "react";
import FluxLogo from "@/components/FluxLogo";
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
        <span className={styles.glowWarm} />
        <span className={styles.grid} />
      </div>

      <div className={styles.shell}>
        <Link href="/" className={styles.brand} aria-label="Fluxknight home">
          <FluxLogo />
        </Link>

        <section
          className={`${styles.card} ${isSignup ? styles.signupCard : ""}`}
          aria-label={isSignup ? "Create Fluxknight account" : "Fluxknight sign in"}
        >
          <div className={styles.cardAccent} aria-hidden="true" />
          <div className={styles.formWrap}>{children}</div>
        </section>

        <p className={styles.status}><span /> Secure Fluxknight workspace</p>
      </div>
    </main>
  );
}
