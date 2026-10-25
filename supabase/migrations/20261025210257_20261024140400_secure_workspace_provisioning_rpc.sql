-- Keep workspace provisioning behind the trusted server-side onboarding boundary.
-- The application invokes this RPC from server code using the service-role credential.
-- Anonymous/authenticated clients must not be able to provision an organization for an arbitrary auth user.
revoke all on function public.provision_client_workspace(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.provision_client_workspace(uuid, text, text, text, text) to service_role;

-- Defense in depth: this lower-level RPC is also server-only. The workspace function
-- calls it under the service-role context after the onboarding route validates identity.
revoke all on function public.provision_client_organization(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.provision_client_organization(uuid, text, text, text, text) to service_role;
