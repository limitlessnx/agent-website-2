-- Both RPCs accept a caller-supplied user UUID and run with SECURITY DEFINER.
-- Application calls use supabaseServerRequest with a server-only service-role key;
-- browser roles must not be able to invoke tenant provisioning directly.
REVOKE ALL ON FUNCTION public.provision_client_workspace(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_client_workspace(uuid, text, text, text, text) TO service_role;

-- Keep trial provisioning server-only as well, including after future ACL/default changes.
REVOKE ALL ON FUNCTION public.provision_trial_client_organization(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_trial_client_organization(uuid, text, text, text, text) TO service_role;
