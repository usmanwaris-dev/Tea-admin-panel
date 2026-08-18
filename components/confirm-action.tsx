"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

interface ConfirmActionProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "danger" | "default" | "accent";
  /** When true, a reason is required and passed to onConfirm (goes to the audit log). */
  requireReason?: boolean;
  /** When true, a reason textarea is shown but may be left blank (still audited). */
  optionalReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => Promise<void> | void;
  successMessage?: string;
}

export function ConfirmAction({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  requireReason = false,
  optionalReason = false,
  reasonLabel = "Reason",
  reasonPlaceholder = "This is recorded in the audit log…",
  onConfirm,
  successMessage,
}: ConfirmActionProps) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setBusy(false);
    }
  }, [open]);

  const showReason = requireReason || optionalReason;
  const disabled = busy || (requireReason && reason.trim().length < 3);

  async function handle() {
    if (disabled) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      if (successMessage) toast.success(successMessage);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose}>
      <div className="mb-4 flex items-start gap-3">
        {variant === "danger" && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
            <AlertTriangle className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1">
          <DialogHeader title={title} description={description} />
        </div>
      </div>

      {showReason && (
        <div className="space-y-2">
          <Label htmlFor="reason">
            {reasonLabel}{" "}
            {requireReason ? (
              <span className="text-danger">*</span>
            ) : (
              <span className="text-muted-foreground">(optional)</span>
            )}
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Recorded against your admin identity in the audit log.
          </p>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={variant === "default" ? "default" : variant} onClick={handle} disabled={disabled}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
