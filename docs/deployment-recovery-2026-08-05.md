# Deployment recovery

A clean production build was triggered on 2026-08-05 after verifying that the earlier Vercel failures were caused by a TypeScript spread error in `lib/leo-control-plane.ts`. The issue had already been corrected by later commits; this commit exists only to force a fresh deployment from the current `main` branch.
