import { redirect } from "next/navigation";
import { getManagerSession } from "@/lib/client-auth";
import ManagerOrganizationsClient from "./ManagerOrganizationsClient";

export const dynamic="force-dynamic";

export default async function ManageOrganizationsPage(){
 const session=await getManagerSession();
 if(!session) redirect("/account/login");
 return <ManagerOrganizationsClient email={session.email}/>;
}
