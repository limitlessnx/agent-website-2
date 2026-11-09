import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { hotelActivityAccess, hotelActivityPage, hotelActivityTimezone, loadHotelThread } from "@/lib/hotel-client-activity";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
import styles from "@/components/portal/hotel/HotelActivity.module.css";
export const dynamic = "force-dynamic";
export default async function HotelThreadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  let session;
  try { session = await hotelActivityAccess("inbox"); } catch (error) { if (error instanceof HotelWorkspaceError && error.status === 401) redirect("/account/login"); return <main className={styles.page}><h1>Conversation access required</h1></main>; }
  const { id } = await params;
  let data, timeZone, page;
  try { page = hotelActivityPage((await searchParams).page); [data, timeZone] = await Promise.all([loadHotelThread(session.organizationId, id, page), hotelActivityTimezone(session.organizationId)]); }
  catch (error) { if (error instanceof HotelWorkspaceError && error.status === 404) notFound(); return <main className={styles.page}><h1>Conversation unavailable</h1><p className={styles.error}>The message history could not be loaded. Try again.</p></main>; }
  const format = (value: string) => new Intl.DateTimeFormat("en", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <main className={styles.page}><header className={styles.header}><div><h1>{data.guest}</h1><p>{data.conversation.channel} · {data.conversation.status.replaceAll("_", " ")} · {data.total} recorded messages</p></div><nav className={styles.nav}><Link href="/portal/hotel/inbox">Back to guest conversations</Link><Link href="/portal/hotel/followups">Reminder tracking</Link></nav></header>
    <p className={styles.definition}>Read-only conversation monitoring. Maia’s recorded replies and guest messages are shown below. This page does not activate Maia or send a message.</p>
    <section className={styles.messages} aria-label="Guest message history">{data.messages.map(message => <article key={message.id} className={styles.message} data-direction={message.direction}><strong>{({customer:"Guest",human:"Team member",agent:"Maia",system:"System",tool:"Tool"} as Record<string,string>)[message.sender_type] || "Business message"}</strong><p>{message.content}</p><small>{format(message.created_at)} · {message.status || "Status not recorded"}</small></article>)}{!data.messages.length ? <p>No messages on this page.</p> : null}</section>
    <nav className={styles.pager} aria-label="Message history pages">{page > 0 ? <Link href={`/portal/hotel/inbox/${id}?page=${page - 1}`}>Newer messages</Link> : <span />}<span>{page === 0 ? "Latest 100 messages" : `History page ${page + 1}`}</span>{(page + 1) * 100 < data.total ? <Link href={`/portal/hotel/inbox/${id}?page=${page + 1}`}>Older messages</Link> : <span />}</nav>
  </main>;
}
