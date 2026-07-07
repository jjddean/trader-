"use client";

import Link from "next/link";
import { TaskChooseOrganization } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function ChooseOrganizationPage() {
  const { isAuthenticated } = useConvexAuth();
  const dbUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const isAdmin = dbUser?.role === "admin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="flex flex-col items-center gap-4">
        <TaskChooseOrganization redirectUrlComplete="/dashboard" />
        {isAdmin && (
          <p className="text-center text-xs text-slate-500">
            Admin:{" "}
            <Link href="/dashboard" className="font-medium text-slate-700 underline hover:text-black">
              continue in personal workspace
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
