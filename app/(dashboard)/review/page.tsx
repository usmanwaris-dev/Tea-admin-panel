import { PageHeader } from "@/components/page-header";
import { ReviewClient } from "./review-client";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  return (
    <div>
      <PageHeader
        title="Review Queue"
        description="Posts held for review after tripping a content detector. They're hidden from public feeds and visible only to their author until you decide — approve to publish, or keep removed."
      />
      <ReviewClient />
    </div>
  );
}
