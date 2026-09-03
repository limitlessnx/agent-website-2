import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { getSupportLifecycleCases } from "@/lib/support-lifecycle";

type OrganizationRow = { id: string; name: string; slug: string };

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const organizations = await supabaseServerRequest<OrganizationRow[]>(
    "organizations?select=id,name,slug&order=name.asc&limit=100",
  ).catch(() => []);

  const grouped = await Promise.all(
    organizations.map(async (organization) => ({
      organization,
      cases: await getSupportLifecycleCases(organization.id),
    })),
  );

  const alerts = grouped.flatMap(({ organization, cases }) =>
    cases
      .filter((item) => item.escalationRequired || item.recurringIssue || item.targetState === "due_soon")
      .map((item) => ({ ...item, organization })),
  ).sort((a, b) => {
    const weight = (item: { priority: string; targetState: string }) =>
      (item.priority === "critical" ? 100 : item.priority === "high" ? 50 : 0) +
      (item.targetState === "overdue" ? 40 : item.targetState === "due_soon" ? 20 : 0);
    return weight(b) - weight(a) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return NextResponse.json({
    ok: true,
    alerts,
    summary: {
      organizations: organizations.length,
      openCases: grouped.reduce((total, group) => total + group.cases.filter((item) => !["resolved", "closed"].includes(item.status)).length, 0),
      escalations: grouped.reduce((total, group) => total + group.cases.filter((item) => item.escalationRequired).length, 0),
      recurring: grouped.reduce((total, group) => total + group.cases.filter((item) => item.recurringIssue).length, 0),
    },
  });
}
