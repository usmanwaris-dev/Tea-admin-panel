"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, ImagePlus, BarChart3, X, Loader2 } from "lucide-react";
import { AliasAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea, Select, Label, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { seedPostAction, uploadSeedImageAction } from "@/lib/actions";
import type { HashtagVolume } from "@/lib/types";

interface Topic {
  id: number;
  name: string;
  icon: string;
  color: string;
}
interface ActiveProfile {
  id: string;
  alias: string;
  avatar_color: string | null;
  avatar_url: string | null;
  preset_avatar_id: string | null;
}

const MAX_IMAGES = 4;

/** A "proper post" composer for the active seed profile: text, hashtags, images, poll. */
export function SeedPostComposer({
  profile,
  topics,
  hashtags,
}: {
  profile: ActiveProfile;
  topics: Topic[];
  hashtags: HashtagVolume[];
}) {
  const router = useRouter();
  const [content, setContent] = React.useState("");
  const [topicId, setTopicId] = React.useState<number>(topics[0]?.id ?? 0);
  const [images, setImages] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [showPoll, setShowPoll] = React.useState(false);
  const [pollOptions, setPollOptions] = React.useState<string[]>(["", ""]);
  const [posting, setPosting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  function addHashtag(tag: string) {
    const token = `#${tag}`;
    if (content.includes(token)) return;
    setContent((c) => (c.trim() ? `${c.trimEnd()} ${token} ` : `${token} `));
    bodyRef.current?.focus();
  }

  function onPickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return toast.error(`Up to ${MAX_IMAGES} images.`);
    setUploading(true);
    (async () => {
      for (const file of files.slice(0, room)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await uploadSeedImageAction(fd);
        if (res.ok && res.url) setImages((prev) => [...prev, res.url!]);
        else toast.error(res.message ?? "Upload failed");
      }
      setUploading(false);
    })();
  }

  function setOption(i: number, val: string) {
    setPollOptions((opts) => opts.map((o, idx) => (idx === i ? val : o)));
  }

  function reset() {
    setContent("");
    setImages([]);
    setShowPoll(false);
    setPollOptions(["", ""]);
  }

  function submit() {
    const poll = showPoll ? pollOptions.map((o) => o.trim()).filter(Boolean) : [];
    if (!content.trim() && images.length === 0) return toast.error("Add some text or an image.");
    if (showPoll && poll.length < 2) return toast.error("A poll needs at least 2 options.");
    setPosting(true);
    (async () => {
      const res = await seedPostAction({ content, topicId, mediaUrls: images, pollOptions: poll });
      setPosting(false);
      if (res.ok) {
        toast.success(res.message ?? "Posted");
        reset();
        router.refresh();
      } else toast.error(res.message ?? "Failed to post");
    })();
  }

  const busy = posting || uploading;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2">
        <AliasAvatar alias={profile.alias} color={profile.avatar_color} url={profile.avatar_url} presetAvatarId={profile.preset_avatar_id} size={28} />
        <span className="text-sm font-medium">Post as {profile.alias}</span>
        <div className="ml-auto w-44">
          <Label htmlFor="seed-topic" className="sr-only">
            Topic
          </Label>
          <Select id="seed-topic" value={topicId} onChange={(e) => setTopicId(Number(e.target.value))}>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Textarea
        ref={bodyRef}
        rows={3}
        placeholder={`What's ${profile.alias} spilling?`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      {/* Trending hashtags */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Trending</span>
          {hashtags.slice(0, 10).map((h) => (
            <button
              key={h.tag}
              type="button"
              onClick={() => addHashtag(h.tag)}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
              title={`${h.count.toLocaleString()} posts`}
            >
              #{h.tag}
            </button>
          ))}
        </div>
      )}

      {/* Image thumbnails */}
      {(images.length > 0 || uploading) && (
        <div className="flex flex-wrap gap-2">
          {images.map((url) => (
            <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="attachment" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {uploading && (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Poll */}
      {showPoll && (
        <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Poll options (2–6)</span>
            <button type="button" onClick={() => setShowPoll(false)} className="text-xs text-muted-foreground hover:text-danger">
              Remove poll
            </button>
          </div>
          {pollOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                maxLength={80}
              />
              {pollOptions.length > 2 && (
                <button
                  type="button"
                  aria-label="Remove option"
                  onClick={() => setPollOptions((opts) => opts.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-danger"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 6 && (
            <button
              type="button"
              onClick={() => setPollOptions((opts) => [...opts, ""])}
              className="text-xs font-medium text-accent hover:underline"
            >
              + Add option
            </button>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={onPickImages}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || images.length >= MAX_IMAGES}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="mr-1.5 h-4 w-4" /> Image
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setShowPoll((s) => !s)}
          className={cn(showPoll && "text-accent")}
        >
          <BarChart3 className="mr-1.5 h-4 w-4" /> Poll
        </Button>
        <Button variant="accent" size="sm" className="ml-auto" disabled={busy} onClick={submit}>
          {posting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
          Post
        </Button>
      </div>
    </div>
  );
}
