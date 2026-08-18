/**
 * Deterministic mock dataset for the Tea Admin dashboard.
 *
 * Lets the entire product run (dev + demo) before the real admin RPCs and
 * service-role writes exist. Everything is generated from a fixed seed so the
 * data is stable across renders; timestamps are anchored to module-load time so
 * relative ages ("3h", "2d") still read as "live".
 *
 * Swap this out by setting NEXT_PUBLIC_DATA_SOURCE=live once the Supabase admin
 * objects in supabase/admin.sql are applied — the repository layer picks the
 * source automatically.
 */

import type {
  AdminComment,
  AdminPost,
  AdminReport,
  AdminUser,
  AuditEntry,
  AuthorRef,
  Broadcast,
  HashtagVolume,
  KpiSnapshot,
  ReportReason,
  ReportStatus,
  ReviewQueueItem,
  TimeSeriesPoint,
  TopicVolume,
} from "@/lib/types";

// ---- Seeded PRNG (mulberry32) so the dataset is deterministic -------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;

const NOW = Date.now();
const HOUR = 36e5;
const DAY = 24 * HOUR;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

// ---- Vocabulary -----------------------------------------------------------
const ADJ = [
  "Velvet", "Midnight", "Bitter", "Golden", "Quiet", "Feral", "Salty", "Reckless",
  "Silent", "Crimson", "Restless", "Hollow", "Electric", "Frosted", "Wandering",
  "Moody", "Vicious", "Tender", "Anonymous", "Jaded", "Petty", "Loyal",
];
const NOUN = [
  "Fox", "Ghost", "Ember", "Sparrow", "Kettle", "Moth", "Comet", "Willow",
  "Raven", "Otter", "Thorn", "Lantern", "Maple", "Cinder", "Heron", "Vixen",
  "Wolf", "Finch", "Onyx", "Sage", "Juniper", "Nectar",
];
const AVATAR_COLORS = [
  "#E8756A", "#6AA9E8", "#8FD19E", "#E8C46A", "#B98FE8", "#E88FB9",
  "#6AD1C8", "#E8A66A", "#8F9FE8", "#D18F8F",
];

const TOPICS = [
  { id: 1, name: "Relationships", icon: "💔", color: "#E8756A" },
  { id: 2, name: "Work", icon: "💼", color: "#6AA9E8" },
  { id: 3, name: "Family", icon: "🏠", color: "#8FD19E" },
  { id: 4, name: "Money", icon: "💸", color: "#E8C46A" },
  { id: 5, name: "Confessions", icon: "🤫", color: "#B98FE8" },
  { id: 6, name: "Drama", icon: "🎭", color: "#E88FB9" },
  { id: 7, name: "Friends", icon: "🫂", color: "#6AD1C8" },
  { id: 8, name: "Health", icon: "🩺", color: "#E8A66A" },
  { id: 9, name: "School", icon: "🎓", color: "#8F9FE8" },
  { id: 10, name: "Petty", icon: "😤", color: "#D18F8F" },
];

const POST_BODIES = [
  "my roommate has been eating my food for weeks and gaslighting me about it. found the receipts today. do i confront or move out silently?",
  "got promoted over my mentor who taught me everything. he congratulated me but hasn't spoken since. the guilt is eating me alive.",
  "my sister is marrying the guy who ghosted me 3 years ago. nobody in my family sees the problem. am i crazy for not going?",
  "spent my entire savings on a trip my partner then cancelled. they say we'll 'do it later'. i don't think there's a later.",
  "i've been pretending to go to work for two months. lost my job in June. i leave every morning and sit in a parking lot.",
  "found out my best friend has been screenshotting our private chats into a group i'm not in. 6 years down the drain.",
  "my landlord keeps 'stopping by' unannounced. today he reorganized my kitchen. i pay $2400 a month for this.",
  "everyone at the party knew about the surprise except me and it was MY surprise party. i planned my own birthday alone.",
  "my mom introduced my replacement. she literally called my cousin 'the daughter i wish i had' at dinner. i just smiled.",
  "coworker takes credit for my work in every meeting. today i stayed silent and let her present a slide with a typo i planted.",
  "he remembered our anniversary but forgot which year we got together. off by two. i don't know why that broke me.",
  "i tipped 30% at a place where the waiter was rude because i didn't want to seem cheap in front of my date. never again.",
  "my group chat has been quiet for a week. turns out there's a second group chat. i started a third one. with myself.",
  "borrowed $500 to a friend who just posted a vacation to bali. the audacity. the SAND. the ocean of it all.",
  "my therapist yawned during my breakthrough. i've been thinking about it for nine days.",
];

