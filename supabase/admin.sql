-- =============================================================================
-- Tea Admin — backend objects
-- =============================================================================
-- Run this ONCE against the Tea Supabase project (SQL editor or `supabase db`)
-- to enable LIVE mode for the admin dashboard. It adds the admin role, an audit
-- trail, a broadcast history table, and SECURITY DEFINER RPCs that let a
-- verified admin act on *any* user's content (the app-facing RPCs are scoped to
-- auth.uid() = owner and cannot).
--
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.
-- Nothing here touches existing app tables' data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Admin role
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  email      text not null,
  role       text not null default 'admin' check (role in ('owner', 'admin', 'moderator')),
  created_at timestamptz not null default now()
);

comment on table public.admins is 'Allow-list of admin accounts for the Tea admin dashboard.';

-- Fast admin check, callable from RLS + RPCs. SECURITY DEFINER so it can read
-- public.admins regardless of the caller's own RLS.
create or replace function public.is_admin(p_uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins a where a.user_id = p_uid);
$$;

-- ---------------------------------------------------------------------------
-- 2. Audit log — every privileged action
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users (id),
  actor_email  text not null,
  action       text not null,
  target_type  text not null,
  target_id    text,
  target_label text,
  reason       text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_action_idx  on public.admin_audit_log (action);

