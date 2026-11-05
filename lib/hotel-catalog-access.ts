import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { requireHotelOrganization } from "@/lib/hotel-communications";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
export async function hotelCatalogAccess(write=false) {
  const session=await getClientSession();if(!session)throw new HotelWorkspaceError("Sign in to this workspace.",401);
  try {
    const access=session.isAdminPreview&&!write?{permissions:new Set(["customers.view"])}:await requirePortalPermission(session,write?["customers.manage"]:["customers.view","customers.manage"]);
    if(write&&session.isAdminPreview)throw new Error("Read-only preview");
    await requireHotelOrganization(session.organizationId);
    return {session,canManage:!session.isAdminPreview&&access.permissions.has("customers.manage")};
  } catch {throw new HotelWorkspaceError("Hotel catalog access required.",403);}
}