const COMMENT_BODIES = [
  "not the receipts 💀 you already know what to do",
  "this is exactly what happened to me. run.",
  "respectfully, you're the drama here",
  "the parking lot part actually broke me. please talk to someone",
  "planted typo is diabolical and i respect it",
  "off by two years is wild, i'd spiral too",
  "third group chat with yourself is elite behavior",
  "the SAND had me screaming",
  "go to the wedding and glow, that's the revenge",
  "nine days is nothing, i think about a text from 2019",
];

const HASHTAGS = [
  "redflag", "spilltea", "notmyfault", "storytime", "amiwrong", "greenflag",
  "petty", "confession", "familydrama", "workdrama", "ghosted", "receipts",
];

const MOODS = ["😭", "😤", "🤡", "🫠", "😌", "💀", "🥲", null, null, null];

// Placeholder images for posts that "have media" (picsum, allowed in next.config)
const mediaUrl = (seed: number, i: number) =>
  `https://picsum.photos/seed/tea-${seed}-${i}/800/600`;

// ---- Users ----------------------------------------------------------------
function makeAlias(i: number): string {
  return `${pick(ADJ)}${pick(NOUN)}${chance(0.4) ? int(10, 99) : ""}`;
}

export const users: AdminUser[] = Array.from({ length: 64 }).map((_, i) => {
  const alias = makeAlias(i);
  const createdDaysAgo = int(1, 400);
  const suspended = chance(0.09);
  const verified = chance(0.12);
  return {
    id: `user-${1000 + i}`,
    alias,
    avatar_color: pick(AVATAR_COLORS),
    avatar_url: null,
    bio: chance(0.5) ? pick(["just here for the drama", "spilling responsibly", "chronically online", "lurker turned poster", ""]) : "",
    is_verified: verified,
    is_suspended: suspended,
    is_advisor: chance(0.06),
    suspended_at: suspended ? iso(int(1, 40) * DAY) : null,
    suspension_reason: suspended ? pick(["Repeated harassment reports", "Spam / self-promotion", "Hate speech", "Ban evasion", "Coordinated brigading"]) : null,
    created_at: iso(createdDaysAgo * DAY),
    last_active_at: iso(int(0, 20) * DAY + int(0, 23) * HOUR),
    post_count: int(0, 48),
    comment_count: int(0, 210),
    reports_against: suspended ? int(3, 14) : int(0, 4),
  };
});

const authorRef = (u: AdminUser): AuthorRef => ({
  id: u.id,
  alias: u.alias,
  avatar_color: u.avatar_color,
  avatar_url: u.avatar_url,
  is_verified: u.is_verified,
  is_suspended: u.is_suspended,
});

