"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HmrcCallbackClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const handleCallback = useAction(api.actions.hmrc.handleHmrcCallback);

  useEffect(() => {
    if (error) return;

    if (code) {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      handleCallback({ code })
        .then(() => {
          setStatus("success");
          timeoutId = setTimeout(() => {
            router.push("/dashboard/assistant");
          }, 2000);
        })
        .catch((err) => {
          setStatus("error");
          setErrorMessage(err.message || "Failed to exchange HMRC code.");
        });

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    }
  }, [code, error, handleCallback, router]);

  const shownStatus = error ? "error" : status;
  const shownErrorMessage = error || errorMessage;

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>HMRC Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 py-8">
          {shownStatus === "loading" && (
            <>
              <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Exchanging authorization code with HMRC...
              </p>
            </>
          )}

          {shownStatus === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <p className="text-sm font-medium">Successfully connected to HMRC!</p>
              <p className="text-muted-foreground text-xs">
                Redirecting you back to the Intelligence Hub...
              </p>
            </>
          )}

          {shownStatus === "error" && (
            <>
              <XCircle className="text-destructive mx-auto h-12 w-12" />
              <p className="text-destructive text-sm font-medium">Connection Failed</p>
              <p className="text-muted-foreground text-xs">{shownErrorMessage}</p>
              <button
                onClick={() => router.push("/dashboard/assistant")}
                className="text-primary mt-4 text-xs underline"
              >
                Back to Dashboard
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
