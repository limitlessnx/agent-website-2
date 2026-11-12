import { createHash } from "node:crypto";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { requireHotelOrganization } from "@/lib/hotel-communications";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
export async function hotelCatalogAccess(write=false) {
  const session=await getClientSession();if(!session)throw new HotelWorkspaceError("Sign in to this workspace.",401);
  try {
    await requireHotelOrganization(session.organizationId);
    if (session.isAdminPreview) {
      // Preview sessions have a signed hotel target and a verified admin principal.
      // Catalog records require a UUID, while the admin account is identified by email.
      const bytes = createHash("sha256")
        .update(`fluxknight:hotel-catalog:admin:${session.email.trim().toLowerCase()}`)
        .digest().subarray(0, 16);
      bytes[6] = (bytes[6] & 0x0f) | 0x80;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = bytes.toString("hex");
      const actorId = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
      return { session, canManage: true, actorId };
    }
    const access = await requirePortalPermission(session, write ? ["customers.manage"] : ["customers.view", "customers.manage"]);
    return { session, canManage: access.permissions.has("customers.manage"), actorId: session.userId };
  } catch {throw new HotelWorkspaceError("Hotel catalog access required.",403);}
}
