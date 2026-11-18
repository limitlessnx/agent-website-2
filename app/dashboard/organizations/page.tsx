import OrganizationAdminActions from "@/components/admin/OrganizationAdminActions";
import { PageHeader, DashboardCard, CardHeader, StatusBadge, Button, SearchFilters, EmptyState } from "@/components/ui/DashboardPrimitives";
import { getAdminOrganizations } from "@/lib/admin-control-center";
import { organizationCategory, organizationCategoryLabels, SYSTEM_ORGANIZATIONS } from "@/lib/organization-context-catalog";
import styles from "@/components/admin/ControlCenter.module.css";
export const dynamic = "force-dynamic";

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; selection?: string; page?: string }> }) {
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 200).trim() : "";
  const category = query.category === "platform" || query.category === "internal" || query.category === "customer" ? query.category : undefined;
  const page = typeof query.page === "string" && /^\d+$/.test(query.page) ? Math.min(10000, Math.max(1, Number(query.page))) : 1;
  const pageHref = (value: number) => `/dashboard/organizations?${new URLSearchParams({q, category: category || "", page: String(value)})}`;
  const evidence = await getAdminOrganizations({search:q,category,page}).catch(() => null);
  const rows = (evidence?.rows || []).filter(row => (!category || organizationCategory(row.slug) === category) && `${row.name} ${row.slug} ${row.id}`.toLowerCase().includes(q.toLowerCase()));
  return <main className="admin-page dashboard-v2-page"><div className={styles.stack}>
    <PageHeader kicker="Platform administration" title="Organization Registry" description="Platform administration, internal businesses and independent customer tenants remain distinct. Managing an organization does not create tenant membership." actions={<Button href="/dashboard/clients/create">Create organization</Button>} />
    {query.selection === "unavailable" ? <p role="alert">Workspace could not be selected or logged. Your previous context has been retained. Try again after reviewing access.</p> : null}
    <DashboardCard><CardHeader title="Administration contexts" description="Configured workspace destinations. Database presence and lifecycle status are shown in the registry below." />
      <div className={styles.stack}>{SYSTEM_ORGANIZATIONS.map(item => <div className={styles.row} key={item.id}>
        <div className={styles.identity}><strong>{item.name}</strong><span>{organizationCategoryLabels[organizationCategory(item.id)]}</span></div>
        <Button variant="outline" prefetch={false} href={`/dashboard/switch/system/${item.id}`}>Select admin context</Button>
      </div>)}</div>
    </DashboardCard>
    <DashboardCard><CardHeader title="Registered organizations" description="Search organization names or an exact organization ID. Lifecycle status is separate from provisioning readiness and subscription status." />
      <div className={styles.filters}><SearchFilters action="/dashboard/organizations" label="Find an organization" defaultValue={q}>
        <label><span>Organization context</span><select name="category" defaultValue={category || ""}><option value="">All contexts</option><option value="platform">Platform administration</option><option value="internal">Internal organizations</option><option value="customer">Customer tenants</option></select></label>
      </SearchFilters></div>
      {!evidence?.available ? <p role="alert">Organization registry unavailable. Refresh to retry; no organization count or health can be established.</p> : <>
        <p className={styles.note}>{rows.length} matching records · page {page}. {evidence.truncated ? "More organizations are available on the next page." : "End of results."}</p>
        {rows.map(row => <article className={styles.row} key={row.id}>
          <div className={styles.identity}><strong>{row.name || "Unnamed organization"}</strong><span>{organizationCategoryLabels[organizationCategory(row.slug)]}</span><small>{row.slug} · {row.id}</small><div className={styles.status}><StatusBadge>{row.status || "Unknown lifecycle"}</StatusBadge><span>Organization lifecycle</span></div></div>
          <div className={styles.actions}><Button href={`/dashboard/clients/${encodeURIComponent(row.id)}/manage`}>Manage</Button><Button variant="outline" href={`/dashboard/provisioning?organizationId=${encodeURIComponent(row.id)}`}>Readiness & ownership</Button><Button variant="outline" prefetch={false} href={`/dashboard/preview/tenant/${encodeURIComponent(row.id)}`}>Preview read-only</Button><OrganizationAdminActions organization={row} /></div>
        </article>)}
        {!rows.length ? <EmptyState title="No matching organizations" description="Adjust the search or organization context filter." /> : null}
        <div className={styles.actions}>{page > 1 ? <Button href={pageHref(page - 1)} variant="outline">Previous page</Button> : null}{evidence.truncated ? <Button href={pageHref(page + 1)} variant="outline">Next page</Button> : null}</div>
      </>}
    </DashboardCard>
    <DashboardCard><CardHeader title="Workspace access" description="Choose the access mode that matches the task." /><p className={styles.note}>Manage opens platform administration controls. Preview opens the existing read-only tenant inspector. Live tenant access uses the usual account and requires active tenant membership and permissions. Selecting an admin context grants neither membership nor activation.</p><div className={styles.actions}><Button href="/dashboard/clients" variant="outline">Onboarding records</Button><Button href="/portal" variant="outline">My tenant workspace</Button></div></DashboardCard>
  </div></main>;
}
