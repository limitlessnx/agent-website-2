insert into public.ai_model_catalog (provider, model_key, display_name, status, capabilities)
values
  ('openai', 'gpt-5.6-luna', 'GPT-5.6 Luna', 'active', '{"text":true,"reasoning":true,"tool_calling":true,"vision":true,"cost_profile":"high_volume"}'::jsonb),
  ('openai', 'gpt-5.6-terra', 'GPT-5.6 Terra', 'active', '{"text":true,"reasoning":true,"tool_calling":true,"vision":true,"cost_profile":"balanced"}'::jsonb),
  ('openai', 'gpt-5.6-sol', 'GPT-5.6 Sol', 'active', '{"text":true,"reasoning":true,"tool_calling":true,"vision":true,"cost_profile":"frontier"}'::jsonb)
on conflict (provider, model_key) do update set display_name=excluded.display_name, status='active', capabilities=excluded.capabilities, updated_at=now();
