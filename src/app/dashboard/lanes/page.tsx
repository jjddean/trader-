"use client";

import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Globe, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { dctsCountries } from "@/lib/data/stub-dcts";

export default function LanesPage() {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id || "";

  type Lane = {
    _id: string;
    originCountry: string;
    commodityCode: string;
    description: string;
    tier: string;
    status: string;
    savingsEstimate?: number;
  };

  const lanes = useQuery(api.trade_lanes.getLanes, userId ? { userId } : "skip") as unknown as
    | Lane[]
    | undefined;

  const [open, setOpen] = useState(false);
  const createLane = useMutation(api.trade_lanes.createLane);
  const [form, setForm] = useState({
    originCountry: "",
    commodityCode: "",
    description: "",
    tier: "Enhanced",
    status: "Review",
  });
  const [submitting, setSubmitting] = useState(false);

  // Automated data entry options (click-only)
  const COUNTRIES = dctsCountries.map((c) => c.name).sort();


  const onCreate = async () => {
    if (!userId || !form.originCountry || !form.description) return;
    setSubmitting(true);
    try {
      await createLane({
        userId,
        originCountry: form.originCountry,
        commodityCode: form.commodityCode || "000000",
        description: form.description,
        tier: form.tier,
        status: form.status,
        savingsEstimate: 0,
      });
      setOpen(false);
      setForm({
        originCountry: "",
        commodityCode: "",
        description: "",
        tier: "Enhanced",
        status: "Review",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Declarations</h1>
          <p className="text-sm text-gray-500">Create, review, and track HMRC CDS submissions.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="h-8">
          <Plus className="mr-1 h-4 w-4" />
          Create Declaration
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
        <div className="border-b border-[#e9e9e7] bg-[#fbfbfa] px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">
          Your Declarations
        </div>

        {lanes && lanes.length > 0 ? (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#fbfbfa]">
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">
                  Origin
                </th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">
                  HS
                </th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">
                  Tier
                </th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9e9e7]">
              {lanes.map((lane) => (
                <tr
                  key={lane._id}
                  className="group cursor-pointer transition-colors hover:bg-[#f7f7f5]"
                  onClick={() => router.push(`/dashboard/lanes/${lane._id}`)}
                >
                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-black">{lane.description}</p>
                  </td>
                  <td className="px-6 py-4 text-[0.6875rem] text-gray-600">{lane.originCountry}</td>
                  <td className="px-6 py-4 font-mono text-[0.6875rem] text-gray-600">
                    {lane.commodityCode}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[0.625rem] font-medium",
                        lane.tier === "Comprehensive"
                          ? "bg-green-100 text-green-700"
                          : lane.tier === "Enhanced"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700",
                      )}
                    >
                      {lane.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[0.625rem] font-medium",
                        lane.status === "Verified"
                          ? "bg-green-100 text-green-700"
                          : lane.status === "Review"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-700",
                      )}
                    >
                      {lane.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
              <Globe className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="mb-1 text-sm font-normal text-gray-600">No Declarations</h3>
            <p className="mb-4 text-xs text-gray-400">Create your first declaration to begin.</p>
            <Button onClick={() => setOpen(true)} className="h-8">
              <Plus className="mr-1 h-4 w-4" />
              Create Declaration
            </Button>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-gray-200 bg-white shadow-lg">
          <DialogHeader>
            <DialogTitle>Create Declaration</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                Origin Country
              </label>
              <Select
                value={form.originCountry || undefined}
                onValueChange={(val) => {
                  setForm((f) => ({
                    ...f,
                    originCountry: val || "",
                  }));
                }}
              >
                <SelectTrigger className="h-9 w-full border-gray-200 bg-gray-50 text-xs text-gray-700">
                  <SelectValue placeholder="e.g., Bangladesh" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                HS Code (optional)
              </label>
              <input
                value={form.commodityCode}
                onChange={(e) => setForm((f) => ({ ...f, commodityCode: e.target.value }))}
                placeholder="e.g., 6109"
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:ring-0 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                Description
              </label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g., Knitwear to UK under DCTS"
                className="focus:border-ring focus:ring-ring/50 h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-[color,box-shadow] outline-none focus:ring-[2px]"
              />
            </div>
            <div className="flex items-center justify-end">
              <Button
                onClick={onCreate}
                disabled={submitting || !userId || !form.originCountry || !form.description}
              >
                {submitting ? "Creating..." : "Create Declaration"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
