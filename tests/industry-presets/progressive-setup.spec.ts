import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

async function syntheticSession(page:Page,id:string){
  const payload=Buffer.from(JSON.stringify({userId:"qa-progress-"+id,email:"owner@example.test",organizationId:"10000000-0000-4000-8000-000000000001",organizationSlug:"qa-general",membershipId:"qa-membership",role:"owner",issuedAt:Date.parse("2026-11-17T08:00:00Z")})).toString("base64url");
  await page.context().addCookies([{name:"fluxknight_client_session",value:payload+"."+createHmac("sha256","synthetic-local-test-secret").update(payload).digest("base64url"),domain:"127.0.0.1",path:"/"}]);
  await page.context().route("**/*",route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!=="http://127.0.0.1:4800")return route.abort();
    if(!["GET","HEAD"].includes(req.method())&&!(url.pathname==="/api/client-onboarding"&&["PATCH","POST"].includes(req.method())))return route.abort();
    return route.continue();
  });
}
async function fits(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();}
test("owner can save, skip, resume and finish optional setup without activation",async({page},info)=>{
  await syntheticSession(page,"edit-"+info.project.name);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/portal/setup");await expect(page.getByRole("heading",{name:"Workspace setup",exact:true})).toBeVisible();
  await fits(page);
  await page.getByLabel("Business description",{exact:true}).fill("Synthetic business description");
  await page.getByRole("button",{name:"Save & continue",exact:true}).click();
  await expect(page.getByRole("heading",{name:"AI requirements",exact:true})).toBeVisible();
  await page.getByLabel("What should your AI handle?",{exact:true}).fill("Answer business questions");
  await page.getByLabel("Answer customer questions",{exact:true}).check();
  await page.getByRole("button",{name:"Save & exit",exact:true}).click();await expect(page).toHaveURL(/\/portal$/);
  await page.goto("/portal/setup");await expect(page.getByLabel("What should your AI handle?",{exact:true})).toHaveValue("Answer business questions");
  await page.getByRole("button",{name:"Save & continue",exact:true}).click();
  await expect(page.getByLabel("Frequently asked questions",{exact:true})).toHaveValue("Existing saved FAQ");
  await page.getByLabel("Pricing",{exact:true}).fill("Synthetic pricing");
  await page.getByRole("button",{name:"Save & continue",exact:true}).click();
  await expect(page.getByLabel("Preferred WhatsApp number",{exact:true})).toHaveValue("synthetic-number");
  await page.getByRole("button",{name:"Skip for now",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Human handover and review",exact:true})).toBeVisible();
  await fits(page);
  await page.getByRole("button",{name:"Save & finish for now",exact:true}).click();await expect(page).toHaveURL(/\/portal$/);
  await page.goto("/portal/settings");await page.getByRole("link",{name:"Edit or resume business setup",exact:true}).click();
  await page.getByRole("button",{name:/3\. Business knowledge/}).click();
  await expect(page.getByLabel("Frequently asked questions",{exact:true})).toHaveValue("Existing saved FAQ");
  await expect(page.getByLabel("Pricing",{exact:true})).toHaveValue("Synthetic pricing");
  await page.getByRole("button",{name:/4\. Channels and tools/}).click();
  await expect(page.getByLabel("Preferred WhatsApp number",{exact:true})).toHaveValue("synthetic-number");
  await fits(page);expect(errors).toEqual([]);
});
test("owner can skip every optional section and return to dashboard",async({page},info)=>{
  await syntheticSession(page,"skip-"+info.project.name);await page.goto("/portal/setup");
  for(let i=0;i<5;i++){await expect(page.getByText(new RegExp("Step "+(i+1)+" of 5"))).toBeVisible();await fits(page);await page.getByRole("button",{name:"Skip for now",exact:true}).click();}
  await expect(page).toHaveURL(/\/portal$/);await page.goto("/portal/setup");
  await page.getByRole("button",{name:/3\. Business knowledge/}).click();await expect(page.getByLabel("Frequently asked questions",{exact:true})).toHaveValue("Existing saved FAQ");
});
