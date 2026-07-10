import type { Metadata } from "next";
import AboutClient from "./AboutClient";
export const metadata: Metadata = { title:"About", description:"Who we are, why we build AI automation systems, and how we think about the work." };
export default function AboutPage() { return <AboutClient />; }
