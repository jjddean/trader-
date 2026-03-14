import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import HmrcCallbackClient from "./callback-client";

export default function HmrcCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
          <Loader2 className="text-primary h-12 w-12 animate-spin" />
        </div>
      }
    >
      <HmrcCallbackClient />
    </Suspense>
  );
}
