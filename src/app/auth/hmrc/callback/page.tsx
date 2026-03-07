"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HmrcCallbackPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState("");

    const handleCallback = useAction(api.actions.hmrc.handleHmrcCallback);

    useEffect(() => {
        if (error) {
            setStatus("error");
            setErrorMessage(error);
            return;
        }

        if (code) {
            handleCallback({ code })
                .then(() => {
                    setStatus("success");
                    setTimeout(() => {
                        router.push("/dashboard/assistant");
                    }, 2000);
                })
                .catch((err) => {
                    setStatus("error");
                    setErrorMessage(err.message || "Failed to exchange HMRC code.");
                });
        }
    }, [code, error, handleCallback, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="max-w-md w-full text-center">
                <CardHeader>
                    <CardTitle>HMRC Authentication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 py-8">
                    {status === "loading" && (
                        <>
                            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                            <p className="text-sm text-muted-foreground">Exchanging authorization code with HMRC...</p>
                        </>
                    )}

                    {status === "success" && (
                        <>
                            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                            <p className="text-sm font-medium">Successfully connected to HMRC!</p>
                            <p className="text-xs text-muted-foreground">Redirecting you back to the Intelligence Hub...</p>
                        </>
                    )}

                    {status === "error" && (
                        <>
                            <XCircle className="h-12 w-12 mx-auto text-destructive" />
                            <p className="text-sm font-medium text-destructive">Connection Failed</p>
                            <p className="text-xs text-muted-foreground">{errorMessage}</p>
                            <button
                                onClick={() => router.push("/dashboard/assistant")}
                                className="mt-4 text-xs underline text-primary"
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
