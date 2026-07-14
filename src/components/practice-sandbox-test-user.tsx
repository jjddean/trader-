"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const HMRC_TEST_USER_SIGN_IN_COPY =
  "Sign in with these credentials on the HMRC screen when you click Connect HMRC — not your live Government Gateway. Use your real EORI on declaration forms.";

function CopyValueButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-md border border-amber-200 bg-white p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-800">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-900">{value}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

interface PracticeSandboxTestUserProps {
  compact?: boolean;
  /** Subscribe to Convex while visible (e.g. modal open, Security tab) */
  enabled?: boolean;
}

export function PracticeSandboxTestUser({
  compact = false,
  enabled = true,
}: PracticeSandboxTestUserProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id || "";

  const orgHmrc = useQuery(
    api.org_hmrc.getModeForOrg,
    enabled && orgId ? { orgId } : "skip",
  );
  const stored = useQuery(
    api.org_hmrc.getSandboxTestUserForOrg,
    enabled && orgId ? { orgId } : "skip",
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCreds, setLocalCreds] = useState<{ userId: string; password: string } | null>(null);

  const provision = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hmrc/provision-test-user", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        userId?: string;
        password?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not provision HMRC test user");
      }
      if (data.userId && data.password) {
        setLocalCreds({ userId: data.userId, password: data.password });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provision failed");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  if (!enabled || !orgId || orgHmrc?.hmrcMode === "live") {
    return null;
  }

  const creds = stored ?? localCreds;
  const waitingForStored = stored === undefined;

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50/80",
        compact ? "p-3" : "p-4",
      )}
    >
      <p className="text-xs font-semibold text-amber-950">HMRC Test User (sandbox OAuth)</p>
      <p className="mt-1 text-xs leading-snug text-amber-900/90">{HMRC_TEST_USER_SIGN_IN_COPY}</p>

      <div className="mt-3 min-h-[8.25rem]">
      {waitingForStored && (
        <div className="flex items-center gap-2 text-sm text-amber-900">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      )}

      {!waitingForStored && !creds && !loading && (
        <button
          type="button"
          onClick={() => void provision()}
          className="inline-flex items-center rounded-md bg-amber-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-amber-950"
        >
          Create HMRC Test User
        </button>
      )}

      {loading && !creds && (
        <div className="flex items-center gap-2 text-sm text-amber-900">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Creating HMRC test user…
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <p className="text-[11px] text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void provision()}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-950 underline"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {creds && (
        <div className="space-y-2">
          <CopyValueButton label="User ID" value={creds.userId} />
          <CopyValueButton label="Password" value={creds.password} />
        </div>
      )}
      </div>
    </div>
  );
}

export function PracticeSandboxTestUserModalLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={className}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden border-slate-200 p-0 sm:max-w-xl">
        <div className="p-6">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <DialogTitle className="sr-only">HMRC Test User</DialogTitle>
            <PracticeSandboxTestUser compact enabled={open} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PracticeModeGuideModalLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={className}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden border-slate-200 p-0 sm:max-w-lg">
        <div className="p-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-5">
            <DialogTitle className="text-xs font-semibold text-amber-950">Test environment</DialogTitle>
            <DialogDescription asChild>
              <ul className="mt-2.5 list-disc space-y-2.5 pl-5 text-xs leading-relaxed text-amber-900/90">
                <li>
                  Connect your <strong>HMRC Test User</strong> to submit sandbox declarations.
                </li>
                <li>{HMRC_TEST_USER_SIGN_IN_COPY}</li>
                <li>
                  Validate workflows and familiarise yourself with Freightcode before enabling live
                  customs submissions. When you are ready, a platform admin can switch your
                  organisation to live CDS in <strong>Admin → Users &amp; HMRC</strong>.
                </li>
              </ul>
            </DialogDescription>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
