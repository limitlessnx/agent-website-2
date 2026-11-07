import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminOrganizationContext } from "@/lib/admin-organization-context";
import { addressMatches, asMailRows, FLUXKNIGHT_SENDERS, isFluxknightAddress, resendApi } from "@/lib/fluxknight-mail";

export const dynamic = "force-dynamic";
async function authorize() {
  const [session, context] = await Promise.all([getAdminSession(), getAdminOrganizationContext()]);
  return Boolean(session && context.kind === "system" && context.id === "fluxknight");
}
const unauthorized = () => NextResponse.json({error:"Fluxknight admin workspace required."},{status:403});
const headers = {"Cache-Control":"private, no-store"};

export async function GET(request: NextRequest) {
  if (!(await authorize())) return unauthorized();
  const kind = request.nextUrl.searchParams.get("kind") === "sent" ? "sent" : "inbox";
  const sender = request.nextUrl.searchParams.get("sender") || FLUXKNIGHT_SENDERS[0];
  if (!isFluxknightAddress(sender)) return NextResponse.json({error:"Invalid mailbox."},{status:400});
  const id = request.nextUrl.searchParams.get("id");
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:"Invalid message id."},{status:400});
  try {
    if (id) {
      const detail = await resendApi("/emails/" + (kind === "inbox" ? "receiving/" : "") + encodeURIComponent(id));
      // Resend keys cover several brands; never disclose other brands' emails.
      if (!addressMatches(kind === "inbox" ? detail.to : detail.from) ||
          !(kind === "inbox" ? (Array.isArray(detail.to) ? detail.to.includes(sender) : detail.to === sender) : String(detail.from).toLowerCase().includes(sender))) {
        return NextResponse.json({error:"Message not found."},{status:404});
      }
      return NextResponse.json({email: {
        id:detail.id, from:detail.from, to:detail.to, subject:detail.subject,
        text:detail.text, html:detail.html, created_at:detail.created_at,
        last_event:detail.last_event, message_id:detail.message_id
      }},{headers});
    }
    // Read a bounded account-wide page; filter on the server before responding.
    const collection = await resendApi(kind === "inbox" ? "/emails/receiving?limit=100" : "/emails?limit=100");
    const rows = asMailRows(collection).filter(row => kind === "inbox"
      ? row.to.some(to => to.toLowerCase() === sender)
      : row.from.toLowerCase().includes(sender));
    return NextResponse.json({emails:rows, kind, sender, has_more:collection.has_more === true, note:"Showing matching messages from the most recent 100 account-wide records."},{headers});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error ? error.message : "Unable to load email."},{status:502,headers});
  }
}
export async function POST(request: NextRequest) {
  if (!(await authorize())) return unauthorized();
  // Require same-origin browser requests to protect the authenticated session.
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const body = await request.json().catch(() => null) as Record<string,unknown> | null;
  if (!body) return NextResponse.json({error:"Invalid request."},{status:400});
  const from = String(body.from || "").trim().toLowerCase();
  const to = String(body.to || "").trim();
  const subject = String(body.subject || "").trim();
  const text = String(body.text || "").trim();
  if (!isFluxknightAddress(from) || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to) ||
      !subject || !text || to.length > 254 || subject.length > 200 || text.length > 30000) {
    return NextResponse.json({error:"Provide a valid sender, single recipient, subject and message."},{status:400});
  }
  if (body.confirmed !== true) return NextResponse.json({error:"Review and confirm the message before sending."},{status:400});
  try {
    const sent = await resendApi("/emails",{
      method:"POST",
      body:JSON.stringify({from:"Fluxknight <" + from + ">",to:[to],subject,text,reply_to:from})
    });
    return NextResponse.json({ok:true,id:sent.id},{status:201,headers});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error ? error.message : "Send failed."},{status:502,headers});
  }
}
