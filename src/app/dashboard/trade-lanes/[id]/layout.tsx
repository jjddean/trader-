"use client";

import React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ArrowLeft, FileText, PoundSterling, Package, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TradeLaneWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const laneId = params?.id ?? "";

  const steps = [
    {
      id: "details",
      name: "1. Lane Details",
      icon: FileText,
      path: `/dashboard/trade-lanes/${laneId}`,
    },
    {
      id: "rates",
      name: "2. Rates",
      icon: PoundSterling,
      path: `/dashboard/trade-lanes/${laneId}/rates`,
      disabled: true,
    },
    {
      id: "bookings",
      name: "3. Bookings",
      icon: Package,
      path: `/dashboard/trade-lanes/${laneId}/bookings`,
      disabled: true,
    },
    {
      id: "activity",
      name: "4. Activity",
      icon: Activity,
      path: `/dashboard/trade-lanes/${laneId}/activity`,
      disabled: true,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="px-8 pt-6 pb-4">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="relative rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() => router.push("/dashboard/trade-lanes")}
              className="group absolute left-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="Back to trade lanes"
            >
              <ArrowLeft className="h-3 w-3" />
            </button>
            <div className="flex items-center justify-between gap-4 pl-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                    Trade Lane
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[0.625rem] font-medium text-slate-700">
                    Draft
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500">Awaiting setup</p>
                <p className="text-xs text-slate-500">
                  Origin: — • Destination: — • Mode: —
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[10px] font-medium tracking-widest text-slate-400 uppercase">
                  Carrier
                </p>
                <div className="mt-0.5 flex items-center justify-end gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span className="text-xs text-slate-500">Not set</span>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex gap-1 rounded-lg bg-slate-100/80 p-1">
            {steps.map((step) => {
              const isActive = pathname === step.path;
              const Icon = step.icon;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => !step.disabled && router.push(step.path)}
                  disabled={step.disabled}
                  title={step.disabled ? "This step will be available once lanes are wired." : undefined}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all",
                    isActive
                      ? "bg-white text-black shadow-sm"
                      : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-900",
                    step.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-blue-600" : "text-slate-400")} />
                  {step.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="flex-1 px-8 pb-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </div>
    </div>
  );
}
