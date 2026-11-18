import {test,expect,type Page} from "@playwright/test";
import {createHmac} from "node:crypto";
import {mkdir} from "node:fs/promises";
const before=process.env.PRESET_CAPTURE_BEFORE==="1";
const industries=["general","sales-companies","professional-services","service-businesses","auto-shops","beauty-salons","clinics","gyms","ecommerce","restaurants"];
const family=["General business","Sales & client services","Sales & client services","Service requests & jobs","Service requests & jobs","Appointment services","Appointment services","Memberships & classes","Products & customer support","Reservations & menu enquiries"];
async function session(page:Page,index=0,mode="owner"){
 const orgId=`10000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`;
 const payload=Buffer.from(JSON.stringify({userId:`qa-${mode}`,email:"owner@example.test",organizationId:orgId,organizationSlug:`qa-${industries[index]}`,membershipId:"qa-membership",role:"owner",issuedAt:Date.parse("2026-11-17T08:00:00Z")})).toString("base64url");
 await page.context().addCookies([{name:"fluxknight_client_session",value:`${payload}.${createHmac("sha256","synthetic-local-test-secret").update(payload).digest("base64url")}`,domain:"127.0.0.1",path:"/"}]);
 const writes:string[]=[];
 await page.context().route("**/*",route=>{const request=route.request(),url=new URL(request.url());if(url.origin!=="http://127.0.0.1:4800")return route.abort();if(!["GET","HEAD"].includes(request.method())){writes.push(url.pathname);return route.abort();}return route.continue();});
 return writes;
}
async function fits(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();}
async function capture(page:Page,name:string,width:number){const dir=`test-results/preset-evidence/${before?"before":"after"}`;await mkdir(dir,{recursive:true});await page.screenshot({path:`${dir}/${name}-${width}.png`,fullPage:true,animations:"disabled",style:"nextjs-portal{display:none!important}"});if(name==="general"&&width===1440)await page.screenshot({path:`${dir}/general-1440-viewport.png`,animations:"disabled",style:"nextjs-portal{display:none!important}"});}
for(const [index,industry] of industries.entries())test(`workspace preset ${industry}`,async({page},info)=>{
 const writes=await session(page,index);const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));const response=await page.goto("/portal",{waitUntil:"networkidle"});expect(response?.status()).toBe(200);expect(new URL(page.url()).pathname).toBe("/portal");await expect(page.getByRole("heading",{name:/Welcome back/})).toBeVisible();
 if(!before){
  const panel=page.getByRole("region",{name:/workspace modules/});await expect(panel).toBeVisible();await expect(panel).toContainText(family[index]);await expect(panel.locator('[data-workspace-module="customers"]')).toBeVisible();
  await panel.locator("summary").click();await expect(panel.getByRole("heading",{name:"Information to confirm"})).toBeVisible();await expect(panel.locator("ol li")).toHaveCount(4);
  const planDetails=page.getByText("Plan access details",{exact:true});await planDetails.click();await expect(page.getByRole("heading",{name:"Plan access",exact:true})).toBeVisible();await planDetails.click();await expect(page.getByRole("heading",{name:"Plan access",exact:true})).toBeHidden();
  if(industry==="ecommerce")await expect(panel.locator('[data-workspace-module="appointments"]')).toHaveCount(0);
  if(industry==="clinics")await expect(panel).toContainText("Clinical records and medical decisions remain in your approved clinical system.");
  await expect(panel.locator('[data-workspace-module="followups"]')).toContainText("Plan required");
  const link=panel.getByRole("link",{name:"Open CRM",exact:true});await link.scrollIntoViewIfNeeded();await expect(link).toBeInViewport();const box=await link.boundingBox();expect(box?.height).toBeGreaterThanOrEqual(44);await page.evaluate(()=>scrollTo(0,0));await fits(page);
 }
 await capture(page,industry,info.project.use.viewport!.width);expect(writes).toEqual([]);expect(errors).toEqual([]);
});
test("role restrictions and missing installations cannot become usable modules",async({page},info)=>{
 test.skip(before,"New access-state checks follow implementation.");await session(page,0,"viewer");await page.goto("/portal");const panel=page.getByRole("region",{name:/workspace modules/});await expect(panel.locator("[data-workspace-module]")).toHaveCount(1);await expect(panel.getByRole("link",{name:"Open CRM"})).toBeVisible();await expect(panel.getByRole("link",{name:/Review plan|Review systems|View team|Open calendar/})).toHaveCount(0);await fits(page);await capture(page,"restricted",info.project.use.viewport!.width);
});
for(const mode of ["missing","paused","system-outage"])test(`appointment configuration ${mode}`,async({page},info)=>{
 test.skip(before,"New configuration states follow implementation.");await session(page,0,mode);await page.goto("/portal");const appointmentCard=page.locator('[data-workspace-module="appointments"]');await expect(appointmentCard).toContainText(mode==="system-outage"?"Status unavailable":"Setup required");await expect(appointmentCard.getByRole("link",{name:"Open calendar"})).toHaveCount(0);await fits(page);await capture(page,mode,info.project.use.viewport!.width);
});
test("failed operational reads remain unavailable instead of healthy or empty",async({page},info)=>{
 test.skip(before,"New failure-state checks follow implementation.");await session(page,0,"outage");await page.goto("/portal");await expect(page.getByRole("heading",{name:"Some workspace information is unavailable"})).toBeVisible();await expect(page.getByText("Recent activity is unavailable. Reload to try again.")).toBeVisible();await expect(page.getByText("No recent business-system activity has been recorded yet.")).toHaveCount(0);await expect(page.getByText("Everything is running normally")).toHaveCount(0);await expect(page.locator("body")).not.toContainText("provider-secret");await fits(page);await capture(page,"outage",info.project.use.viewport!.width);
});
test("unknown industry falls back safely; mobile navigation, reduced motion and text scaling work",async({page},info)=>{
 test.skip(before,"New general fallback checks follow implementation.");await session(page,0,"unknown");await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/portal");await expect(page.getByRole("region",{name:"Business workspace modules"})).toContainText("General business");await page.evaluate(()=>document.documentElement.style.zoom="1.25");await fits(page);
 const open=page.getByRole("button",{name:"Open client dashboard navigation"});if(await open.isVisible()){await open.click();await expect(page.getByRole("dialog",{name:"Workspace navigation"})).toBeVisible();await page.keyboard.press("Escape");await expect(page.getByRole("dialog",{name:"Workspace navigation"})).toHaveCount(0);}
 await capture(page,"fallback",info.project.use.viewport!.width);
});
test("managers cannot start a trial from the general workspace",async({page},info)=>{
 test.skip(before,"Owner-only trial UI follows the Phase 4 access model.");const writes=await session(page,0,"free-manager");await page.goto("/portal");await expect(page.getByText("Ask your organization owner to review activation and plan access.")).toBeVisible();await expect(page.getByRole("button",{name:"Start 14-day free trial"})).toHaveCount(0);expect(writes).toEqual([]);await fits(page);await capture(page,"manager-activation",info.project.use.viewport!.width);
});
