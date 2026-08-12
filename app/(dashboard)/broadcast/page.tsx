import { getBroadcasts } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BroadcastComposer } from "./broadcast-composer";
import { formatDateTime, fullNumber } from "@/lib/utils";
import { Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const history = await getBroadcasts();

  return (
    <div className="space-y-8">
      <PageHeader title="Broadcast" description="Compose and send a push notification to a segment of users." />

      <BroadcastComposer />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Send history
        </h2>
        <Card className="overflow-hidden">
          {history.length === 0 ? (
            <EmptyState icon={Megaphone} title="No broadcasts sent yet" description="Your first broadcast will appear here." />
          ) : (
            <div className="divide-y divide-border">
              {history.map((b) => (
                <div key={b.id} className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{b.title}</p>
                      <Badge variant={b.status === "sent" ? "success" : b.status === "failed" ? "danger" : "warning"}>
                        {b.status}
                      </Badge>
                    </div>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{b.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.audience}
                      {b.route ? ` · → ${b.route}` : ""} · by {b.sent_by} · {formatDateTime(b.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-serif text-xl font-semibold tabular">{fullNumber(b.delivered)}</p>
                    <p className="text-xs text-muted-foreground">of {fullNumber(b.recipients)} delivered</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
