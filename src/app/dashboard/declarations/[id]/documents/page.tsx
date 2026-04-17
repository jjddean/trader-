"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function DocumentsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  useEffect(() => {
    if (!id) return;
    router.replace(`/dashboard/documents?declaration=${encodeURIComponent(id)}`);
  }, [id, router]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      <div>
        <p className="text-sm font-medium text-gray-900">Redirecting to unified Documents flow…</p>
        <p className="mt-1 text-xs text-gray-500">Your declaration context is preserved.</p>
      </div>
    </div>
  );
}
