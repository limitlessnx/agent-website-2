import { redirect } from "next/navigation";

export default function LegacyPortalRedirect(){
  redirect("/portal/settings");
}
