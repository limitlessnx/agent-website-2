import {test,expect} from "@playwright/test";
import {createHmac} from "node:crypto";
import {mkdir} from "node:fs/promises";
const before=process.env.TEAM_CAPTURE_BEFORE==="1";
const longEmail="manager.with.a.very.long.name.for.accessibility.and.wrapping@example.test";
async function setup(page:import("@playwright/test").Page,manager=false,industryIndex=0){
 const payload=Buffer.from(JSON.stringify({userId:manager?"qa-manager":"qa-owner",email:manager?longEmail:"owner@example.test",organizationId:`10000000-0000-4000-8000-00000000000${industryIndex+1}`,organizationSlug:`qa-${["general","real-estate","photography-studio","hotels"][industryIndex]}`,membershipId:"qa-membership",role:manager?"manager":"owner",issuedAt:Date.parse("2026-11-17T08:00:00Z")})).toString("base64url");
 await page.context().addCookies([{name:"fluxknight_client_session",value:payload+"."+createHmac("sha256","synthetic-local-test-secret").update(payload).digest("base64url"),domain:"127.0.0.1",path:"/"}]);
 const state={members:[{id:"owner",user_id:"qa-owner",email:"owner@example.test",role:"owner",status:"active",created_at:"2026-11-01"},{id:"manager",user_id:"qa-manager",email:longEmail,role:"manager",status:"active",created_at:"2026-11-01"}],requests:[{id:"request",email:longEmail,status:"pending",created_at:"2026-11-01"}],invitations:[{id:"invitation",email:"pending.invitation.with.an.extremely.long.email.address@example.test",status:"pending",expires_at:"2026-11-18T08:00:00Z"}],summary:{planName:"Configured subscription with a long organization-specific plan label",subscriptionStatus:"active",maximumSeats:4,activeSeats:2,suspendedSeats:0,reservedInvitations:1,availableSeats:1}};
 const writes:Array<{url:string;body:Record<string,string>}>=[];
 await page.context().route("**/*",async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!=="http://127.0.0.1:4600")return route.abort();
   if(url.pathname==="/api/portal/team/access-requests"){
     if(req.method()==="GET")return route.fulfill({json:{...state,requests:manager?[]:state.requests}});
     const body=req.postDataJSON();writes.push({url:url.pathname,body});
     if(body.action==="approve"||body.action==="reject")state.requests=[];
     if(body.action==="remove")state.members[1].status="removed";
     if(body.action==="suspend")state.members[1].status="suspended";
     if(body.action==="reactivate")state.members[1].status="active";
     return route.fulfill({json:{ok:true}});
   }
   if(url.pathname==="/api/organization/invitations"){
     if(req.method()==="GET")return route.fulfill({json:{invitations:state.invitations}});
     const body=req.postDataJSON();writes.push({url:url.pathname,body});
     if(req.method()==="POST"){state.invitations.push({id:"new",email:body.email,status:"pending",expires_at:"2026-11-18T08:00:00Z"});state.summary.availableSeats=0;state.summary.reservedInvitations=2;return route.fulfill({json:{ok:true,invitation:{invitation_path:"/join?invitation=synthetic-review-only-token"}}});}
     state.invitations=state.invitations.filter(i=>i.id!==body.invitation_id);state.summary.availableSeats=1;return route.fulfill({json:{ok:true}});
   }
   if(!["GET","HEAD"].includes(req.method()))return route.abort();
   return route.continue();
 });
 return {state,writes};
}
async function screenshot(page:import("@playwright/test").Page,name:string,width:number){
 const dir=`test-results/team-evidence/${before?"before":"after"}`;await mkdir(dir,{recursive:true});
 await page.screenshot({path:`${dir}/${name}-${width}.png`,fullPage:true,animations:"disabled",style:"nextjs-portal{display:none!important}"});
}
async function fits(page:import("@playwright/test").Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();}
test("owner invitation, approval, revocation and membership controls",async({page},info)=>{
 const {writes}=await setup(page);await page.goto("/portal/team");await expect(page.getByRole("heading",{name:"Invite a manager"})).toBeVisible();await expect(page.getByRole("button",{name:"Revoke",exact:true})).toBeVisible();
 if(before){await screenshot(page,"owner",info.project.use.viewport!.width);return;}
 await expect(page.getByText("Maximum team seats",{exact:true})).toBeVisible();await fits(page);await screenshot(page,"owner",info.project.use.viewport!.width);
 await page.getByLabel("Manager email").fill("new.manager@example.test");await page.getByRole("button",{name:"Create manager invitation"}).click();await expect(page.getByText("Secure invitation link")).toBeVisible();expect(writes[0].body).toEqual({email:"new.manager@example.test",role:"manager"});await expect(page.getByRole("button",{name:"Create manager invitation"})).toBeDisabled();
 await page.getByRole("button",{name:"Revoke",exact:true}).last().click();await expect(page.getByRole("button",{name:"Create manager invitation"})).toBeEnabled();
 await page.getByRole("button",{name:"Approve",exact:true}).click();await expect(page.getByText("No pending manager requests.")).toBeVisible();
 page.once("dialog",dialog=>dialog.dismiss());await page.getByRole("button",{name:"Remove access",exact:true}).click();expect(writes.some(w=>w.body.action==="remove")).toBeFalsy();
 page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Suspend access"}).click();await expect(page.getByRole("button",{name:"Reactivate access"})).toBeVisible();
 await page.getByRole("button",{name:"Reactivate access"}).click();await expect(page.getByRole("button",{name:"Suspend access"})).toBeVisible();
 page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Remove access",exact:true}).click();await expect(page.getByText(/manager · removed/)).toBeVisible();await fits(page);
});
test("manager sees roster and capacity without owner controls",async({page},info)=>{
 const {writes}=await setup(page,true);await page.goto("/portal/team");await expect(page.getByText(longEmail,{exact:true})).toBeVisible();
 if(!before){await expect(page.getByRole("heading",{name:"Team members"})).toBeVisible();await expect(page.getByText("Available seats",{exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Invite a manager"})).toHaveCount(0);await expect(page.getByRole("button",{name:/Approve|Revoke|Remove access|Suspend access|Create manager/})).toHaveCount(0);await fits(page);expect(writes).toHaveLength(0);}
 await screenshot(page,"manager",info.project.use.viewport!.width);
});
test("loading, request failure and recovery are distinct from empty data",async({page},info)=>{
 test.skip(before,"Before captures retain the original defects; new states are tested after implementation.");await setup(page);
 await page.route("**/api/portal/team/access-requests",async route=>{await new Promise(r=>setTimeout(r,300));return route.fulfill({status:503,json:{error:"Team connection unavailable."}});});
 await page.goto("/portal/team");await expect(page.getByText("Loading team allowance…")).toBeVisible();await expect(page.locator(".portal-team-access-stack [role=alert]")).toContainText("Team connection unavailable.");await expect(page.getByText("No team members found.")).toHaveCount(0);await expect(page.getByRole("button",{name:"Create manager invitation"})).toBeDisabled();await screenshot(page,"error",info.project.use.viewport!.width);
 await page.unroute("**/api/portal/team/access-requests");await page.getByRole("button",{name:"Retry team access"}).click();await expect(page.getByText("Maximum team seats",{exact:true})).toBeVisible();await fits(page);
 await page.emulateMedia({reducedMotion:"reduce"});await page.evaluate(()=>document.documentElement.style.zoom="1.25");await fits(page);
});

for (const [index,industry] of ["general","real-estate","photography-studio","hotels"].entries()) {
 test(`manager operational overview ${industry}`,async({page},info)=>{
  test.skip(before,"Industry dashboards are protected by existing baseline comparisons.");await setup(page,true,index);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const response=await page.goto("/portal",{waitUntil:"networkidle"});expect(response?.status()).toBe(200);expect(new URL(page.url()).pathname).toBe("/portal");await expect(page.locator(".portal-main")).toBeVisible();
  if(industry==="hotels"){const skip=page.getByRole("button",{name:"Skip tour",exact:true});if(await skip.isVisible())await skip.click();await expect(page.getByRole("heading",{name:"The hotel overview could not be loaded"})).toHaveCount(0);}
  await fits(page);await screenshot(page,`manager-${industry}`,info.project.use.viewport!.width);expect(errors).toEqual([]);
 });
}
