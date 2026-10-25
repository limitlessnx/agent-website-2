import ActionForm from "../ActionForm";
import { saveEstateAction } from "../actions";
import type { Estate } from "@/lib/real-estate-catalog";
export default function EstateForm({estate}:{estate?:Estate}){
 const payment=typeof estate?.payment_terms==="string"?estate.payment_terms:estate?.payment_terms?JSON.stringify(estate.payment_terms,null,2):"";
 return <ActionForm action={saveEstateAction} label={estate?"Save estate and knowledge":"Create estate"}>
  <input type="hidden" name="estate_id" value={estate?.id||""}/>
  <label>Estate name<input name="name" defaultValue={estate?.name||""} required maxLength={240}/></label>
  <label>Location<input name="location" defaultValue={estate?.location||""}/></label>
  <label className="wide">Address<input name="address" defaultValue={estate?.address||""}/></label>
  <label className="wide">Overview and description<textarea name="description" defaultValue={estate?.description||""}/></label>
  <label>Contact name<input name="contact_name" defaultValue={estate?.contact_name||""}/></label>
  <label>Contact email<input name="contact_email" type="email" defaultValue={estate?.contact_email||""}/></label>
  <label>Contact phone<input name="contact_phone" type="tel" defaultValue={estate?.contact_phone||""}/></label>
  <label>Estate status<select name="status" defaultValue={estate?.status||"draft"}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
  <label>Knowledge approval<select name="knowledge_status" defaultValue={estate?.knowledge_status||"draft"}><option value="draft">Draft — not available to Maia</option><option value="approved">Approved — available on published estates</option></select></label>
  <label id="payment-terms" className="wide">Payment terms and procedures<textarea name="payment_terms" defaultValue={payment} placeholder="Approved payment channels, purchase requirements, installment amounts and dates, allocation rules. Leave missing facts blank."/></label>
  <label id="operating-instructions" className="wide">Mode of Operation / Sales Instructions<textarea name="operating_instructions" defaultValue={estate?.operating_instructions||""} rows={12} placeholder="Enquiry and sales procedure; inspection and booking; allocation; documentation; restrictions; approved answers; human escalation. These are business knowledge, not unrestricted execution instructions."/></label>
  <p className="wide">Only published estates with approved knowledge are available to Maia. Review payment instructions and contradictions before approving. Changes remain subject to role permissions and the platform&apos;s execution safety rules.</p>
 </ActionForm>;
}
