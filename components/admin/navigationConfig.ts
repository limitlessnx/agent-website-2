export type AdminNavItem = {
  label:string
  href:string
  exact?:boolean
  external?:boolean
  meta?:string
}

export type AdminNavSection={label?:string;items:AdminNavItem[]}
export type AdminNavGroup={id:string;label:string;sections:AdminNavSection[]}

/**
 * Canonical Super Admin navigation.
 * Legacy routes remain available for compatibility, but are intentionally
 * removed from primary navigation unless they map to a platform operator job.
 */
export const ADMIN_NAV_GROUPS:AdminNavGroup[]=[
  {id:"overview",label:"Overview",sections:[{items:[{href:"/dashboard",label:"Overview",exact:true}]}]},
  {id:"clients",label:"Clients",sections:[{items:[
    {href:"/dashboard/clients",label:"Client Registry",exact:true},
    {href:"/dashboard/onboarding#new-client",label:"Onboard Client"},
    {href:"/dashboard/evaluations",label:"Evaluation Leads"},
  ]}]},
  {id:"systems",label:"Systems",sections:[{items:[
    {href:"/dashboard/workflows",label:"Systems & Workflows"},
    {href:"/dashboard/agents",label:"Agents"},
    {href:"/dashboard/integrations",label:"Integrations"},
  ]}]},
  {id:"operations",label:"Operations",sections:[{items:[
    {href:"/dashboard/control-center",label:"Operations Center"},
    {href:"/dashboard/conversations",label:"Conversations"},
    {href:"/dashboard/activity",label:"Activity"},
    {href:"/dashboard/health",label:"Health & Failures"},
    {href:"/dashboard/support",label:"Support & Leo"},
  ]}]},
  {id:"billing",label:"Billing",sections:[{items:[
    {href:"/dashboard/billing",label:"Billing & Credits"},
  ]}]},
  {id:"security",label:"Security",sections:[{items:[
    {href:"/dashboard/settings",label:"Security & Settings"},
  ]}]},
];

export const PUBLIC_SITE_NAV:AdminNavItem[]=[
  {href:"/",label:"Homepage",external:true},
  {href:"/services",label:"Services",external:true},
  {href:"/pricing",label:"Pricing",external:true},
  {href:"/industries",label:"Industries",external:true},
  {href:"/evaluation",label:"Evaluation",external:true},
];

export const CLIENT_ONBOARDING_NAV:AdminNavGroup={
  id:"client-onboarding",
  label:"Clients",
  sections:[
    {label:"Onboarding",items:[
      {href:"/dashboard/onboarding#new-client",label:"New Client"},
      {href:"/dashboard/onboarding#queue",label:"Onboarding Queue"},
      {href:"/dashboard/clients",label:"Client Registry",exact:true},
    ]},
    {label:"Client Workspaces",items:[]},
  ],
};

export function buildClientWorkspaceNav(tenants:Array<{organizationId:string;name:string;status:string}>):AdminNavSection{
  return{label:"Client Workspaces",items:tenants.map((tenant)=>({
    href:`/dashboard/clients?organizationId=${encodeURIComponent(tenant.organizationId)}`,
    label:tenant.name,
    meta:tenant.status.replaceAll("_"," "),
  }))};
}

export function isAdminNavItemActive(pathname:string,href:string,exact=false){
  const route=href.split("#")[0].split("?")[0];
  return exact?pathname===route:pathname===route||pathname.startsWith(`${route}/`);
}

export function getActiveAdminNavGroup(pathname:string){
  return ADMIN_NAV_GROUPS.find((group)=>group.sections.some((section)=>section.items.some((item)=>isAdminNavItemActive(pathname,item.href,item.exact))))?.id;
}
