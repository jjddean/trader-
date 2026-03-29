"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const userData = useQuery(api.users.current);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (userData === undefined) return; // Wait for loading (Convex useQuery returns undefined)

    if (!userData || userData.role !== "admin") {
      router.push("/dashboard");
    } else {
      setAuthorized(true);
    }
  }, [userData, router]);

  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
