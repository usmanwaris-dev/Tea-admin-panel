"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag, CheckCircle2, Coffee, Send, Sprout, Repeat2, Quote } from "lucide-react";
import Link from "next/link";
import { AliasAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TEA } from "@/components/content/post-view";
import {
  getActingAsProfile,
  seedVerdictAction,
  seedCommentAction,
  seedRepostAction,
  seedQuoteAction,
  type ActingAsProfile,
} from "@/lib/actions";
import type { VerdictType } from "@/lib/types";

/**
 * Seed-as-profile controls inside the post drawer: cast a verdict or comment on
 * this post as the currently-active seed profile. Hidden entirely unless the
 * admin has picked a profile on the Seed Profiles page.
 */
export function SeedActions({ postId, onCommented }: { postId: number; onCommented?: () => void }) {
  const router = useRouter();
  const [profile, setProfile] = React.useState<ActingAsProfile | null | undefined>(undefined);
  const [content, setContent] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [showQuote, setShowQuote] = React.useState(false);
  const [quoteText, setQuoteText] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    getActingAsProfile()
      .then((p) => !cancelled && setProfile(p))
      .catch(() => !cancelled && setProfile(null));
    return () => {
      cancelled = true;
    };
  }, []);

  // Still loading — render nothing to avoid a flash.
  if (profile === undefined) return null;

  // Not acting as anyone: a quiet hint with a link to pick a profile.
  if (profile === null) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface/40 px-4 py-3 text-xs text-muted-foreground">
        <Sprout className="h-3.5 w-3.5 shrink-0" />
        <span>
          Pick a profile on the{" "}
          <Link href="/seed" className="font-medium text-accent hover:underline">
            Seed Profiles
          </Link>{" "}
          page to comment or cast a verdict as them.
        </span>
      </div>
    );
  }

  async function castVerdict(type: VerdictType) {
    setBusy(true);
    try {
      const res = await seedVerdictAction(postId, type);
      if (res.ok) {
        toast.success(res.message ?? "Verdict cast");
        router.refresh();
      } else toast.error(res.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function comment() {
    if (!content.trim()) return toast.error("Write a comment first");
    setBusy(true);
    try {
      const res = await seedCommentAction(postId, content);
      if (res.ok) {
        toast.success(res.message ?? "Commented");
        setContent("");
        onCommented?.();
        router.refresh();
      } else toast.error(res.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function repost() {
    setBusy(true);
    try {
      const res = await seedRepostAction(postId);
      if (res.ok) {
        toast.success(res.message ?? "Reposted");
        router.refresh();
      } else toast.error(res.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function quote() {
    if (!quoteText.trim()) return toast.error("Add a comment to quote with");
    setBusy(true);
    try {
      const res = await seedQuoteAction(postId, quoteText);
      if (res.ok) {
        toast.success(res.message ?? "Quoted");
        setQuoteText("");
        setShowQuote(false);
        router.refresh();
      } else toast.error(res.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-3 rounded-lg border border-accent/40 bg-accent/[0.06] p-4">
      <div className="flex items-center gap-2 text-xs">
        <AliasAvatar alias={profile.alias} color={profile.avatar_color} url={profile.avatar_url} presetAvatarId={profile.preset_avatar_id} size={22} />
        <span className="text-muted-foreground">Acting as</span>
        <span className="font-semibold text-foreground">{profile.alias}</span>
      </div>

      {/* Verdict */}
      <div className="flex flex-wrap gap-2">
        <VerdictButton icon={Flag} label="Red flag" color={TEA.redFlag} disabled={busy} onClick={() => castVerdict("red_flag")} />
        <VerdictButton icon={CheckCircle2} label="Green flag" color={TEA.greenFlag} disabled={busy} onClick={() => castVerdict("green_flag")} />
        <VerdictButton icon={Coffee} label="Same" color={TEA.sip} disabled={busy} onClick={() => castVerdict("same")} />
      </div>

      {/* Comment */}
      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          placeholder={`Comment as ${profile.alias}…`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[40px] flex-1"
        />
        <Button variant="accent" size="sm" disabled={busy || !content.trim()} onClick={comment}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> Comment
        </Button>
      </div>

      {/* Repost / Quote */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <Button variant="outline" size="sm" disabled={busy} onClick={repost}>
          <Repeat2 className="mr-1.5 h-4 w-4" /> Repost
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setShowQuote((s) => !s)}
          className={cn(showQuote && "text-accent")}
        >
          <Quote className="mr-1.5 h-4 w-4" /> Quote
        </Button>
      </div>
      {showQuote && (
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            placeholder={`Quote this post as ${profile.alias}…`}
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
            className="min-h-[40px] flex-1"
          />
          <Button variant="accent" size="sm" disabled={busy || !quoteText.trim()} onClick={quote}>
            <Quote className="mr-1.5 h-3.5 w-3.5" /> Post quote
          </Button>
        </div>
      )}
    </div>
  );
}

function VerdictButton({
  icon: Icon,
  label,
  color,
  disabled,
  onClick,
}: {
  icon: any;
  label: string;
  color: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <Icon className="h-4 w-4" style={{ color }} />
      {label}
    </button>
  );
}
