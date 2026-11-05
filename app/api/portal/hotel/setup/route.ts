import {requirePortalPermission} from "@/lib/portal-access";
import {checkWhatsAppReadiness} from "@/lib/whatsapp-integration";
import {NextResponse} from "next/server";
import {hotelSetupAccess,loadHotelSetup,saveHotelSetup} from "@/lib/hotel-setup";
import {HotelWorkspaceError} from "@/lib/hotel-booking-service";
export const dynamic="force-dynamic";
function failure(error:unknown){return NextResponse.json({error:error instanceof HotelWorkspaceError?error.message:"Hotel setup is temporarily unavailable."},{status:error instanceof HotelWorkspaceError?error.status:503});}
export async function GET(){try{const {session,permissions}=await hotelSetupAccess();return NextResponse.json(await loadHotelSetup(session.organizationId,permissions,session.isAdminPreview));}catch(error){return failure(error);}}
export async function POST(request:Request){try{const body=await request.json().catch(()=>null);if(body?.action==="verify_whatsapp"){const {session}=await hotelSetupAccess();try{await requirePortalPermission(session,["integrations.manage"]);}catch{throw new HotelWorkspaceError("WhatsApp configuration permission required.",403);}const result=await checkWhatsAppReadiness(session.organizationId);return NextResponse.json({configured:result.configured,readyForCutover:result.readyForCutover,checks:result.checks});}const {session}=await hotelSetupAccess(true);if(!body||typeof body!=="object"||Array.isArray(body))throw new HotelWorkspaceError("A valid settings form is required.");return NextResponse.json(await saveHotelSetup(session.organizationId,session.userId,body));}catch(error){return failure(error);}}
