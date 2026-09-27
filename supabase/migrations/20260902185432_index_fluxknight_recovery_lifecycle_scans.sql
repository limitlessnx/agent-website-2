create index if not exists payment_attempts_pending_created_idx on public.payment_attempts (created_at) where provider='paystack' and status='pending';
create index if not exists client_onboarding_incomplete_updated_idx on public.client_onboarding_profiles (updated_at) where status='in_progress' and completed_at is null;
