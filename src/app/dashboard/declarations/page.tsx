"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, Loader2, ArrowRight, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { countries } from "@/lib/data/countries";
import { cn } from "@/lib/utils";
import {
  DeclarationStatusBadge,
  declarationHumanSubtitle,
  mrnSubtitleClass,
  mrnTitleClass,
  resolveDeclarationRowBadge,
  rowTintClass,
} from "@/lib/declaration-status-display";
import {
  ConvexSessionMissing,
  DeclarationLoadingSpinner,
  isConvexSessionMissing,
} from "@/components/declaration-session-states";

export default function DeclarationsPage() {
  const { user, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const userId = user?.id || "";
  const router = useRouter();

  const authReady = isClerkLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;
  const declarations = useQuery(
    api.declarations.getDeclarationPreviews,
    authReady ? {} : "skip",
  );
  const createDeclaration = useMutation(api.declarations.createDeclaration);

  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [originCountry, setOriginCountry] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [description, setDescription] = useState("");

  const deleteDecl = useMutation(api.declarations.deleteDeclaration);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: any) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this draft declaration? This will also delete all associated items.")) {
      setDeletingId(id);
      try {
        await deleteDecl({ id });
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const initialItemInfo = originCountry || description || hsCode ? {
        originCountry: originCountry || "GB",
        hsCode: hsCode || "",
        description: description || "New Item",
      } : undefined;

      const newId = await createDeclaration({
        userId,
        declarationType: "H1", // Default standard import
        status: "Draft",
        initialItem: initialItemInfo,
      });
      
      setShowCreateModal(false);
      // Navigate straight to the items view to see the pre-filled row
      router.push(`/dashboard/declarations/${newId}/items`);
    } catch (error) {
      console.error("Failed to create declaration:", error);
      setIsCreating(false);
    }
  };

  const filteredDeclarations = (declarations ?? []).filter((dec: any) => {
    const status = dec.status ?? "Draft";
    const { label: badgeLabel } = resolveDeclarationRowBadge(dec);

    if (statusFilter !== "all") {
      if (statusFilter === "needs-action") {
        if (!["Rejected", "Invalid", "Action Required"].includes(status)) return false;
      } else if (statusFilter === "Cancelled") {
        if (!badgeLabel.startsWith("Cancelled")) return false;
      } else if (status !== statusFilter) {
        return false;
      }
    }

    const term = searchQuery.toLowerCase();
    if (!term) return true;

    const mrnMatch = (dec.mrn || "Pending CDS").toLowerCase().includes(term);
    const eoriMatch = (dec.eori || "Not set").toLowerCase().includes(term);
    const statusMatch = status.toLowerCase().includes(term);
    const badgeMatch = badgeLabel.toLowerCase().includes(term);

    return mrnMatch || eoriMatch || statusMatch || badgeMatch;
  });

  const hasActiveFilters = statusFilter !== "all" || searchQuery.length > 0;

  const STATUS_FILTER_OPTIONS = [
    { value: "all", label: "All statuses" },
    { value: "Draft", label: "Draft" },
    { value: "Accepted", label: "Accepted" },
    { value: "Amended", label: "Amended" },
    { value: "Amendment Processing", label: "Amend processing" },
    { value: "needs-action", label: "Needs action" },
    { value: "Cancelled", label: "Cancelled" },
  ] as const;

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Declarations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your live HMRC CDS filings and draft entries.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={isCreating}
          className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New Declaration
        </button>
      </div>

      <div className="flex flex-col rounded-xl border border-[#e9e9e7] bg-white shadow-none">
        {/* FILTER BAR — overflow-visible so dropdown isn't clipped (reports pattern) */}
        <div className="relative z-20 overflow-visible border-b border-[#e9e9e7] bg-gray-50 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by MRN, EORI, or Status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-200 bg-white pl-8 pr-4 text-xs text-gray-700 outline-none transition-colors focus:border-gray-400"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-[0.6875rem] font-medium tracking-normal text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50",
                  statusFilter !== "all" ? "border-gray-400" : "border-gray-200",
                )}
              >
                <Filter className="h-3 w-3" />
                Filter
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 z-[120] w-44 rounded-md border border-gray-200 bg-white p-2 shadow-md">
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(option.value);
                        setShowFilters(false);
                      }}
                      className={cn(
                        "block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100",
                        statusFilter === option.value && "bg-gray-100 font-medium text-black",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-hidden">
        {isConvexSessionMissing(isClerkLoaded, Boolean(isSignedIn), isConvexAuthLoading, isAuthenticated) ? (
          <ConvexSessionMissing />
        ) : declarations === undefined ? (
          <div className="flex h-40 items-center justify-center">
            <DeclarationLoadingSpinner />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#e9e9e7] bg-gray-50">
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase w-[40%]">MRN / LRN</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">EORI</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase text-right w-[80px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9e9e7]">
                {!filteredDeclarations || filteredDeclarations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-xs italic">
                      {hasActiveFilters
                        ? "No declarations match these filters."
                        : "No declarations yet. Create your first declaration to get started."}
                    </td>
                  </tr>
                ) : (
                  filteredDeclarations.map((dec: any) => {
                    const { label: badgeLabel, tone } = resolveDeclarationRowBadge(dec);
                    const subtitleLabel = declarationHumanSubtitle(badgeLabel, dec.status, tone);

                    return (
                    <tr
                      key={dec.declarationId}
                      onClick={() => router.push(`/dashboard/declarations/${dec.declarationId}`)}
                      className={cn("group cursor-pointer transition-colors", rowTintClass(tone))}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={cn("text-xs font-semibold transition-colors", mrnTitleClass(tone))}>
                            {dec.mrn || "Pending CDS"}
                          </span>
                          <span className={cn("mt-0.5 text-[0.625rem] font-medium", mrnSubtitleClass(tone))}>
                            {subtitleLabel}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[0.6875rem] text-gray-600">{dec.eori || "Not set"}</td>
                      <td className="px-6 py-4 text-[0.6875rem] text-gray-600">{dec.declarationType || "IMD"}</td>
                      <td className="px-6 py-4">
                        <DeclarationStatusBadge tone={tone} label={badgeLabel} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          {dec.status === "Draft" && (
                            <button
                              onClick={(e) => handleDelete(e, dec.declarationId)}
                              disabled={deletingId === dec.declarationId}
                              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none"
                            >
                              {deletingId === dec.declarationId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          )}
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Declaration</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label htmlFor="origin" className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                Origin Country
              </label>
              <Select value={originCountry} onValueChange={setOriginCountry}>
                <SelectTrigger id="origin" className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700">
                  <SelectValue placeholder="Select Origin Country" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="hsCode" className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                HS Code (Optional)
              </label>
              <input
                id="hsCode"
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value)}
                placeholder="e.g. 6109100010"
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="description" className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                Description
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Portable automatic data processing machine"
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              disabled={isCreating || !originCountry || !description}
              onClick={handleCreate}
              className="flex h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-50"
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Declaration
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