// ---- Posts ----------------------------------------------------------------
export const posts: AdminPost[] = Array.from({ length: 130 }).map((_, i) => {
  const author = pick(users);
  const topic = pick(TOPICS);
  const createdHoursAgo = int(1, 60 * 24);
  const hasMedia = chance(0.42);
  const mediaCount = hasMedia ? int(1, 3) : 0;
  const body = pick(POST_BODIES);
  const bodyWithTags = chance(0.5) ? `${body} #${pick(HASHTAGS)}` : body;
  const sip = int(0, 900);
  const isDeleted = chance(0.05);
  const reportCount = chance(0.22) ? int(1, 9) : 0;
  const hasPoll = chance(0.15);
  return {
    id: 5000 + i,
    author: authorRef(author),
    topic,
    type: "original" as const,
    content: bodyWithTags,
    media_urls: Array.from({ length: mediaCount }).map((_, m) => mediaUrl(5000 + i, m)),
    mood: pick(MOODS),
    is_deleted: isDeleted,
    comments_disabled: chance(0.06),
    created_at: iso(createdHoursAgo * HOUR),
    stats: {
      sip_count: sip,
      comment_count: int(0, 140),
      red_flag_count: int(0, 300),
      green_flag_count: int(0, 200),
      same_count: int(0, 90),
      repost_count: int(0, 40),
      view_count: sip * int(4, 12) + int(50, 4000),
    },
    poll: hasPoll
      ? {
          id: 9000 + i,
          question: "verdict?",
          options: [
            { id: 1, text: "you're valid", vote_count: int(10, 400) },
            { id: 2, text: "you're the problem", vote_count: int(10, 400) },
            { id: 3, text: "need more context", vote_count: int(5, 150) },
          ],
        }
      : null,
    report_count: reportCount,
  };
});

// ---- Comments -------------------------------------------------------------
export const comments: AdminComment[] = Array.from({ length: 80 }).map((_, i) => {
  const post = pick(posts);
  const author = pick(users);
  return {
    id: 20000 + i,
    post_id: post.id,
    post_excerpt: (post.content ?? "").slice(0, 70),
    author: authorRef(author),
    content: pick(COMMENT_BODIES),
    upvotes: int(0, 120),
    is_deleted: chance(0.06),
    created_at: iso(int(1, 40 * 24) * HOUR),
    report_count: chance(0.15) ? int(1, 5) : 0,
  };
});

// ---- Reports --------------------------------------------------------------
const REASONS: ReportReason[] = ["spam", "harassment", "hate_speech", "violence", "misinformation", "other"];
const STATUSES: ReportStatus[] = ["pending", "pending", "pending", "reviewing", "resolved", "dismissed"];

export const reports: AdminReport[] = Array.from({ length: 34 }).map((_, i) => {
  const reporter = pick(users);
  const status = i < 4 ? "pending" : pick(STATUSES); // ensure some overdue pending
  const ageHours = i < 4 ? int(25, 60) : status === "pending" ? int(1, 30) : int(1, 200);
  const targetRoll = rand();
  let target_type: AdminReport["target_type"];
  let post: AdminPost | null = null;
  let comment: AdminComment | null = null;
  let target_user: AuthorRef | null = null;
  if (targetRoll < 0.6) {
    target_type = "post";
    post = pick(posts.filter((p) => p.report_count > 0)) ?? pick(posts);
  } else if (targetRoll < 0.85) {
    target_type = "comment";
    comment = pick(comments);
  } else {
    target_type = "user";
    target_user = authorRef(pick(users));
  }
  const resolved = status === "resolved" || status === "dismissed";
  return {
    id: 30000 + i,
    reporter: authorRef(reporter),
    target_type,
    reason: pick(REASONS),
    details: chance(0.5)
      ? pick([
          "this is clearly targeted harassment of a specific person",
          "spam, they posted this 6 times",
          "graphic threat in the comments",
          "spreading false medical info",
          "doxxing attempt in the replies",
          "",
        ])
      : null,
    status,
    created_at: iso(ageHours * HOUR),
    resolved_at: resolved ? iso(int(1, 20) * HOUR) : null,
    post,
    comment,
    target_user,
  };
});

// ---- Review queue (held posts awaiting moderation) ------------------------
// Published-then-held posts: is_under_review + is_deleted, each with a pending
// report. System auto-flags (is_system) carry a machine reason in `details`;
// user reports carry a human note. Some posts appear twice (auto-flag + a later
// user report) to exercise the "multiple pending reports on one post" case.
// Mutated in place (splice) when a mock resolve drops an item.
const AUTO_DETAILS = [
  "Auto-flagged for review — targeting:accusation_named; explicit:explicit_anatomy",
  "Auto-flagged for review — targeting:accusation_named",
  "Auto-flagged for review — explicit:explicit_anatomy; toxicity:severe",
  "Auto-flagged for review — self_harm:ideation",
  "Auto-flagged for review — pii:phone_number; targeting:accusation_named",
];
const USER_DETAILS = [
  "this is clearly targeting a specific person by name",
  "graphic / explicit content, shouldn't be public",
  "feels like a coordinated pile-on",
  "",
];

