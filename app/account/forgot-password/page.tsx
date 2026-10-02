import type { Metadata } from "next";
import AuthExperience from "../AuthExperience";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset Password | Fluxknight", robots: { index:false, follow:false } };

export default async function ForgotPasswordPage({searchParams}:{searchParams:Promise<{next?:string}>}){
  const params=await searchParams;
  const nextPath=String(params.next||"/portal");
  return <AuthExperience mode="login"><ForgotPasswordForm nextPath={nextPath}/></AuthExperience>;
}
