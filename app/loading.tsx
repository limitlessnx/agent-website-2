import styles from "./loading.module.css";

export default function Loading() {
  return (
    <main className={styles.screen} aria-live="polite" aria-busy="true">
      <div className={styles.wrap}>
        <div className={styles.mark} aria-hidden="true">
          <span className={styles.ring} />
          <span className={styles.core} />
        </div>
        <p className={styles.label}>Loading Fluxknight</p>
      </div>
    </main>
  );
}
