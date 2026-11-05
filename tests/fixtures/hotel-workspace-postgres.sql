-- Only for the disposable, localhost hotel_test database used by CI.
create role anon;
create role authenticated;
create role service_role;
create table public.organizations(id uuid primary key);
create table public.crm_customers(id uuid primary key,organization_id uuid not null references public.organizations(id),unique(organization_id,id));
create function public.has_organization_permission(uuid,text) returns boolean language sql stable as $$ select false $$;
