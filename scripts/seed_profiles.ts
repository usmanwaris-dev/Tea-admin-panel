// Seeds the hand-driven "act as" profiles.
//
//   deno run --allow-env --allow-net scripts/seed_profiles.ts --dry-run
//   deno run --allow-env --allow-net scripts/seed_profiles.ts
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// One-time. Idempotent by email: an account whose email already exists is left
// untouched (its alias/bio/avatar are NOT overwritten on a re-run), so you can
// safely run it again after editing the roster to add new people.
//
// auth.users rows have to come from the Admin API, not SQL, so this can't live in
// the migration (20260818000000_seed_profiles.sql adds the is_seed column). The
// `on_auth_user_created` trigger creates the public.users row automatically with a
// default alias/shape/colour; we then set the real name, bio, avatar, and flip
// is_seed = true.
//
// These are the MANUAL seeding profiles (admin "Seed Profiles" page), separate
// from the automated ai_persona_accounts pool.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DRY = Deno.args.includes("--dry-run");

// ─────────────────────────────────────────────────────────────────────────────
// The roster. 20 believable people with distinct voices, a spread of regions and
// ages, so the seeded feed reads like a community rather than a template.
//
// avatarColor uses the app's native avatar palette (shape+colour renders with no
// external asset, guaranteed to load). To upgrade to real illustrated portraits,
// upload licensed / non-photoreal avatars to Supabase Storage and set `avatarUrl`
// here — never use photos of real people or photoreal AI faces (impersonation and
// likeness-rights risk). `avatarUrl` wins over the colour when set.

interface SeedPerson {
  alias: string;
  email: string;
  bio: string;
  // Shape + colour are assigned by index (see shape()/color() below) so the set
  // stays reproducible; only override avatarUrl / verified per person.
  avatarUrl?: string | null;
  verified?: boolean;
}

const PALETTE = ["#E8756A", "#34D399", "#A78BFA", "#FB923C", "#60A5FA", "#F472B6"];
const SHAPES = ["circle", "hexagon", "diamond"];

// Preset avatar ids from the shared catalog (Tea-Website/src/lib/avatars.ts,
// ported from the app's avatar_picker.dart). Setting preset_avatar_id makes the
// profile render as an illustrated face — the same look real users have —
// instead of a plain geometric shape. 20 distinct, spread across the sets.
const PRESETS = [
  "p1", "m1", "p3", "a2", "m3", "w3", "p4", "m6", "m5", "p2",
  "m2", "a3", "m8", "w2", "m7", "a10", "w4", "a5", "a7", "p5",
];

// Give each person a stable shape/colour/preset by index so re-runs and
// screenshots are reproducible — no randomness (and no Date.now/Math.random,
// unavailable here). The preset is what actually renders; shape+colour is the
// fallback if a client can't resolve the preset.
const shape = (i: number) => SHAPES[i % SHAPES.length];
const color = (i: number) => PALETTE[i % PALETTE.length];
const preset = (i: number) => PRESETS[i % PRESETS.length];

