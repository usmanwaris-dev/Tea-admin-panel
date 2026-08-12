import { getTimeSeries, getTopicVolume, getTrendingHashtags } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { AnalyticsClient } from "./charts-client";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [series, topics, hashtags] = await Promise.all([
    getTimeSeries(90),
    getTopicVolume(),
    getTrendingHashtags(),
  ]);

  return (
    <div>
      <PageHeader title="Analytics" description="Growth, engagement and content trends across Tea." />
      <AnalyticsClient series={series} topics={topics} hashtags={hashtags} />
    </div>
  );
}
