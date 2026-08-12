"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { ConfirmAction } from "@/components/confirm-action";
import { sendBroadcastAction } from "@/lib/actions";

const AUDIENCES = [
  "All users",
  "Active last 7 days",
  "Inactive 7d+",
  "Relationships followers",
  "Work followers",
  "Verified users",
];

const ROUTES = [
  { value: "", label: "Open app (default)" },
  { value: "/feed", label: "Home feed" },
  { value: "/trending", label: "Trending" },
  { value: "/topic/1", label: "Topic: Relationships" },
  { value: "/notifications", label: "Notifications" },
];

export function BroadcastComposer() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [route, setRoute] = React.useState("");
  const [audience, setAudience] = React.useState(AUDIENCES[0]);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Compose broadcast</CardTitle>
          <CardDescription>Sent via the existing send-broadcast Edge Function.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              maxLength={65}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The tea is piping hot ☕"
            />
            <p className="text-right text-xs text-muted-foreground tabular">{title.length}/65</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              value={body}
              maxLength={178}
              onChange={(e) => setBody(e.target.value)}
              placeholder="3 stories in your topics blew up overnight. Come see."
            />
            <p className="text-right text-xs text-muted-foreground tabular">{body.length}/178</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Select id="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="route">Deep link</Label>
              <Select id="route" value={route} onChange={(e) => setRoute(e.target.value)}>
                {ROUTES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Tapping the push routes to <span className="font-mono">{route || "app home"}</span>.
            </p>
            <Button disabled={!canSend} onClick={() => setConfirmOpen(true)}>
              <Send /> Send broadcast
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live device preview */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preview</p>
        <div className="rounded-2xl border border-border bg-gradient-to-b from-surface to-background p-4">
          <div className="rounded-xl border border-border bg-elevated/80 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-accent text-accent-foreground">
                <Bell className="h-3 w-3" />
              </div>
              <span className="font-semibold uppercase tracking-wide">Tea</span>
              <span className="ml-auto">now</span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug">{title || "Notification title"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {body || "Your notification body copy shows up right here."}
            </p>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Delivered to <span className="font-medium text-foreground">{audience}</span>
          </p>
        </div>
      </div>

      <ConfirmAction
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Send this broadcast?"
        description={`This immediately pushes a notification to "${audience}". It cannot be recalled.`}
        confirmLabel="Send now"
        variant="accent"
        onConfirm={async () => {
          const res = await sendBroadcastAction({ title, body, route: route || null, audience });
          if (!res.ok) throw new Error(res.message);
          toast.success(res.message ?? "Broadcast sent");
          setTitle("");
          setBody("");
          router.refresh();
        }}
      />
    </div>
  );
}
