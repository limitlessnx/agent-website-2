# Stage 10 authentication foundation

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The application also supports `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a legacy fallback.

Apply the variables to Production, Preview, and Development, then redeploy.

## Current Supabase project

Project name: `FLUXNIT`

The application must point to the active FLUXNIT project URL and one active publishable key.

## Verification

1. Open `/login` on the preview deployment.
2. Submit a valid Supabase Auth email and password.
3. Confirm redirect to `/dashboard`.
4. Confirm an auth login event appears in Supabase logs.
5. Confirm no raw provider or network errors are shown to the user.
