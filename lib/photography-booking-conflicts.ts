type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

type MetadataRow = { appointment_id: string };
type AppointmentRow = { id: string; title: string | null; start_at: string | null; end_at: string | null; status: string };

const blockingStatuses = ["requested", "pending_availability", "confirmed", "rescheduled"];

export async function findPhotographerConflict(input: {
  admin: AdminClient;
  organizationId: string;
  photographerUserId: string;
  startAt: string | null;
  endAt: string | null;
  excludeAppointmentId?: string;
}) {
  if (!input.startAt || !input.endAt) return null;
  const { data: metadataRows, error: metadataError } = await input.admin
    .from("photography_booking_metadata")
    .select("appointment_id")
    .eq("organization_id", input.organizationId)
    .eq("assigned_photographer_id", input.photographerUserId);
  if (metadataError || !metadataRows?.length) return null;
  const ids = (metadataRows as MetadataRow[])
    .map((row) => row.appointment_id)
    .filter((id) => id !== input.excludeAppointmentId);
  if (!ids.length) return null;
  const { data: appointments } = await input.admin
    .from("appointments")
    .select("id,title,start_at,end_at,status")
    .eq("organization_id", input.organizationId)
    .in("id", ids)
    .in("status", blockingStatuses);
  const start = new Date(input.startAt).getTime();
  const end = new Date(input.endAt).getTime();
  const conflict = ((appointments || []) as AppointmentRow[]).find((item) => {
    if (!item.start_at || !item.end_at) return false;
    return new Date(item.start_at).getTime() < end && new Date(item.end_at).getTime() > start;
  });
  return conflict || null;
}
