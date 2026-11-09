"use client";
import Image from "next/image";
import { useState } from "react";
import { BedDouble } from "lucide-react";
import styles from "./HotelOverview.module.css";
export default function HotelHeaderPhoto({ url, caption }: { url?: string; caption?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={styles.headerPhoto}>{url && !failed ? <Image src={url} alt={caption || "Hotel catalog photo"} fill unoptimized sizes="(max-width: 760px) 45vw, 340px" onError={() => setFailed(true)} /> : <><BedDouble size={32} aria-hidden="true" /><span>Hotel photos</span></>}</div>;
}
