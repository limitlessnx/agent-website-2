export const HOTEL_SETUP_FIELDS = {
  business_name: {label:"Hotel name",max:180}, address:{label:"Address",max:500}, country:{label:"Country",max:80},
  business_email:{label:"Business email",max:240}, phone:{label:"Public phone",max:80}, timezone:{label:"Time zone",max:80}, currency:{label:"Default currency",max:3},
  check_in:{label:"Check-in from",max:5}, check_out:{label:"Check-out by",max:5}, cancellation_policy:{label:"Cancellation and refund policy",max:4000},
  inclusions:{label:"Breakfast and general inclusions",max:4000}, guest_rules:{label:"Guest rules",max:4000},
  escalation_name:{label:"Escalation contact name",max:180}, escalation_email:{label:"Escalation email",max:240}, escalation_phone:{label:"Escalation phone",max:80},
} as const;
export type HotelSetupValues=Record<keyof typeof HOTEL_SETUP_FIELDS,string>;
export type HotelSetupRecord={values:HotelSetupValues;revision:number;updated_at?:string};
export type HotelSetupData=HotelSetupRecord&{canManage:boolean;canViewIntegrations:boolean;canManageIntegrations:boolean;canViewTeam:boolean;checks:Array<{key:string;label:string;detail:string;state:"ready"|"attention"|"unverified";href?:string}>};
export function hotelSetupValues(input:unknown):HotelSetupValues {
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Enter valid hotel settings.");
  const result={} as HotelSetupValues;
  for(const [key,field]of Object.entries(HOTEL_SETUP_FIELDS)){
    const value=(input as Record<string,unknown>)[key];if(typeof value!=="string"||value.length>field.max)throw new Error(`${field.label} must contain up to ${field.max} characters.`);
    result[key as keyof HotelSetupValues]=value.trim();
  }
  if(!result.business_name)throw new Error("Enter your hotel name.");
  try{if(!result.timezone)throw Error();new Intl.DateTimeFormat("en",{timeZone:result.timezone}).format();}catch{throw new Error("Choose a valid IANA time zone, such as Africa/Lagos.");}
  result.currency=result.currency.toUpperCase();
  try{if(!/^[A-Z]{3}$/.test(result.currency))throw Error();new Intl.NumberFormat("en",{style:"currency",currency:result.currency}).format(0);}catch{throw new Error("Enter a three-letter currency code.");}
  for(const key of ["check_in","check_out"] as const)if(result[key]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(result[key]))throw new Error("Use a valid local check-in/out time.");
  for(const key of ["business_email","escalation_email"] as const)if(result[key]&&!/^\S+@\S+\.\S+$/.test(result[key]))throw new Error("Enter a valid email address.");
  return result;
}
export function guestHotelSettings(values:Partial<HotelSetupValues>){
  return Object.fromEntries(Object.keys(HOTEL_SETUP_FIELDS).filter(key=>!key.startsWith("escalation_")).map(key=>[key,values[key as keyof HotelSetupValues]||null]));
}
