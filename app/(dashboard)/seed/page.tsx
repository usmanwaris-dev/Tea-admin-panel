import { getSeedProfiles, getTopics, getTrendingHashtags } from "@/lib/data/repo";
import { getActingAsId } from "@/lib/actions";
import { PageHeader } from "@/components/page-header";
import { SeedClient } from "./seed-client";

export const dynamic = "force-dynamic";

export default async function SeedPage() {
  const [profiles, topics, hashtags, actingAsId] = await Promise.all([
    getSeedProfiles(),
    getTopics(),
    getTrendingHashtags(),
    getActingAsId(),
  ]);

  return (
    <div>
      <PageHeader
        title="Seed Profiles"
        description="Act as a seed profile to post, comment, and cast verdicts — filling the feed with life. Every action is logged against your admin account."
      />
      <SeedClient profiles={profiles} topics={topics} hashtags={hashtags} actingAsId={actingAsId} />
    </div>
  );
}
