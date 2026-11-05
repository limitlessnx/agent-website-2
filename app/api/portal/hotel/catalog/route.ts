import { NextResponse } from "next/server";
import { hotelCatalogAccess } from "@/lib/hotel-catalog-access";
import { loadHotelCatalog, mutateHotelCatalog,readPublishedHotelCatalog } from "@/lib/hotel-catalog";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function failure(error:unknown){return NextResponse.json({error:error instanceof HotelWorkspaceError?error.message:"The hotel catalog is temporarily unavailable."},{status:error instanceof HotelWorkspaceError?error.status:503});}
export async function GET(request?:Request){try{const {session,canManage}=await hotelCatalogAccess();const query=request?new URL(request.url).searchParams:null;if(query?.get("preview")==="published")return NextResponse.json(await readPublishedHotelCatalog(session.organizationId,{query:query.get("query")||"",itemId:query.get("itemId")||undefined}));return NextResponse.json(await loadHotelCatalog(session.organizationId,canManage));}catch(error){return failure(error);}}
export async function POST(request:Request){try{const {session}=await hotelCatalogAccess(true);const body=await request.json().catch(()=>null);if(!body||typeof body!=="object"||Array.isArray(body))throw new HotelWorkspaceError("A valid catalog form is required.");return NextResponse.json(await mutateHotelCatalog(session.organizationId,session.userId,body));}catch(error){return failure(error);}}
