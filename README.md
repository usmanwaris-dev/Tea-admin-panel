# Tea Admin

Internal moderation & operations console for **Tea** — the anonymous, topic-based
social app (Flutter + Supabase). This is a **separate web app** for a small,
trusted admin team: triage reports, remove content, suspend/verify accounts,
broadcast push notifications, and monitor growth.

Built with **Next.js (App Router) + TypeScript**, **Tailwind**, **TanStack
Table**, **Recharts**, **lucide-react**, and **@supabase/ssr** for cookie-based
auth. Dark-first, data-dense, Linear/Vercel-grade.

---

## Quick start

```bash
cd Tea-admin_panel
npm install
npm run dev          # http://localhost:3000
```

It runs **out of the box in mock mode** — a seeded, deterministic dataset — so
you can click through every screen before any backend work exists. No login is
required in mock mode.

```bash
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint
```

---

## Two data sources

The dashboard reads through a repository layer (`lib/data/repo.ts`) that works
against either source. Chosen by `NEXT_PUBLIC_DATA_SOURCE`:

| Mode   | What it does                                                        | Setup |
| ------ | ------------------------------------------------------------------- | ----- |
| `mock` | Seeded in-memory data (`lib/mock/data.ts`). Default. Zero backend.  | none  |
| `live` | Queries the real Tea Supabase project; writes via admin RPCs.       | apply `supabase/admin.sql` + set the service-role key |

If `NEXT_PUBLIC_DATA_SOURCE` is unset, it auto-selects `live` when a service-role
key is present, otherwise `mock`.

---

## Environment

`.env.local` is pre-filled with the mobile app's Supabase URL + anon key. See
`.env.example` for the full list.

| Var | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `…_PUBLISHABLE_KEY` | public | anon/publishable key (login + RLS reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | privileged writes. **Never** prefix with `NEXT_PUBLIC`. |
| `NEXT_PUBLIC_DATA_SOURCE` | public | `mock` \| `live` |
| `NEXT_PUBLIC_DEMO_ADMIN_EMAIL` | public | identity shown in mock mode |

The service-role key is only ever read in server code (`lib/supabase/admin.ts`,
guarded by `import "server-only"`). It is never shipped to the browser.

---

## Going live (enabling `live` mode)

1. **Create the admin backend objects.** Run [`supabase/admin.sql`](./supabase/admin.sql)
   against the Tea project (SQL editor or `supabase db push`). It creates:
   - **`admins`** — the admin allow-list (`user_id`, `email`, `role`) + an
     `is_admin()` helper. *There is no admin role in the base schema — this adds it.*
   - **`admin_audit_log`** — every suspend/delete/verify/broadcast: who, to whom, when, why.
   - **`admin_broadcasts`** — push send history.
   - **Admin RPCs** (`SECURITY DEFINER`, gated on `is_admin()`): `admin_delete_post`,
     `admin_delete_comment`, `admin_pin_post`, `admin_set_suspended`,
     `admin_set_verified`, `admin_resolve_report`. These exist because the
     app-facing RPCs (`delete_post`, etc.) are scoped to `auth.uid() = owner` and
     can't act on *other* users' content.
   - **RLS** keeping the admin tables readable by admins only.
2. **Create an admin auth user** (Supabase → Authentication → Add user), then add
   them to `admins` (see the commented `insert` at the bottom of `admin.sql`).
3. **Set env:** `SUPABASE_SERVICE_ROLE_KEY=…` and `NEXT_PUBLIC_DATA_SOURCE=live`.
4. **(Optional) regenerate DB types** for full type-safety:
   ```bash
   supabase gen types typescript --project-id oepnxfrzlsrhnfyrqfem > lib/supabase/database.types.ts
   ```

In live mode the middleware requires a Supabase session **and** a matching
`admins` row for every route; non-admins are bounced to `/login`.

---

## Backend it maps to

Confirmed against the live schema (`Tea-App/supabase/baseline_schema.sql`):

- **Tables:** `users`, `posts` (+ `post_stats`), `comments`, `reports`, `topics`, `verdicts`, `sips`.
- **Storage:** post images live in the **`post-media`** bucket (public URLs).
- **Enums:** `report_reason` (spam/harassment/hate_speech/violence/misinformation/other), `verdict_type` (red_flag/green_flag/same).
- **Broadcast:** sent via the existing **`send-broadcast`** Edge Function (invoked from the server action).

---

## Pages

| Route | What |
| --- | --- |
| `/` | Overview — KPIs, 24h-SLA alert, DAU trend, open-reports queue, recent activity |
| `/reports` | **P0** report queue → detail drawer with inline content, dismiss/remove/suspend/resolve |
| `/posts` | Feed table with thumbnails → full detail (images at full size, poll, stats); delete, pin |
| `/users` | Account table → profile drawer (posts/comments tabs, report history); suspend, verify |
| `/comments` | Comment moderation with parent-post context; delete |
| `/broadcast` | Compose push with live device preview + send history |
| `/analytics` | Recharts: growth, DAU, posts/comments, signups, top topics, trending hashtags |
| `/audit` | Searchable record of every admin action |

## Project structure

```
app/
  (auth)/login/            login (email auth live · demo bypass in mock)
  (dashboard)/             sidebar+topbar shell, admin-gated
    page.tsx               overview
    reports|posts|users|comments|broadcast|analytics|audit/
  auth/signout/            sign-out route handler
lib/
  supabase/                server / client / admin (service-role) factories, config, types
  data/repo.ts             repository — mock or live behind one interface
  mock/data.ts             seeded dataset
  actions.ts               server actions (privileged writes, admin-gated, audited)
  auth.ts                  getCurrentAdmin / requireAdmin
components/                ui/ primitives + shell + content views
middleware.ts              gates every route behind an admin session (live mode)
supabase/admin.sql         admins, audit, broadcasts, admin RPCs, RLS
```

## Security model

- Service-role key is **server-only**; all privileged writes go through server
  actions in `lib/actions.ts`, each calling `requireAdmin()` first.
- RLS stays **on**; reads use the anon key + the admin's session.
- Every mutating action writes an **audit entry** (actor, target, reason, time).
- Destructive actions (delete, suspend) require a typed **reason** via a confirm
  dialog — the reason is stored in the audit log.

## Deploy (Vercel)

Import the repo, set the same env vars in the Vercel project (mark
`SUPABASE_SERVICE_ROLE_KEY` as sensitive/server), and deploy. `next build` is the
build command.
