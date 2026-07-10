import type { Metadata } from "next";
import CaseStudiesClient from "./CaseStudiesClient";
export const metadata: Metadata = { title:"Case Studies", description:"Real AI automation systems built for real estate and computer sales businesses — with measurable results." };
export default function CaseStudiesPage() { return <CaseStudiesClient />; }
