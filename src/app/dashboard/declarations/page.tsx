"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, Loader2, ArrowRight, FileText, ShieldCheck, ShieldAlert, AlertCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const ALL_COUNTRIES = [
  "Afghanistan", "Algeria", "Angola", "Armenia", "Bangladesh", "Benin", "Bhutan", 
  "Bolivia", "Burkina Faso", "Burundi", "Cambodia", "Cape Verde", "Central African Republic", 
  "Chad", "Comoros", "Congo", "Cook Islands", "Democratic Republic of Congo", "Djibouti", 
  "Eritrea", "Ethiopia", "Gambia", "Guinea", "Guinea-Bissau", "Haiti", "India", 
  "Indonesia", "Kiribati", "Kyrgyzstan", "Laos", "Lesotho", "Liberia", "Madagascar", 
  "Malawi", "Mali", "Mauritania", "Micronesia", "Mongolia", "Mozambique", "Myanmar", 
  "Nepal", "Niger", "Nigeria", "Niue", "Pakistan", "Philippines", "Rwanda", "Samoa", 
  "Senegal", "Sierra Leone", "Solomon Islands", "Somalia", "South Sudan", "Sri Lanka", 
  "Sudan", "Syria", "Tajikistan", "Tanzania", "Timor-Leste", "Togo", "Tuvalu", 
  "Uganda", "Uzbekistan", "Vanuatu", "Vietnam", "Yemen", "Zambia"
].sort();

export default function DeclarationsPage() {
  const { user } = useUser();
  const userId = user?.id || "";
  const router = useRouter();

  const allDeclarations = useQuery(api.declarations.getAllDecls);
  const declarations = (allDeclarations || []).filter((dec: any) => dec.userId === userId);
  const createDeclaration = useMutation(api.declarations.createDeclaration);

  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
                    {Boolean(dec.mrn && String(dec.mrn).trim().length > 0) && (dec.status === "Cleared" || dec.status === "Accepted") ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                        <ShieldCheck className="h-3 w-3" />
                        {dec.status}
                      </span>
                    ) : dec.status === "Rejected" || dec.status === "Action Required" || dec.status === "Invalid" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700">
                        <ShieldAlert className="h-3 w-3" />
                        {dec.status === "Invalid" ? "Invalid (DMSINV)" : dec.status}
                      </span>
                    ) : dec.status === "Draft" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[0.625rem] font-medium text-gray-700">
                        <FileText className="h-3 w-3" />
                        {dec.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[0.625rem] font-medium text-blue-700">
                        <AlertCircle className="h-3 w-3" />
                        {dec.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      {dec.status === "Draft" && (
                        <button
                          onClick={(e) => handleDelete(e, dec._id)}
                          disabled={deletingId === dec._id}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none"
                        >
                          {deletingId === dec._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
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
                  {ALL_COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
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
              <Select value={description} onValueChange={setDescription}>
                <SelectTrigger id="description" className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700">
                  <SelectValue placeholder="Select Cargo Description" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  <SelectItem value="Knitwear" className="text-xs">Knitwear</SelectItem>
                  <SelectItem value="Electronics" className="text-xs">Electronics</SelectItem>
                  <SelectItem value="Machinery" className="text-xs">Machinery</SelectItem>
                  <SelectItem value="Apparel" className="text-xs">Apparel</SelectItem>
                  <SelectItem value="Furniture" className="text-xs">Furniture</SelectItem>
                </SelectContent>
              </Select>
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
