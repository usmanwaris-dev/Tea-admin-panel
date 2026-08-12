import { Suspense } from "react";
import { Wordmark } from "@/components/shell/wordmark";
import { IS_MOCK } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Wordmark className="scale-125" />
          <div>
            <h1 className="font-serif text-2xl font-semibold">Admin console</h1>
            <p className="mt-1 text-sm text-muted-foreground">Moderation & operations for Tea.</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-xl">
          <Suspense fallback={<div className="h-40 skeleton rounded-md" />}>
            <LoginForm isMock={IS_MOCK} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Restricted to authorized admins. All actions are logged.
        </p>
      </div>
    </div>
  );
}