const ROSTER: SeedPerson[] = [
  { alias: "Maya Ellison",       email: "maya.ellison@seed.tea.local",     bio: "late-20s, dry humor, situationship survivor" },
  { alias: "Devon Pryce",        email: "devon.pryce@seed.tea.local",      bio: "i'll play devil's advocate so you don't have to" },
  { alias: "Amara Okafor",       email: "amara.okafor@seed.tea.local",     bio: "rooting for you, always" },
  { alias: "Riley Contreras",    email: "riley.contreras@seed.tea.local",  bio: "red flag radar, zero patience" },
  { alias: "Jonah Feld",         email: "jonah.feld@seed.tea.local",       bio: "i will overthink this for you" },
  { alias: "Priya Nandakumar",   email: "priya.nandakumar@seed.tea.local", bio: "career first. why are you settling" },
  { alias: "Theo Marsh",         email: "theo.marsh@seed.tea.local",       bio: "divorced and wiser", verified: true },
  { alias: "Camille Boucher",    email: "camille.boucher@seed.tea.local",  bio: "hopeless romantic, pro green flag" },
  { alias: "Marcus Hale",        email: "marcus.hale@seed.tea.local",      bio: "boundaries are self-care" },
  { alias: "Sofia Reyes",        email: "sofia.reyes@seed.tea.local",      bio: "spill it. all of it." },
  { alias: "Ben Kowalski",       email: "ben.kowalski@seed.tea.local",     bio: "here for the one-liners" },
  { alias: "Naomi Adeyemi",      email: "naomi.adeyemi@seed.tea.local",    bio: "let's name the pattern", verified: true },
  { alias: "Elliot Chen",        email: "elliot.chen@seed.tea.local",      bio: "what did they ACTUALLY say tho" },
  { alias: "Georgia Wren",       email: "georgia.wren@seed.tea.local",     bio: "gentle nudges only" },
  { alias: "Andre Silva",        email: "andre.silva@seed.tea.local",      bio: "been there, survived that" },
  { alias: "Hana Yamamoto",      email: "hana.yamamoto@seed.tea.local",    bio: "one perfect sentence" },
  { alias: "Kayla Brooks",       email: "kayla.brooks@seed.tea.local",     bio: "chaotic good energy" },
  { alias: "Ravi Malhotra",      email: "ravi.malhotra@seed.tea.local",    bio: "here's what i'd text back" },
  { alias: "Lena Vogel",         email: "lena.vogel@seed.tea.local",       bio: "we're only hearing one side" },
  { alias: "Isaiah Turner",      email: "isaiah.turner@seed.tea.local",    bio: "you got this, for real" },
];

// ─────────────────────────────────────────────────────────────────────────────

const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  Deno.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Existing seed accounts, keyed by email, so a re-run skips anyone already made.
const { data: existingRows } = await supabase
  .from("users")
  .select("id, alias")
  .eq("is_seed", true);
console.log(`${existingRows?.length ?? 0} seed profiles already exist. Roster has ${ROSTER.length}.`);
if (DRY) console.log("DRY RUN — nothing will be written.\n");

let created = 0;
let skipped = 0;

for (let i = 0; i < ROSTER.length; i++) {
  const p = ROSTER[i];
  const avatarShape = shape(i);
  const avatarColor = color(i);

  // Spread signups across the last ~7 months, weighted toward recent, so the
  // seed cohort's join dates don't all land on the same afternoon.
  const daysAgo = Math.floor(Math.pow((i + 1) / (ROSTER.length + 1), 1.4) * 210);
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();

  if (DRY) {
    console.log(`  ${p.alias.padEnd(22)} ${avatarShape.padEnd(8)} ${avatarColor}  ${createdAt.slice(0, 10)}`);
    continue;
  }

  // Admin API creates auth.users; the on_auth_user_created trigger creates the
  // public.users row. createUser fails if the email already exists — treat that
  // as "already seeded" and skip, keeping the script idempotent.
  const { data, error } = await supabase.auth.admin.createUser({
    email: p.email,
    email_confirm: true,
    user_metadata: { seeded: true, seed_kind: "manual" },
  });

  if (error || !data?.user) {
    // Duplicate email → already created on a prior run.
    if (error?.message?.toLowerCase().includes("already")) {
      console.log(`  skip  ${p.alias} (exists)`);
      skipped++;
      continue;
    }
    console.error(`  [${i}] createUser failed for ${p.alias}:`, error?.message);
    continue;
  }

  const patch: Record<string, unknown> = {
    alias: p.alias,
    bio: p.bio,
    avatar_shape: avatarShape,
    avatar_color: avatarColor,
    preset_avatar_id: preset(i),
    avatar_url: p.avatarUrl ?? null,
    is_verified: p.verified ?? false,
    is_seed: true,
    created_at: createdAt,
    last_active_at: createdAt,
  };
  const { error: uErr } = await supabase.from("users").update(patch).eq("id", data.user.id);
  if (uErr) {
    console.error(`  [${i}] profile update failed for ${p.alias}:`, uErr.message);
    continue;
  }

  created++;
  console.log(`  ${p.alias.padEnd(22)} ${avatarShape.padEnd(8)} ${avatarColor}`);
}

console.log(
  DRY
    ? `\nDry run complete — ${ROSTER.length} profiles previewed.`
    : `\nDone. Created ${created}, skipped ${skipped} existing. Total seed profiles now ${(existingRows?.length ?? 0) + created}.`
);
