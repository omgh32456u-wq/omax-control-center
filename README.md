# Omax Control Center

A responsive administration dashboard for Omax activation codes, subscriptions, users and audit events.

## Stack
- React + TypeScript + Vite
- Capacitor Android shell
- Supabase Auth, Postgres, RLS and Edge Functions
- Vercel for the web dashboard
- GitHub Actions for web validation and Android APK artifacts

## Supabase setup

Project ref: `biwcwwxsauineaowreot`

1. Apply the migration in `supabase/migrations/` to the existing project. It adds code labels/notes and Standard/Premium tier metadata while preserving existing code hashes and subscription rows.
2. Deploy the `admin-api` Edge Function:
   ```sh
   supabase login
   supabase link --project-ref biwcwwxsauineaowreot
   supabase db push
   supabase functions deploy admin-api
   ```
3. Confirm the Edge Function has the standard Supabase environment variables, especially `SUPABASE_SERVICE_ROLE_KEY`. This key belongs only in the Edge Function runtime and must never be added to Vite, GitHub build variables, Vercel client variables, or the APK.
4. Ensure the intended administrator account exists in `public.omax_admins`. The dashboard checks `omax_is_admin()` before granting access.

The Edge Function validates the signed-in user's JWT and calls `omax_is_admin()` before every privileged operation. It uses the service-role key only server-side. Activation code plaintext is returned only in the create response; only SHA-256 hashes are stored.

## GitHub Actions

The Android workflow already uses the project's public Supabase URL and publishable key at build time. These values are intended to be embedded in a client app; they are not service-role credentials.

The workflow builds an installable debug APK and an unsigned release APK. A stable, signed release suitable for future in-place updates requires a persistent Android signing keystore and corresponding GitHub secrets. Never generate a new signing key for every release.

The manual Supabase deployment workflow requires repository Actions secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.

## Web deployment

Configure the same two `VITE_*` variables in the existing Vercel project's Preview and Production environments, then redeploy. Vite embeds these public connection values at build time. The database remains protected by RLS and server-side admin checks.

## Security boundaries

- Never commit `.env`, service-role keys, database passwords, or Android signing keys.
- Never expose privileged database operations directly to the browser.
- Do not store activation-code plaintext in Postgres.
- Existing redemption behavior and constraints remain in place; duration choices currently supported by the database are 1, 2 and 12 months.
