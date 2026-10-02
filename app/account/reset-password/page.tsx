import type { Metadata } from "next";
import AuthExperience from "../AuthExperience";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a New Password | Fluxknight", robots: { index:false, follow:false } };

export default function ResetPasswordPage(){
  return <AuthExperience mode="login"><ResetPasswordForm/></AuthExperience>;
}
