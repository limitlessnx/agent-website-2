-- Xposure-specific handoff continuity: Maia remains active while staff are notified.
-- Other tenants retain the canonical paused/human-takeover behavior.
create or replace function public.create_human_handoff(
 p_organization_id uuid,p_customer_id uuid,p_conversation_id uuid,p_reason text,
 p_category text default 'general',p_priority text default 'normal',
 p_source_system_id uuid default null,p_source_agent_id uuid default null,
 p_correlation_id uuid default null,p_sla_due_at timestamptz default null,
 p_created_by_type text default 'system',p_created_by_id text default null,
 p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_xposure boolean;
begin
 if not exists(select 1 from public.crm_customers where organization_id=p_organization_id and id=p_customer_id)
 then raise exception 'Customer does not belong to organization'; end if;
 if not exists(select 1 from public.crm_conversations where organization_id=p_organization_id and id=p_conversation_id and customer_id=p_customer_id)
 then raise exception 'Conversation does not belong to customer organization'; end if;
 select exists(select 1 from public.organizations where id=p_organization_id and slug='xposure') into v_xposure;
 insert into public.human_handoffs(organization_id,customer_id,conversation_id,source_system_id,source_agent_id,correlation_id,reason,category,priority,status,sla_due_at,created_by_type,created_by_id,metadata)
 values(p_organization_id,p_customer_id,p_conversation_id,p_source_system_id,p_source_agent_id,p_correlation_id,trim(p_reason),coalesce(nullif(trim(p_category),''),'general'),p_priority,'open',p_sla_due_at,p_created_by_type,p_created_by_id,coalesce(p_metadata,'{}'::jsonb))
 returning id into v_id;
 update public.crm_conversations
 set status=case when v_xposure then 'ai_active' else 'waiting' end,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('active_handoff_id',v_id,'ai_response_mode',case when v_xposure then 'active' else 'paused_for_handoff' end),updated_at=now()
 where organization_id=p_organization_id and id=p_conversation_id;
 perform public.add_customer_timeline_event(p_organization_id,p_customer_id,'handoff.requested','Human handoff requested',trim(p_reason),'internal',p_conversation_id,'human_handoffs',v_id,p_correlation_id,p_created_by_type,p_created_by_id,jsonb_build_object('priority',p_priority,'category',p_category),now());
 return v_id;
end $$;
revoke all on function public.create_human_handoff(uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_human_handoff(uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,timestamptz,text,text,jsonb) to service_role;

create or replace function public.claim_human_handoff(p_handoff_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_handoff public.human_handoffs%rowtype; v_membership uuid; v_xposure boolean;
begin
 select * into v_handoff from public.human_handoffs where id=p_handoff_id for update;
 if not found then raise exception 'Handoff not found'; end if;
 if not public.has_organization_permission(v_handoff.organization_id,'handoffs.view') and not public.has_organization_permission(v_handoff.organization_id,'handoffs.manage')
 then raise exception 'Not authorized to claim handoff'; end if;
 select id into v_membership from public.organization_memberships where organization_id=v_handoff.organization_id and user_id=auth.uid() and status='active' limit 1;
 if v_membership is null then raise exception 'Active membership required'; end if;
 if v_handoff.assigned_membership_id is not null and v_handoff.assigned_membership_id<>v_membership and not public.has_organization_permission(v_handoff.organization_id,'handoffs.manage')
 then raise exception 'Handoff is assigned to another team member'; end if;
 select exists(select 1 from public.organizations where id=v_handoff.organization_id and slug='xposure') into v_xposure;
 update public.human_handoffs set assigned_membership_id=coalesce(assigned_membership_id,v_membership),claimed_by_membership_id=v_membership,status='in_progress',claimed_at=coalesce(claimed_at,now()),updated_at=now() where id=p_handoff_id;
 update public.crm_conversations set status=case when v_xposure then 'ai_active' else 'human_active' end,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('active_handoff_id',p_handoff_id,'ai_response_mode',case when v_xposure then 'active' else 'human_takeover' end),updated_at=now()
 where organization_id=v_handoff.organization_id and id=v_handoff.conversation_id;
 return jsonb_build_object('handoff_id',p_handoff_id,'status','in_progress','membership_id',v_membership);
end $$;
revoke all on function public.claim_human_handoff(uuid) from public,anon,authenticated;
grant execute on function public.claim_human_handoff(uuid) to authenticated,service_role;
