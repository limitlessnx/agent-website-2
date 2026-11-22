import {isRealtySocialBrand, REALTY_SOCIAL_ORGANIZATION} from "@/lib/social-real-estate-policy";

/** Serializable approved settings shared by the web and existing media workers. */
export type SocialMediaIdentity = {
  approved: true;
  background: string;
  surface: string;
  accent: string;
  text: string;
  muted: string;
  font: "geist";
  footer: string;
  website: string;
  logoAssetId: string;
};

function luminance(hex:string){
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}

export function validateSocialMediaIdentity(value:unknown):SocialMediaIdentity{
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Approve Limitless Realty's visual identity first.");
  const raw=value as Record<string,unknown>;
  if(raw.approved!==true)throw Error("Approve Limitless Realty's visual identity first.");
  const color=(key:string)=>{const v=String(raw[key]||"");if(!/^#[0-9a-f]{6}$/i.test(v))throw Error(`Choose a six-digit ${key} color.`);return v;};
  const background=color("background"),surface=color("surface"),accent=color("accent"),text=color("text"),muted=color("muted");
  if([background,surface].some(bg=>contrast(text,bg)<4.5||contrast(muted,bg)<4.5||contrast(accent,bg)<4.5))throw Error("Brand colors need stronger text and accent contrast.");
  const font=String(raw.font||"");if(!["geist"].includes(font))throw Error("Choose a supported brand font.");
  const footer=String(raw.footer||"").trim();if(!footer||footer.length>110)throw Error("Enter an approved footer of up to 110 characters.");
  let website=String(raw.website||"").trim();
  if(website.length>180)throw Error("Use a short public organization website URL.");
  if(website){const u=new URL(website);if(u.protocol!=="https:"||u.username||u.password||!u.hostname.includes(".")||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)||u.hostname.endsWith(".local"))throw Error("Use the organization's public HTTPS website, or leave it blank.");website=u.href;}
  const logoAssetId=String(raw.logoAssetId||"");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(logoAssetId))throw Error("Register and approve this organization's primary logo first.");
  if(/fluxknight|talk\s+to\s+leo/i.test(`${footer} ${website}`))throw Error("Limitless Realty's identity must not use Fluxknight's promotion or website.");
  return{approved:true,background,surface,accent,text,muted,font:font as SocialMediaIdentity["font"],footer,website,logoAssetId};
}

export function socialMediaIdentity(brand:{organization_id:string;metadata?:Record<string,unknown>;visual_rules?:Record<string,unknown>}):SocialMediaIdentity|undefined{
  if(brand.organization_id!==REALTY_SOCIAL_ORGANIZATION)return undefined;
  if(!isRealtySocialBrand({organization_id:brand.organization_id,metadata:brand.metadata||{}}))throw Error("Limitless Realty's content strategy is not configured.");
  return validateSocialMediaIdentity(brand.visual_rules?.identity);
}