create or replace function public._admin_audit(
  p_action text, p_target_type text, p_target_id text,
  p_target_label text, p_reason text, p_metadata jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  select email into v_email from public.admins where user_id = auth.uid();
  insert into public.admin_audit_log(actor_id, actor_email, action, target_type, target_id, target_label, reason, metadata)
  values (auth.uid(), coalesce(v_email, 'unknown'), p_action, p_target_type, p_target_id, p_target_label, p_reason, p_metadata);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Broadcast history
-- ---------------------------------------------------------------------------
create table if not exists public.admin_broadcasts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  route      text,
  audience   text not null default 'All users',
  status     text not null default 'sent',
  recipients int  not null default 0,
  delivered  int  not null default 0,
  sent_by    text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_broadcasts_created_idx on public.admin_broadcasts (created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Admin RPCs (SECURITY DEFINER, gated on is_admin())
--    Every RPC re-checks the caller is an admin and writes an audit row.
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_post(p_post_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.posts set is_deleted = true where id = p_post_id;
  perform public._admin_audit('post.delete', 'post', p_post_id::text, 'Post #' || p_post_id, p_reason, null);
end; $$;

create or replace function public.admin_delete_comment(p_comment_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.comments set is_deleted = true where id = p_comment_id;
  perform public._admin_audit('comment.delete', 'comment', p_comment_id::text, 'Comment #' || p_comment_id, p_reason, null);
end; $$;

create or replace function public.admin_pin_post(p_post_id bigint, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select author_id into v_author from public.posts where id = p_post_id;
  update public.users set pinned_post_id = case when p_pinned then p_post_id else null end where id = v_author;
  perform public._admin_audit(case when p_pinned then 'post.pin' else 'post.unpin' end, 'post', p_post_id::text, 'Post #' || p_post_id, null, null);
end; $$;

create or replace function public.admin_set_suspended(p_user_id uuid, p_suspended boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.users
     set is_suspended     = p_suspended,
         suspended_at     = case when p_suspended then now() else null end,
         suspension_reason = case when p_suspended then p_reason else null end
   where id = p_user_id;
  perform public._admin_audit(case when p_suspended then 'user.suspend' else 'user.unsuspend' end,
                              'user', p_user_id::text, null, p_reason, null);
end; $$;

create or replace function public.admin_set_verified(p_user_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.users set is_verified = p_verified where id = p_user_id;
  perform public._admin_audit(case when p_verified then 'user.verify' else 'user.unverify' end,
                              'user', p_user_id::text, null, null, null);
end; $$;

create or replace function public.admin_resolve_report(p_report_id bigint, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.reports
     set status   = p_status,
         resolved = (p_status in ('resolved', 'dismissed'))
   where id = p_report_id;
  perform public._admin_audit(case when p_status = 'dismissed' then 'report.dismiss' else 'report.resolve' end,
                              'report', p_report_id::text, 'Report #' || p_report_id, p_reason, null);
end; $$;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security — admin tables readable only by admins
--    (Privileged writes go through the service-role key from the server, which
--     bypasses RLS; these policies protect against anon/anon-key access.)
-- ---------------------------------------------------------------------------
alter table public.admins           enable row level security;
alter table public.admin_audit_log  enable row level security;
alter table public.admin_broadcasts enable row level security;

drop policy if exists "admins read admins" on public.admins;
create policy "admins read admins" on public.admins
  for select using (public.is_admin());

drop policy if exists "admins read audit" on public.admin_audit_log;
create policy "admins read audit" on public.admin_audit_log
  for select using (public.is_admin());

drop policy if exists "admins read broadcasts" on public.admin_broadcasts;
create policy "admins read broadcasts" on public.admin_broadcasts
  for select using (public.is_admin());

-- Let signed-in admins execute the admin RPCs.
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.admin_delete_post(bigint, text)          to authenticated;
grant execute on function public.admin_delete_comment(bigint, text)       to authenticated;
grant execute on function public.admin_pin_post(bigint, boolean)          to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_verified(uuid, boolean)        to authenticated;
grant execute on function public.admin_resolve_report(bigint, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Seed your first admin
--    Create the auth user first (Supabase → Authentication → Add user), then:
-- ---------------------------------------------------------------------------
-- insert into public.admins (user_id, email, role)
-- select id, email, 'owner' from auth.users where email = 'dev2@getsnippet.co'
-- on conflict (user_id) do nothing;

-- ===========================================================================
-- 7. Review Queue — publish-then-hold moderation
-- ===========================================================================
-- The Tea app moved from hard-block to publish-then-hold: a post that trips a
-- content detector is still created but HELD — hidden from public feeds
-- (is_under_review + is_deleted) and visible only to its author — and a pending
-- report is filed (system auto-flags have reporter_id IS NULL).
--
-- This section adds the admin surface the dashboard's Review Queue depends on:
--   • posts.is_under_review flag (idempotent; the APP must set it true when it
--     holds a post — this only guarantees the column exists for the admin side)
--   • admin_list_review_queue(p_limit, p_cursor) → held posts + pending reports
--   • admin_resolve_report re-defined to also PUBLISH (dismissed) or KEEP-HIDE
--     (resolved) the held post, not just close the report row.
-- Safe to re-run.

-- 7a. Hold flag on posts (app-owned column; declared here so the admin RPCs
--     compile even before the app migration lands). Non-destructive.
alter table public.posts add column if not exists is_under_review boolean not null default false;
create index if not exists posts_under_review_idx on public.posts (is_under_review) where is_under_review;

-- 7b. List the queue: one row per pending report on a held post, newest first.
--     Returns a JSON array shaped exactly for the admin panel. RLS on `reports`
--     hides system auto-flags from clients, so this SECURITY DEFINER RPC is the
--     only authorized way to read the queue.
create or replace function public.admin_list_review_queue(p_limit int default 50, p_cursor timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare v_out jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select coalesce(jsonb_agg(x order by x.reported_at desc), '[]'::jsonb) into v_out
  from (
    select
      r.id                          as report_id,
      r.reason                      as reason,
      r.details                     as details,
      r.status                      as status,
      r.created_at                  as reported_at,
      (r.reporter_id is null)       as is_system,
      p.id                          as post_id,
      p.content                     as content,
      coalesce(p.media_urls, '{}'::text[]) as media_urls,
      p.mood                        as mood,
      p.is_under_review             as is_under_review,
      p.is_deleted                  as is_deleted,
      p.created_at                  as post_created_at,
      jsonb_build_object(
        'id', u.id,
        'alias', u.alias,
        'avatar_shape', u.avatar_shape,
        'avatar_color', u.avatar_color,
        'avatar_url', u.avatar_url,
        'preset_avatar_id', u.preset_avatar_id
      )                             as author,
      case when t.id is null then null else jsonb_build_object(
        'id', t.id, 'name', t.name, 'icon', t.icon, 'color', t.color
      ) end                         as topic
    from public.reports r
    join public.posts  p on p.id = r.post_id
    left join public.users  u on u.id = p.author_id
    left join public.topics t on t.id = p.topic_id
    where r.status = 'pending'
      and r.post_id is not null
      and p.is_under_review = true
      and (p_cursor is null or r.created_at < p_cursor)
    order by r.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  ) x;
  return v_out;
end; $$;

-- 7c. Resolve one held-post report AND settle the post's visibility.
--     dismissed → Approve & publish (un-hide); resolved → Keep removed (stays
--     hidden). The `and is_under_review` guard means resolving an ordinary
--     report on a non-held post never touches post visibility.
create or replace function public.admin_resolve_report(p_report_id bigint, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_post bigint;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  update public.reports
     set status   = p_status,
         resolved = (p_status in ('resolved', 'dismissed'))
   where id = p_report_id
   returning post_id into v_post;

  if v_post is not null then
    if p_status = 'dismissed' then
      -- Approve & publish: the post goes live and counts toward its topic.
      update public.posts set is_under_review = false, is_deleted = false
       where id = v_post and is_under_review = true;
    elsif p_status = 'resolved' then
      -- Keep removed: no longer awaiting review, but stays hidden.
      update public.posts set is_under_review = false
       where id = v_post and is_under_review = true;
    end if;
  end if;

  perform public._admin_audit(case when p_status = 'dismissed' then 'report.dismiss' else 'report.resolve' end,
                              'report', p_report_id::text, 'Report #' || p_report_id, p_reason, null);
end; $$;

grant execute on function public.admin_list_review_queue(int, timestamptz) to authenticated;
grant execute on function public.admin_resolve_report(bigint, text, text)   to authenticated;