export const reviewQueue: ReviewQueueItem[] = (() => {
  const held = posts.slice(0, 9);
  const items: ReviewQueueItem[] = [];
  held.forEach((p, i) => {
    const author = users.find((u) => u.id === p.author.id) ?? pick(users);
    const toAuthor = (): ReviewQueueItem["author"] => ({
      id: author.id,
      alias: author.alias,
      avatar_shape: pick(["circle", "squircle", "hexagon"]),
      avatar_color: author.avatar_color,
      avatar_url: author.avatar_url,
      preset_avatar_id: ["p1", "m1", "p3", "a2", "m3", "w3", "p4", "m6", "m5", "p2"][i % 10],
    });
    const base = {
      post_id: p.id,
      content: p.content,
      media_urls: p.media_urls,
      mood: p.mood,
      is_under_review: true,
      is_deleted: true,
      post_created_at: p.created_at,
      topic: p.topic,
    };
    // Every held post has an auto-flag (this is what publishing/keeping keys off).
    items.push({
      report_id: 40000 + i * 2,
      reason: pick(["harassment", "hate_speech", "violence", "other"]) as ReportReason,
      details: AUTO_DETAILS[i % AUTO_DETAILS.length],
      status: "pending",
      reported_at: iso((i * 5 + 2) * HOUR),
      is_system: true,
      author: toAuthor(),
      ...base,
    });
    // ~1 in 3 also picked up a later user report on the same post.
    if (i % 3 === 0) {
      items.push({
        report_id: 40000 + i * 2 + 1,
        reason: pick(["harassment", "misinformation", "spam", "other"]) as ReportReason,
        details: USER_DETAILS[i % USER_DETAILS.length],
        status: "pending",
        reported_at: iso((i * 5) * HOUR), // slightly newer than the auto-flag
        is_system: false,
        author: toAuthor(),
        ...base,
      });
    }
  });
  // Newest first, matching the RPC contract.
  return items.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
})();

// ---- Audit log ------------------------------------------------------------
const ADMIN_EMAILS = ["dev2@getsnippet.co", "mod.jess@getsnippet.co", "ops.sam@getsnippet.co"];
const AUDIT_ACTIONS: AuditEntry["action"][] = [
  "post.delete", "user.suspend", "report.resolve", "report.dismiss",
  "comment.delete", "user.verify", "user.unsuspend", "broadcast.send", "post.pin",
];

export const auditLog: AuditEntry[] = Array.from({ length: 60 }).map((_, i) => {
  const action = pick(AUDIT_ACTIONS);
  const target = action.startsWith("user")
    ? { type: "user", id: pick(users).id, label: pick(users).alias }
    : action.startsWith("post")
    ? { type: "post", id: String(pick(posts).id), label: `Post #${pick(posts).id}` }
    : action.startsWith("comment")
    ? { type: "comment", id: String(pick(comments).id), label: `Comment #${pick(comments).id}` }
    : action.startsWith("broadcast")
    ? { type: "broadcast", id: `bc-${i}`, label: "Push broadcast" }
    : { type: "report", id: String(pick(reports).id), label: `Report #${pick(reports).id}` };
  return {
    id: `audit-${i}`,
    actor_email: pick(ADMIN_EMAILS),
    action,
    target_type: target.type,
    target_id: target.id,
    target_label: target.label,
    reason:
      action === "user.suspend"
        ? pick(["Repeated harassment", "Spam", "Hate speech", "Ban evasion"])
        : action.includes("delete")
        ? pick(["Violates community guidelines", "Graphic content", "Targeted harassment"])
        : null,
    metadata: null,
    created_at: iso(i * 4 * HOUR + int(0, 3) * HOUR),
  };
});

