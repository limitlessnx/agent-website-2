"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApplicationArea =
    pathname === "/login" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/account");
  const hasEmbeddedHomepageNavigation = pathname === "/";

  if (isApplicationArea) return <main>{children}</main>;

  return (
    <>
      {!hasEmbeddedHomepageNavigation ? <Navbar /> : null}
      <main>{children}</main>
      <Footer />
    </>
  );
}
