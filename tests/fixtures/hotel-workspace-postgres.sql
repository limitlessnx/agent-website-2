-- Only for the disposable, localhost hotel_test database used by CI.
create role anon;
create role authenticated;
create role service_role;
create table public.organizations(id uuid primary key);
create table public.crm_customers(id uuid primary key,organization_id uuid not null references public.organizations(id),full_name text,phone text,email text,unique(organization_id,id));
create function public.has_organization_permission(uuid,text) returns boolean language sql stable as $$ select false $$;

create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text);

create table client_onboarding_profiles(organization_id uuid,business_name text,business_email text,phone text,country text,timezone text,human_contact_name text,human_contact_email text);
