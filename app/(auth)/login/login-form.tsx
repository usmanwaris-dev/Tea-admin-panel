"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ isMock }: { isMock: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const denied = params.get("denied") === "1";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
      setBusy(false);
    }
  }

  if (isMock) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-border bg-surface/60 p-3 text-sm text-muted-foreground">
          Running in <span className="font-medium text-foreground">demo mode</span> with mock data — no
          sign-in required. Configure Supabase + the <span className="font-mono text-xs">admins</span> table
          to enable real email auth.
        </div>
        <Button className="w-full" onClick={() => router.push(next)}>
          Enter dashboard <ArrowRight />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {denied && (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          That account isn't an admin. Ask an owner to add you to the <span className="font-mono">admins</span> table.
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@getsnippet.co" autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        <LogIn /> {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
