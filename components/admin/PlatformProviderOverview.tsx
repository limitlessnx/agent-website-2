import { CardHeader, DashboardCard, StatusBadge, Button } from "@/components/ui/DashboardPrimitives";
import { getPlatformProviderReadiness } from "@/lib/platform-provider-readiness";
import styles from "./ControlCenter.module.css";

export default function PlatformProviderOverview() {
  return <DashboardCard id="platform-providers">
    <CardHeader title="Platform provider configuration" description="Server configuration presence only. This does not verify credentials, connectivity or tenant authorization." />
    <div className={styles.stack}>{getPlatformProviderReadiness().map(provider => <div className={styles.row} key={provider.name}>
      <div className={styles.identity}><strong>{provider.name}</strong><StatusBadge tone={provider.configured ? "info" : "neutral"}>{provider.configured ? "Configuration present · unverified" : "Platform defaults not configured"}</StatusBadge><small>Organization-owned connections are listed separately below.</small></div>
      <Button href={provider.href} variant="outline">Review configuration</Button>
    </div>)}</div>
  </DashboardCard>;
}
