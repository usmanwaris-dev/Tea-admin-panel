"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Bell, Users, TestTube } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { ConfirmAction } from "@/components/confirm-action";
import { sendBroadcastAction } from "@/lib/actions";

const ROUTES = [
  { value: "", label: "Open app (default)" },
  { value: "/feed", label: "Home feed" },
  { value: "/trending", label: "Trending" },
  { value: "/topic/1", label: "Topic: Red Flags" },
  { value: "/notifications", label: "Notifications" },
];

export function BroadcastComposer() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [route, setRoute] = React.useState("");
  const [testToken, setTestToken] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState<"" | "preview" | "test">("");

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  async function dryRun() {
    if (!canSend) return;
    setBusy("preview");
    try {
      const res = await sendBroadcastAction({ title, body, route: route || null, dryRun: true });
      if (!res.ok) throw new Error(res.message);
      setPreview(res.recipients ?? 0);
      toast.success(res.message ?? "Preview ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy("");
    }
  }

  async function sendTest() {
    if (!canSend || !testToken.trim()) return;
    setBusy("test");
    try {
      const res = await sendBroadcastAction({ title, body, route: route || null, testToken: testToken.trim() });
      if (!res.ok) throw new Error(res.message);
      toast.success(res.message ?? "Test sent");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy("");
    }
  }

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

          <div className="space-y-2">
            <Label htmlFor="route">Deep link on tap</Label>
            <Select id="route" value={route} onChange={(e) => setRoute(e.target.value)}>
              {ROUTES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Audience reality: the function targets everyone with a saved token. */}
          <div className="flex items-start gap-2 rounded-md border border-border bg-surface/50 p-3 text-sm">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Audience: everyone with notifications enabled</p>
              <p className="text-xs text-muted-foreground">
                The Edge Function sends to all users with a saved device token — there is no segment
                targeting. Use <span className="font-medium">Preview count</span> or a{" "}
                <span className="font-medium">test send</span> before broadcasting.
              </p>
            </div>
          </div>

          {/* Safe testing tools */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <Label htmlFor="token" className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <TestTube className="h-3.5 w-3.5" /> Test to a single device (FCM token)
            </Label>
            <div className="flex gap-2">
              <Input
                id="token"
                value={testToken}
                onChange={(e) => setTestToken(e.target.value)}
                placeholder="Paste your own device's FCM token…"
                className="font-mono text-xs"
              />
              <Button variant="outline" size="sm" disabled={!canSend || !testToken.trim() || busy === "test"} onClick={sendTest}>
                {busy === "test" ? "Sending…" : "Send test"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" disabled={!canSend || busy === "preview"} onClick={dryRun}>
                {busy === "preview" ? "Checking…" : "Preview count"}
              </Button>
              {preview != null && (
                <span className="text-sm text-muted-foreground tabular">
                  {preview.toLocaleString()} devices
                </span>
              )}
            </div>
            <Button variant="accent" disabled={!canSend} onClick={() => setConfirmOpen(true)}>
              <Send /> Send to everyone
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
            Taps open <span className="font-mono">{route || "app home"}</span>
          </p>
        </div>
      </div>

      <ConfirmAction
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Send to everyone?"
        description="This immediately pushes a notification to every user with notifications enabled. It cannot be recalled."
        confirmLabel="Send now"
        variant="accent"
        onConfirm={async () => {
          const res = await sendBroadcastAction({ title, body, route: route || null });
          if (!res.ok) throw new Error(res.message);
          toast.success(res.message ?? "Broadcast sent");
          setTitle("");
          setBody("");
          setPreview(null);
          router.refresh();
        }}
      />
    </div>
  );
}
