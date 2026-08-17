"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, LogOut, Camera, X } from "lucide-react";
import { AliasAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SeedPostComposer } from "@/components/seed/post-composer";
import {
  actAsProfileAction,
  stopActingAsAction,
  setSeedAvatarAction,
  removeSeedAvatarAction,
} from "@/lib/actions";
import type { SeedProfile, HashtagVolume } from "@/lib/types";

interface Topic {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export function SeedClient({
  profiles,
  topics,
  hashtags,
  actingAsId,
}: {
  profiles: SeedProfile[];
  topics: Topic[];
  hashtags: HashtagVolume[];
  actingAsId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = profiles.find((p) => p.id === actingAsId) ?? null;

  // Single hidden file input, retargeted per profile on click.
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  function pickAvatar(id: string) {
    setUploadTarget(id);
    fileRef.current?.click();
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = uploadTarget;
    e.target.value = ""; // allow re-picking the same file later
    if (!file || !id) return;
    setUploadingId(id);
    const fd = new FormData();
    fd.append("seedId", id);
    fd.append("file", file);
    startTransition(async () => {
      const res = await setSeedAvatarAction(fd);
      setUploadingId(null);
      if (res.ok) {
        toast.success("Avatar updated");
        router.refresh();
      } else toast.error(res.message ?? "Upload failed");
    });
  }

  function removeAvatar(id: string) {
    startTransition(async () => {
      const res = await removeSeedAvatarAction(id);
      if (res.ok) {
        toast.success("Avatar removed");
        router.refresh();
      } else toast.error(res.message ?? "Failed");
    });
  }

  function actAs(id: string) {
    startTransition(async () => {
      const res = await actAsProfileAction(id);
      if (res.ok) {
        toast.success(`Now acting as ${profiles.find((p) => p.id === id)?.alias ?? "profile"}`);
        router.refresh();
      } else toast.error(res.message ?? "Couldn't switch profile");
    });
  }

  function stop() {
    startTransition(async () => {
      const res = await stopActingAsAction();
      if (res.ok) {
        toast.success("Stopped acting as a profile");
        router.refresh();
      } else toast.error(res.message ?? "Failed");
    });
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input, shared by all profile avatars */}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onFilePicked}
      />

      {/* Acting-as banner */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
          active ? "border-accent/40 bg-accent/10" : "border-border bg-surface/40"
        )}
      >
        {active ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <AliasAvatar alias={active.alias} color={active.avatar_color} url={active.avatar_url} presetAvatarId={active.preset_avatar_id} size={28} />
            <div className="mr-auto">
              <span className="text-sm text-muted-foreground">Acting as </span>
              <span className="text-sm font-semibold text-foreground">{active.alias}</span>
            </div>
            <Button variant="outline" size="sm" onClick={stop} disabled={pending}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Exit
            </Button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            Not acting as anyone. Pick a profile below to post, comment, or cast verdicts as them.
          </span>
        )}
      </div>

      {/* Composer — only usable while acting as a profile */}
      {active && (
        <SeedPostComposer
          profile={{ id: active.id, alias: active.alias, avatar_color: active.avatar_color, avatar_url: active.avatar_url, preset_avatar_id: active.preset_avatar_id }}
          topics={topics}
          hashtags={hashtags}
        />
      )}

      {/* Profile grid */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          {profiles.length} seed profiles
        </p>
        {profiles.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No seed profiles yet. Run{" "}
              <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">scripts/seed_profiles.ts</code>{" "}
              to create them.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p) => {
              const isActive = p.id === actingAsId;
              return (
                <Card
                  key={p.id}
                  className={cn(
                    "transition-colors",
                    isActive ? "border-accent/50 bg-accent/[0.06]" : "hover:border-border/80"
                  )}
                >
                  <CardContent className="flex items-start gap-3 pt-5">
                    <div className="group/av relative shrink-0">
                      <AliasAvatar alias={p.alias} color={p.avatar_color} url={p.avatar_url} presetAvatarId={p.preset_avatar_id} size={40} />
                      <button
                        type="button"
                        aria-label={`Change ${p.alias}'s avatar`}
                        onClick={() => pickAvatar(p.id)}
                        disabled={pending}
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed"
                      >
                        {uploadingId === p.id ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </button>
                      {p.avatar_url && (
                        <button
                          type="button"
                          aria-label={`Remove ${p.alias}'s avatar`}
                          onClick={() => removeAvatar(p.id)}
                          disabled={pending}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-danger-foreground opacity-0 transition-opacity group-hover/av:opacity-100 focus-visible:opacity-100"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-foreground">{p.alias}</span>
                        {p.is_verified && <Badge variant="success">verified</Badge>}
                      </div>
                      {p.bio && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.bio}</p>}
                      <div className="mt-3">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Active
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => actAs(p.id)}
                            disabled={pending}
                          >
                            Act as
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