// ---- Broadcasts -----------------------------------------------------------
export const broadcasts: Broadcast[] = [
  {
    id: "bc-1", title: "The tea is piping hot ☕", body: "3 stories in your topics blew up overnight. Come see.",
    route: "/feed", audience: "All users", status: "sent", recipients: 6142, delivered: 5981,
    sent_by: "dev2@getsnippet.co", created_at: iso(2 * DAY),
  },
  {
    id: "bc-2", title: "Someone spilled about your topic", body: "New drama in Relationships. Don't miss it.",
    route: "/topic/1", audience: "Relationships followers", status: "sent", recipients: 2210, delivered: 2154,
    sent_by: "ops.sam@getsnippet.co", created_at: iso(5 * DAY),
  },
  {
    id: "bc-3", title: "We missed you", body: "Your feed refreshed while you were gone.",
    route: "/feed", audience: "Inactive 7d+", status: "sent", recipients: 1830, delivered: 1712,
    sent_by: "mod.jess@getsnippet.co", created_at: iso(9 * DAY),
  },
];

// ---- Analytics series -----------------------------------------------------
export function timeSeries(days: number): TimeSeriesPoint[] {
  const local = mulberry32(7);
  let cumulative = 5200;
  const out: TimeSeriesPoint[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const signups = Math.floor(local() * 40) + 10;
    cumulative += signups;
    out.push({
      date: new Date(NOW - d * DAY).toISOString().slice(0, 10),
      signups,
      users: cumulative,
      dau: Math.floor(local() * 300) + 400,
      posts: Math.floor(local() * 30) + 25,
      comments: Math.floor(local() * 60) + 60,
      verdicts: Math.floor(local() * 200) + 280,
    });
  }
  return out;
}

export const topicVolume: TopicVolume[] = TOPICS.map((t) => ({
  name: t.name,
  color: t.color,
  posts: posts.filter((p) => p.topic?.id === t.id && !p.is_deleted).length + int(4, 30),
})).sort((a, b) => b.posts - a.posts);

export const trendingHashtags: HashtagVolume[] = HASHTAGS.map((tag) => ({
  tag,
  count: int(40, 900),
})).sort((a, b) => b.count - a.count);

// ---- Push registration coverage ------------------------------------------
export const pushCoverage = [
  { outcome: "saved", platform: "ios", users: 3320, pct: 88.4, most_recent: iso(1 * HOUR) },
  { outcome: "saved", platform: "android", users: 210, pct: 5.6, most_recent: iso(2 * HOUR) },
  { outcome: "no_permission", platform: "ios", users: 155, pct: 4.1, most_recent: iso(6 * HOUR) },
  { outcome: "no_apns", platform: "ios", users: 38, pct: 1.0, most_recent: iso(9 * HOUR) },
  { outcome: "error", platform: "ios", users: 21, pct: 0.6, most_recent: iso(4 * HOUR) },
  { outcome: "no_session", platform: "android", users: 12, pct: 0.3, most_recent: iso(20 * HOUR) },
];

// ---- KPI snapshot ---------------------------------------------------------
export function kpiSnapshot(): KpiSnapshot {
  const pending = reports.filter((r) => r.status === "pending");
  const overdue = pending.filter((r) => (NOW - new Date(r.created_at).getTime()) / HOUR > 24);
  const suspended = users.filter((u) => u.is_suspended);
  return {
    dau: 1284,
    wau: 3960,
    total_users: 6142,
    new_signups_today: 38,
    new_signups_week: 214,
    posts_today: 41,
    comments_today: 96,
    posts_per_day_avg: 41,
    comments_per_day_avg: 96,
    pending_reports: pending.length,
    reports_overdue: overdue.length,
    verdicts_per_day_avg: 380,
    suspended_accounts: suspended.length,
    banned_accounts: 7,
    suspended_by_filter: 33,
  };
}

export { TOPICS };
