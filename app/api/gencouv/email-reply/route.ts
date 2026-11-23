import {NextResponse} from "next/server";
import {requireGencouvAdmin,gencouvError,GencouvRequestError,GENCOUV_UUID,gencouvPrivateHeaders} from "@/lib/gencouv-admin";
import {sendGencouvBatch} from "@/lib/gencouv-send";
export async function POST(request:Request){
  try{
    const {db,organizationId,session}=await requireGencouvAdmin(request);
    const body=await request.json();const inboundId=String(body.inbound_message_id||body.message_id||"");
    if(!GENCOUV_UUID.test(inboundId))throw new GencouvRequestError("Choose an inbound message to reply to.");
    const inbound=await db.from("gencouv_email_messages").select("id,recipient_email,subject,direction,message_id_header,provider_message_id,in_reply_to_header,references_header").eq("organization_id",organizationId).eq("id",inboundId).maybeSingle();
    if(inbound.error||!inbound.data||inbound.data.direction!=="inbound")throw new GencouvRequestError("Inbound message not found.",404);
    const message=inbound.data;const to=String(body.to||body.recipient_email||"").trim().toLowerCase();
    if(to!==message.recipient_email.toLowerCase())throw new GencouvRequestError("Reply recipient must match the selected inbound sender.");
    const subjectInput=String(body.subject||message.subject||"Gencouv").trim();
    const reference=String(message.message_id_header||message.provider_message_id||message.in_reply_to_header||"").replace(/[\r\n]/g,"");
    const headers:Record<string,string>={};if(reference){headers["In-Reply-To"]=reference;headers.References=[message.references_header,reference].filter(Boolean).join(" ").replace(/[\r\n]/g,"").slice(0,4000);}
    const result=await sendGencouvBatch(db,organizationId,session.email,{request_id:body.request_id,from:"info@gencouv.com",to,subject:/^re:/i.test(subjectInput)?subjectInput:`Re: ${subjectInput}`,text:String(body.message||body.text_body||""),confirmed:body.confirmed===true,mode:"proposal",reply_message_id:inboundId,reply_headers:headers});
    return NextResponse.json({success:true,...result,message:result.note},{headers:gencouvPrivateHeaders});
  }catch(error){const safe=gencouvError(error);return NextResponse.json({success:false,message:safe.message},{status:safe.status,headers:gencouvPrivateHeaders});}
}
