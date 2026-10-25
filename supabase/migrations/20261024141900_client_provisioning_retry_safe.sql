-- Keep existing membership/organization/agent setup, but make retries recover the
-- exact prior result and serialize concurrent attempts by user and requested slug.
CREATE OR REPLACE FUNCTION public.provision_client_organization(
  p_user_id uuid,
  p_organization_name text,
  p_organization_slug text DEFAULT NULL::text,
  p_template_slug text DEFAULT NULL::text,
  p_agent_family_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_org_id uuid;
  v_branch_id uuid;
  v_role_id uuid;
  v_membership_id uuid;
  v_template_id uuid;
  v_family_id uuid;
  v_project_id uuid;
  v_org_slug text;
  v_requested_slug text;
  v_family_name text;
  v_template_slug text;
  v_request jsonb;
  v_existing_count integer;
  v_existing_name text;
  v_existing_slug text;
  v_existing_audit jsonb;
  v_existing_family_id uuid;
  v_existing_project_id uuid;
  v_legacy_template_matches boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Supabase Auth user does not exist';
  END IF;

  IF NULLIF(TRIM(p_organization_name), '') IS NULL THEN
    RAISE EXCEPTION 'organization_name is required';
  END IF;

  v_requested_slug := public.slugify_identifier(
    COALESCE(NULLIF(TRIM(p_organization_slug), ''), p_organization_name)
  );
  IF v_requested_slug = '' THEN
    RAISE EXCEPTION 'A valid organization slug could not be generated';
  END IF;

  v_template_slug := NULLIF(TRIM(p_template_slug), '');
  v_family_name := CASE
    WHEN v_template_slug IS NULL THEN NULL
    ELSE COALESCE(NULLIF(TRIM(p_agent_family_name), ''), TRIM(p_organization_name))
  END;
  v_request := jsonb_build_object(
    'organization_name', TRIM(p_organization_name),
    'requested_slug', v_requested_slug,
    'template_slug', v_template_slug,
    'agent_family_name', v_family_name
  );

  -- A user retry and a different user claiming the same slug must serialize.
  PERFORM pg_advisory_xact_lock(hashtextextended('client-workspace-user:' || p_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('client-workspace-slug:' || v_requested_slug, 0));

  SELECT COUNT(*) INTO v_existing_count
  FROM public.organization_memberships
  WHERE user_id = p_user_id
    AND status IN ('active', 'invited');

  IF v_existing_count > 1 THEN
    RAISE EXCEPTION 'User has multiple organization memberships; support review is required';
  ELSIF v_existing_count = 1 THEN
    SELECT o.id, o.name, o.slug, m.branch_id, m.id
    INTO v_org_id, v_existing_name, v_existing_slug, v_branch_id, v_membership_id
    FROM public.organization_memberships m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.user_id = p_user_id
      AND m.status = 'active'
    ORDER BY m.created_at ASC
    LIMIT 1;

    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'User already has an active organization membership';
    END IF;

    SELECT mr.role_id INTO v_role_id
    FROM public.membership_roles mr
    JOIN public.roles r ON r.id = mr.role_id
    WHERE mr.membership_id = v_membership_id
      AND r.organization_id = v_org_id
      AND r.slug = 'owner'
    ORDER BY mr.role_id
    LIMIT 1;

    SELECT a.metadata INTO v_existing_audit
    FROM public.audit_logs a
    WHERE a.organization_id = v_org_id
      AND a.actor_user_id = p_user_id
      AND a.action = 'organization.provisioned'
      AND a.resource_type = 'organization'
      AND a.resource_id = v_org_id::text
    ORDER BY a.created_at DESC
    LIMIT 1;

    IF v_existing_audit->'provision_request' = v_request AND v_role_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'organization_id', v_org_id,
        'organization_slug', v_existing_slug,
        'branch_id', v_branch_id,
        'membership_id', v_membership_id,
        'role_id', v_role_id,
        'agent_family_id', NULLIF(v_existing_audit->>'agent_family_id', '')::uuid,
        'project_id', NULLIF(v_existing_audit->>'project_id', '')::uuid
      );
    END IF;

    -- Existing workspaces created before this migration have no request fingerprint.
    -- Recover only an exact organization/slug/template match with its original audit record.
    v_existing_family_id := NULLIF(v_existing_audit->>'agent_family_id', '')::uuid;
    v_existing_project_id := NULLIF(v_existing_audit->>'project_id', '')::uuid;
    IF v_template_slug IS NULL THEN
      v_legacy_template_matches := v_existing_family_id IS NULL AND v_existing_project_id IS NULL;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.agent_families f
        JOIN public.agent_templates t ON t.id = f.template_id
        JOIN public.projects p ON p.agent_family_id = f.id
        WHERE f.id = v_existing_family_id
          AND f.organization_id = v_org_id
          AND f.branch_id = v_branch_id
          AND f.name = v_family_name
          AND t.slug = v_template_slug
          AND p.id = v_existing_project_id
          AND p.organization_id = v_org_id
          AND p.branch_id = v_branch_id
      ) INTO v_legacy_template_matches;
    END IF;

    IF v_role_id IS NOT NULL
      AND v_existing_audit IS NOT NULL
      AND v_existing_name = TRIM(p_organization_name)
      AND v_existing_slug = v_existing_audit->>'organization_slug'
      AND v_existing_audit->>'membership_id' = v_membership_id::text
      AND (v_existing_slug = v_requested_slug OR v_existing_slug ~ ('^' || v_requested_slug || '-[0-9a-f]{6}$'))
      AND v_legacy_template_matches
    THEN
      RETURN jsonb_build_object(
        'organization_id', v_org_id,
        'organization_slug', v_existing_slug,
        'branch_id', v_branch_id,
        'membership_id', v_membership_id,
        'role_id', v_role_id,
        'agent_family_id', v_existing_family_id,
        'project_id', v_existing_project_id
      );
    END IF;

    RAISE EXCEPTION 'User already has an active organization membership';
  END IF;

  v_org_slug := v_requested_slug;
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_org_slug) THEN
    v_org_slug := v_requested_slug || '-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6);
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_org_slug) LOOP
      v_org_slug := v_requested_slug || '-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6);
    END LOOP;
  END IF;

  IF v_template_slug IS NOT NULL THEN
    SELECT id INTO v_template_id
    FROM public.agent_templates
    WHERE slug = v_template_slug
      AND status = 'published'
    LIMIT 1;

    IF v_template_id IS NULL THEN
      RAISE EXCEPTION 'Published agent template not found: %', p_template_slug;
    END IF;
  END IF;

  INSERT INTO public.organizations (name, slug, status)
  VALUES (TRIM(p_organization_name), v_org_slug, 'active')
  RETURNING id INTO v_org_id;

  INSERT INTO public.branches (organization_id, name, slug, status)
  VALUES (v_org_id, 'Main Branch', 'main', 'active')
  RETURNING id INTO v_branch_id;

  INSERT INTO public.roles (organization_id, name, slug, description, is_system)
  VALUES (v_org_id, 'Owner', 'owner', 'Full organization owner access.', false)
  RETURNING id INTO v_role_id;

  INSERT INTO public.organization_memberships (organization_id, branch_id, user_id, status)
  VALUES (v_org_id, v_branch_id, p_user_id, 'active')
  RETURNING id INTO v_membership_id;

  INSERT INTO public.membership_roles (membership_id, role_id)
  VALUES (v_membership_id, v_role_id);

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  ON CONFLICT DO NOTHING;

  IF v_template_slug IS NOT NULL THEN
    INSERT INTO public.agent_families (
      organization_id, template_id, branch_id, name, slug, description, status
    ) VALUES (
      v_org_id, v_template_id, v_branch_id, v_family_name,
      public.slugify_identifier(v_family_name),
      'Starter agent family provisioned during client onboarding.',
      'draft'
    ) RETURNING id INTO v_family_id;

    INSERT INTO public.projects (
      organization_id, agent_family_id, branch_id, name, slug, description, status
    ) VALUES (
      v_org_id, v_family_id, v_branch_id, 'Starter Project', 'starter',
      'Initial project created during client onboarding.', 'draft'
    ) RETURNING id INTO v_project_id;
  END IF;

  INSERT INTO public.audit_logs (
    organization_id, branch_id, actor_user_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_org_id, v_branch_id, p_user_id, 'organization.provisioned', 'organization', v_org_id::text,
    jsonb_build_object(
      'organization_slug', v_org_slug,
      'membership_id', v_membership_id,
      'role_id', v_role_id,
      'agent_family_id', v_family_id,
      'project_id', v_project_id,
      'provision_request', v_request
    )
  );

  RETURN jsonb_build_object(
    'organization_id', v_org_id,
    'organization_slug', v_org_slug,
    'branch_id', v_branch_id,
    'membership_id', v_membership_id,
    'role_id', v_role_id,
    'agent_family_id', v_family_id,
    'project_id', v_project_id
  );
END;
$function$;
