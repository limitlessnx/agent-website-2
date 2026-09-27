update public.system_event_contracts
set required_payload_keys=array['reason']::text[],updated_at=now()
where event_type='handoff.requested';
