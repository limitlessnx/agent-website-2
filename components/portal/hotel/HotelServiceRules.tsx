import { HOTEL_SERVICE_RULE_FIELDS, type HotelServiceRules as ServiceRules } from "@/lib/hotel-service-rules";
import styles from "./HotelServiceRules.module.css";

export default function HotelServiceRules({ rules }: { rules?: ServiceRules }) {
  const entries = Object.entries(HOTEL_SERVICE_RULE_FIELDS).filter(([key]) => rules?.[key as keyof ServiceRules]);
  if (!entries.length) return null;
  return <section className={styles.summary} aria-label="Service operating instructions"><h3>Service operating instructions</h3><p>Guidance for the concierge. Hotel policies and manager confirmation still apply.</p>{entries.map(([key, label]) => <div key={key}><h4>{label}</h4><p>{rules![key as keyof ServiceRules]}</p></div>)}</section>;
}
