"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, Loader2, ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function DeclarationsPage() {
  const { user } = useUser();
  const userId = user?.id || "";
  const router = useRouter();

  const declarations = useQuery(api.declarations.getLanes, userId ? { userId } : "skip");
  const createDeclaration = useMutation(api.declarations.createDeclaration);

  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const newId = await createDeclaration({
        userId,
        declarationType: "IMD", // Default standard import
        status: "Draft",
      });
      router.push(`/dashboard/declarations/${newId}`);
    } catch (error) {
      console.error("Failed to create declaration:", error);
      setIsCreating(false);
    }
  };

  const filteredDeclarations = declarations?.filter((dec: any) => {
    const term = searchQuery.toLowerCase();
    return (
      dec.mrn?.toLowerCase().includes(term) ||
      dec.eori?.toLowerCase().includes(term) ||
      dec.status?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Customs Declarations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your live HMRC CDS filings and draft entries.
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New Declaration
        </button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by MRN, EORI, or Status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-gray-400 md:max-w-md"
          />
        </div>
        <button className="flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
          <Filter className="h-3 w-3" />
          Filter
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {declarations === undefined ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : filteredDeclarations && filteredDeclarations.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50/50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">MRN / LRN</th>
                <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">EORI</th>
                <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Type</th>
                <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Last Updated</th>
                <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-[10px]">Status</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider text-[10px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDeclarations.map((dec: any) => (
                <tr
                  key={dec._id}
                  onClick={() => router.push(`/dashboard/declarations/${dec._id}`)}
                  className="group cursor-pointer transition-colors hover:bg-gray-50/50"
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs font-semibold text-gray-900">
                      {dec.mrn || dec.mrn || "Pending CDS"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600">{dec.eori || "Not set"}</td>
                  <td className="px-6 py-4 text-xs text-gray-600">{dec.declarationType || "IMD"}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {new Date(dec.lastUpdated || dec._creationTime).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant="outline"
                      className={
                        dec.status === "Cleared"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : dec.status === "Rejected"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : dec.status === "Accepted"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-gray-50 text-gray-700"
                      }
                    >
                      {dec.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                       <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
           <div className="flex flex-col items-center justify-center py-16 text-center">
             <FileText className="mb-4 h-8 w-8 text-gray-300" />
             <h3 className="text-sm font-medium text-gray-900">No declarations found</h3>
             <p className="mt-1 text-xs text-gray-500">
               {searchQuery ? "Try adjusting your search filters." : "Create your first declaration to get started."}
             </p>
           </div>
        )}
      </div>

    </div>
  );
}
