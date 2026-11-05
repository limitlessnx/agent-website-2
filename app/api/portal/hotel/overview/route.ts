import { NextResponse } from "next/server";
import { hotelOverviewAccess,loadHotelOverview } from "@/lib/hotel-overview";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request){try{const {session,permissions}=await hotelOverviewAccess();const query=new URL(request.url).searchParams;const range=["arrival","departure","guests"].some(key=>query.has(key))?{arrival:query.get("arrival")||"",departure:query.get("departure")||"",guests:Number(query.get("guests")||2)}:undefined;return NextResponse.json(await loadHotelOverview(session.organizationId,permissions,Boolean(session.isAdminPreview),range));}catch(error){return NextResponse.json({error:error instanceof HotelWorkspaceError?error.message:"Hotel overview is temporarily unavailable."},{status:error instanceof HotelWorkspaceError?error.status:503});}}
