"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-gray-900">{value}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
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
  /** Subscribe to Convex + render (false when modal closed / tab hidden) */
  enabled?: boolean;
  /** Call HMRC Create Test User API when creds missing */
  autoProvision?: boolean;
}

export function PracticeSandboxTestUser({
  compact = false,
  enabled = true,
  autoProvision = false,
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
  const provisionAttempted = useRef(false);

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

  useEffect(() => {
    if (!enabled || !autoProvision || !orgId || orgHmrc?.hmrcMode === "live") return;
    if (stored === undefined) return;
    if (stored !== null) return;
    if (provisionAttempted.current) return;
    provisionAttempted.current = true;
    void provision();
  }, [enabled, autoProvision, orgId, orgHmrc?.hmrcMode, stored, provision]);

  if (!enabled || !orgId || orgHmrc?.hmrcMode === "live") {
    return null;
  }

  const creds = stored ?? localCreds;

  const body = (
    <>
      <p className="text-xs font-medium text-amber-950">HMRC Test User (practice OAuth)</p>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-900/90">
        Sign in with these credentials on the HMRC screen when you click Connect HMRC — not your
        live Government Gateway. Use your real EORI on declaration forms.
      </p>

      {loading && !creds && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-900">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Generating HMRC test user…
        </div>
      )}

      {error && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => {
              provisionAttempted.current = false;
              void provision();
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-950 underline"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {creds && (
        <div className="mt-3 space-y-2">
          <CopyValueButton label="User ID" value={creds.userId} />
          <CopyValueButton label="Password" value={creds.password} />
        </div>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50/80",
        compact ? "p-3" : "p-4",
      )}
    >
      {body}
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
      <DialogContent className="gap-0 overflow-hidden border-gray-200 p-0 sm:max-w-xl">
        <div className="p-6">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <DialogTitle className="sr-only">HMRC Test User</DialogTitle>
            <PracticeSandboxTestUser compact enabled={open} autoProvision={open} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
