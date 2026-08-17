# Seed Profiles & "Act As" — runbook

Lets an admin act as a seed profile (`users.is_seed = true`) and post / comment /
cast verdicts as them, to fill the feed with life. All three Tea apps share one
Supabase DB, so content seeded here shows up in the website and mobile app too.

## What shipped

| Piece | File |
| --- | --- |
| `is_seed` column + index | `Tea-App/supabase/migrations/20260818000000_seed_profiles.sql` |
| Seed script (20 profiles) | `Tea-admin_panel/scripts/seed_profiles.ts` |
| Act-as state + write actions | `lib/actions.ts` (`actAsProfileAction`, `stopActingAsAction`, `seedCommentAction`, `seedVerdictAction`, `seedPostAction`) |
| Roster read | `lib/data/repo.ts` (`getSeedProfiles`) |
| Switcher UI | `app/(dashboard)/seed/` + nav item in `components/shell/sidebar.tsx` |

Everything runs against the mock seam with zero backend (default `NEXT_PUBLIC_DATA_SOURCE=mock`),
so you can demo the switcher before touching production.

## Deploy (in order)

1. **Apply the migration** to the shared Supabase project (adds `users.is_seed`):
   ```
   cd Tea-App && supabase db push        # or your normal migration path
   ```

2. **Create the 20 profiles.** Preview first, then run for real:
   ```
   cd Tea-admin_panel
   deno run --allow-env --allow-net scripts/seed_profiles.ts --dry-run
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
     deno run --allow-env --allow-net scripts/seed_profiles.ts
   ```
   Idempotent by email — safe to re-run after editing the roster to add people.

3. **Use it.** In the admin panel → **Seed Profiles**: click *Act as* on a profile,
   then post from the composer. Exit and switch to another profile to vary voices.
   Every action is written to `admin_audit_log` (which admin, acting as which profile).

## Guarantees

- **Admin-only** — `requireAdmin()` guards every action; middleware bounces non-admins.
- **Seed-only targets** — act-as re-validates `is_seed = true` server-side; a real
  user's account can never be impersonated.
- **Audited** — `seed.act_as` / `seed.stop` / `seed.post` / `seed.comment` / `seed.verdict`.
- **Rate limits respected** — the DB's 5s / 30-per-hour comment triggers still apply
  per seed profile; space out bulk seeding accordingly.

## Comment / verdict on existing posts (P5b — done)

In **Posts**, open any post → the drawer shows a "Acting as {profile}" panel with
🚩/✅/🟰 verdict buttons and a "Comment as {profile}" box (component
`components/content/seed-actions.tsx`). It's hidden until you pick a profile on the
Seed Profiles page. Casting a verdict upserts (re-casting changes the vote, never
dupes); commenting refreshes the thread inline. Verified end-to-end against live —
the comment cooldown / moderation / rate-limit triggers accept seed writes.

> **Caveat:** remove seeded comments through the normal admin **Delete** control
> (soft-delete, `is_deleted=true`) — that's what fires the `post_stats` decrement
> trigger. A raw hard `DELETE` bypasses it and leaves `comment_count` drifted.

## Avatar images (done)

On the **Seed Profiles** page, hover a profile's avatar → **camera** button opens a
file picker; the image uploads to the public `seed-avatars` Storage bucket (created
on first use) and sets `users.avatar_url`. The **×** badge removes it, reverting to
the shape+colour avatar. Server-side we restrict to PNG/JPEG/WebP/GIF ≤ 3MB and only
ever target `is_seed` profiles; every change is audited (`seed.avatar`). Verified
live: bucket create + upload + public serve all work.

Provide your own **licensed / non-photoreal** images — do NOT use photos of real
people or photoreal AI faces (impersonation + likeness-rights risk).

## Remaining work

- Nothing required. Optional: bulk-assign illustrated avatars via a script instead
  of uploading one-by-one, if you'd rather not do it in the UI.
