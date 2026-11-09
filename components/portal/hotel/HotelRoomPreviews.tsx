"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BedDouble, ArrowUpRight } from "lucide-react";
import { formatHotelMoney } from "@/lib/hotel-booking-contract";
import type { HotelOverviewData } from "@/lib/hotel-overview-contract";
import styles from "./HotelOverview.module.css";

export default function HotelRoomPreviews({ data }: { data: HotelOverviewData }) {
  const [failed, setFailed] = useState<string[]>([]);
  return <div className={styles.roomCards}>{data.availability.slice(0, 6).map(type => {
    const photo = data.details?.roomPhotos.find(photo => photo.roomTypeId === type.id);
    return <article key={type.id}><div className={styles.roomPhoto}>{photo && !failed.includes(photo.url) ? <Image src={photo.url} alt={photo.caption} fill unoptimized sizes="(max-width: 760px) 100vw, 360px" onError={() => setFailed(current => [...current, photo.url])} /> : <BedDouble size={32} aria-hidden="true" />}</div><div className={styles.roomCardBody}>
      <span className={type.available_rooms > 0 ? styles.available : styles.unavailable}>{type.available_rooms} available</span><h3>{type.name}</h3><p>From {formatHotelMoney(type.nightly_rate_minor, type.currency)} / night</p><small>Up to {type.capacity} guests · {type.active_rooms} active rooms</small>
      <Link href="/portal/hotel/catalog">Room information<ArrowUpRight size={15} /></Link>
      {data.canManage && type.available_rooms > 0 ? <Link href={`/portal/hotel?action=new&arrival=${data.range.arrival}&departure=${data.range.departure}&guests=${data.range.guests}&roomType=${type.id}`}>Start reservation<ArrowUpRight size={15} /></Link> : null}
    </div></article>;
  })}{!data.availability.length ? <p>No room types yet. Add types and physical rooms in Rooms.</p> : null}</div>;
}
