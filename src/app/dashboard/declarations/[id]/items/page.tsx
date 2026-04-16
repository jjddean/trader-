"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Plus, Trash2, UploadCloud, Loader2, Sparkles, AlertCircle } from "lucide-react";
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

export default function GoodsItemsPage() {
  const params = useParams<{ id: string }>();
  const declarationId = params?.id as Id<"declarations">;
  
  const items = useQuery(api.goods_items.getItems, declarationId ? { declarationId } : "skip");
  const addItem = useMutation(api.goods_items.addItem);
  const removeItem = useMutation(api.goods_items.removeItem);
  const updateItem = useMutation(api.goods_items.updateItem);

  const [isUploading, setIsUploading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const [originCountry, setOriginCountry] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [description, setDescription] = useState("");

  // Controlled local state for document fields: { [itemId]: [{code,ref}, {code,ref}, {code,ref}] }
  // React owns the display values; Convex is only written on blur. Eliminates the race condition
  // where the code blur saved [] to Convex before the ref blur fired.
  const [docEdits, setDocEdits] = useState<Record<string, Array<{ code: string; ref: string }>>>({});
  // Prevent re-initialising slots the user is actively editing
  const docEditsTouched = useRef<Set<string>>(new Set());

  type AdditionalDocumentInput = { CategoryCode: string; TypeCode: string; ID: string };
  type GoodsItemRow = { _id: Id<"goods_items">; [key: string]: unknown };

  const getNormalizedDocs = (item: Record<string, unknown>) => {
    const source = Array.isArray(item?.additionalDocuments)
      ? item.additionalDocuments
      : Array.isArray(item?.additionalDocument)
        ? item.additionalDocument
        : [];

    return source
      .map((doc): AdditionalDocumentInput => {
        const sourceDoc = typeof doc === "object" && doc !== null ? doc as Record<string, unknown> : {};
        return {
          CategoryCode: String(sourceDoc.CategoryCode || sourceDoc.categoryCode || sourceDoc.category || "").trim().toUpperCase(),
          TypeCode: String(sourceDoc.TypeCode || sourceDoc.typeCode || sourceDoc.type || "").trim().toUpperCase(),
          ID: String(sourceDoc.ID || sourceDoc.id || sourceDoc.reference || "").trim(),
        };
      })
      .filter((doc) => doc.CategoryCode || doc.TypeCode || doc.ID);
  };

  const getDocCell = (item: Record<string, unknown>, index: number) => {
    const docs = getNormalizedDocs(item);
    const doc = docs[index];
    if (!doc) return { code: "", ref: "" };
    const mergedCode = `${doc.CategoryCode}${doc.TypeCode}`.trim();
    return { code: mergedCode, ref: doc.ID || "" };
  };

  // Seed docEdits from Convex when items first load (once per item, never overwrites user edits)
  useEffect(() => {
    if (!items) return;
    setDocEdits(prev => {
      const next = { ...prev };
      for (const item of items) {
        const id = item._id as string;
        if (!docEditsTouched.current.has(id)) {
          const docs = getNormalizedDocs(item as Record<string, unknown>);
          next[id] = [0, 1, 2].map(i => ({
            code: docs[i] ? `${docs[i].CategoryCode}${docs[i].TypeCode}` : "",
            ref: docs[i]?.ID || "",
          }));
        }
      }
      return next;
    });
  }, [items]);

  const CHED_TYPES = ["853", "851", "C085", "C084"];

  // N + CHED types (853, 851, C085, C084) → XW (post Oct 2025 HMRC change).
  // Y929, Y930 → XB (LPCOExemptionCode per TDR_Integration_Reference §7).
  // All other codes: leave blank.
  const deriveStatusCode = (category: string, type: string) => {
    if (category === "N" && CHED_TYPES.includes(type)) return "XW";
    if (category === "Y" && ["929", "930"].includes(type)) return "XB";
    return "";
  };

  const handleDocChange = (itemId: string, slotIndex: number, part: "code" | "ref", value: string) => {
    docEditsTouched.current.add(itemId);
    setDocEdits(prev => {
      const current = prev[itemId] ?? [{ code: "", ref: "" }, { code: "", ref: "" }, { code: "", ref: "" }];
      const updated = current.map((slot, i) => i === slotIndex ? { ...slot, [part]: value } : slot);
      return { ...prev, [itemId]: updated };
    });
  };

  const handleDocBlur = async (item: GoodsItemRow) => {
    const itemId = item._id as string;
    const slots = docEdits[itemId];
    if (!slots) return;
    try {
      const validDocs = slots
        .map(slot => {
          const raw = slot.code.replace(/\s+/g, "").trim().toUpperCase();
          const category = raw.slice(0, 1);
          const type = raw.slice(1);
          return {
            CategoryCode: category,
            TypeCode: type,
            ID: slot.ref.trim(),
            StatusCode: raw ? deriveStatusCode(category, type) : "",
          };
        })
        .filter(doc => doc.CategoryCode && doc.TypeCode && doc.ID);
      await updateItem({ id: item._id, additionalDocuments: validDocs });
      docEditsTouched.current.delete(itemId);
    } catch (err) {
      console.error("Failed to save documents:", err);
    }
  };

  const handleItemFieldBlur = async (
    itemId: Id<"goods_items">,
    field: "description" | "commodityCode" | "originCountry" | "valueAmount" | "procedureCode" | "additionalProcedureCode" | "grossWeightKg" | "netWeightKg",
    value: string,
  ) => {
    try {
      if (field === "commodityCode") {
        const cleaned = value.trim();
        if (cleaned.length !== 10 || !/^\d{10}$/.test(cleaned)) {
          setFieldErrors(prev => ({ ...prev, [`${itemId}-commodityCode`]: "Must be exactly 10 digits" }));
          return;
        }
        setFieldErrors(prev => ({ ...prev, [`${itemId}-commodityCode`]: "" }));
        await updateItem({ id: itemId, commodityCode: cleaned });
        return;
      }
      
      if (field === "originCountry") {
        const cleaned = value.trim().toUpperCase();
        if (cleaned.length !== 2 || !/^[A-Z]{2}$/.test(cleaned)) {
          setFieldErrors(prev => ({ ...prev, [`${itemId}-originCountry`]: "Must be exactly 2 letters" }));
          return;
        }
        setFieldErrors(prev => ({ ...prev, [`${itemId}-originCountry`]: "" }));
        await updateItem({ id: itemId, originCountry: cleaned });
        return;
      }

      if (field === "valueAmount") {
        await updateItem({ id: itemId, valueAmount: Number(value) || 0 });
        return;
      }

      if (field === "grossWeightKg") {
        await updateItem({ id: itemId, grossWeightKg: Number(value) || 0 });
        return;
      }

      if (field === "netWeightKg") {
        await updateItem({ id: itemId, netWeightKg: Number(value) || 0 });
        return;
      }

      const sanitizedValue = value.trim();
      await updateItem({
        id: itemId,
        [field]: sanitizedValue,
      });
    } catch (err) {
      console.error("Failed to update item field:", err);
    }
  };

  const handleManualAdd = async () => {
    setIsAdding(true);
    try {
      await addItem({
        declarationId,
        sequenceNumber: (items?.length || 0) + 1,
        commodityCode: hsCode.trim() || "",
        description: description.trim() || "New Item",
        originCountry: originCountry.trim().toUpperCase() || "GB",
        procedureCode: "4000",
        valueAmount: 0,
        valueCurrency: "GBP",
      });
      setShowAddRowModal(false);
      setHsCode("");
      setDescription("");
      setOriginCountry("");
    } catch (err) {
      console.error("Failed to add row:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setAiError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Hit our existing AWS Textract + Groq endpoint
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to extract invoice data.");
      }

      // Automatically add the extracted items to Convex (Acting as the Human-in-the-Loop review staging)
      if (data.items && Array.isArray(data.items)) {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          await addItem({
            declarationId,
            sequenceNumber: (items?.length || 0) + i + 1,
            commodityCode: String(item.commodityCode || "").trim(),
            description: String(item.description || "Unknown Item").trim(),
            originCountry: String(item.originCountry || "GB").trim().toUpperCase(),
            procedureCode: "4000", // Default to home use
            valueAmount: Number(item.valueAmount) || 0,
            valueCurrency: item.valueCurrency || "GBP",
          });
        }
      }

    } catch (err: unknown) {
      console.error("AI Extraction failed:", err);
      setAiError(err instanceof Error ? err.message : "Failed to extract invoice data.");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  if (items === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Goods Items</h2>
          <p className="mt-1 text-xs text-gray-500">
            Define the physical commodities in this shipment. Required for WCO payload.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
             <input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleAIUpload}
                disabled={isUploading}
                className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
             />
             <button
               disabled={isUploading}
               className="flex h-9 items-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-4 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
             >
               {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
               {isUploading ? "Extracting JSON with Groq..." : "AI Auto-Fill (Invoice PDF)"}
             </button>
          </div>
          
          <button
            onClick={() => setShowAddRowModal(true)}
            className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>
        </div>
      </div>

      {aiError && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-xs text-red-600 border border-red-100">
          <AlertCircle className="h-4 w-4" />
          <span className="font-medium">Extraction Failed:</span> {aiError}
        </div>
      )}

      {/* Mandatory Human-in-the-Loop Review Banner */}
      {items.length > 0 && (
         <div className="flex items-center gap-2 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800 border border-yellow-200">
          <InfoIcon className="h-4 w-4 text-yellow-600" />
          <p>
             <strong>Important:</strong> According to HMRC guidelines, you are legally responsible for verifying all AI-extracted fields below before submission.
          </p>
         </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50/40 px-4 py-2 text-[11px] text-gray-500">
          Scroll horizontally to edit all fields, including document codes and references.
        </div>
        {items.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="min-w-[2200px] w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50/50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Seq</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Description</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">HS Code</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Origin</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Value</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">CPC (DE 1/10)</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Add. Proc (DE 1/11)</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Gross KG</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Net KG</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Doc Code 1</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Doc Ref 1</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Doc Code 2</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Doc Ref 2</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Doc Code 3</th>
                <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider text-[11px]">Doc Ref 3</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item: GoodsItemRow, index: number) => (
                <tr key={item._id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-400">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      defaultValue={String(item.description ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "description", e.target.value)}
                      className="w-full bg-transparent text-xs font-medium text-gray-900 outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="text"
                      defaultValue={String(item.commodityCode ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "commodityCode", e.target.value)}
                      placeholder="e.g. 6109100010"
                      className={`w-28 rounded border p-1 font-mono text-xs text-gray-700 outline-none focus:bg-white ${fieldErrors[`${item._id}-commodityCode`] ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-transparent bg-transparent hover:border-gray-200 focus:border-blue-500'}`}
                    />
                    {fieldErrors[`${item._id}-commodityCode`] && (
                      <div className="mt-1 text-[10px] text-red-500 max-w-[120px] leading-tight">{fieldErrors[`${item._id}-commodityCode`]}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="text"
                      defaultValue={String(item.originCountry ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "originCountry", e.target.value)}
                      placeholder="e.g. GB"
                      className={`w-12 rounded border p-1 font-mono text-xs text-gray-700 outline-none focus:bg-white ${fieldErrors[`${item._id}-originCountry`] ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-transparent bg-transparent hover:border-gray-200 focus:border-blue-500'}`}
                    />
                    {fieldErrors[`${item._id}-originCountry`] && (
                      <div className="mt-1 text-[10px] text-red-500 max-w-[80px] leading-tight">{fieldErrors[`${item._id}-originCountry`]}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">{String(item.valueCurrency ?? "")}</span>
                      <input
                        type="number"
                        defaultValue={Number(item.valueAmount ?? 0)}
                        onBlur={(e) => handleItemFieldBlur(item._id, "valueAmount", e.target.value)}
                        className="w-20 rounded border border-transparent bg-transparent p-1 text-xs text-gray-700 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="text"
                      defaultValue={String(item.procedureCode ?? "4000")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "procedureCode", e.target.value)}
                      placeholder="4000"
                      className="w-16 rounded border border-transparent bg-transparent p-1 font-mono text-xs text-gray-700 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="text"
                      defaultValue={String(item.additionalProcedureCode ?? "000")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "additionalProcedureCode", e.target.value)}
                      placeholder="000"
                      className="w-14 rounded border border-transparent bg-transparent p-1 font-mono text-xs text-gray-700 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="number"
                      defaultValue={item.grossWeightKg != null ? Number(item.grossWeightKg) : ""}
                      onBlur={(e) => handleItemFieldBlur(item._id, "grossWeightKg", e.target.value)}
                      placeholder="kg"
                      className="w-16 rounded border border-transparent bg-transparent p-1 text-xs text-gray-700 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="number"
                      defaultValue={item.netWeightKg != null ? Number(item.netWeightKg) : ""}
                      onBlur={(e) => handleItemFieldBlur(item._id, "netWeightKg", e.target.value)}
                      placeholder="kg"
                      className="w-16 rounded border border-transparent bg-transparent p-1 text-xs text-gray-700 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white"
                    />
                  </td>
                  {[0, 1, 2].map(slotIdx => (
                    <React.Fragment key={slotIdx}>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="text"
                          value={docEdits[item._id as string]?.[slotIdx]?.code ?? getDocCell(item, slotIdx).code}
                          onChange={(e) => handleDocChange(item._id as string, slotIdx, "code", e.target.value)}
                          onBlur={() => handleDocBlur(item)}
                          placeholder={slotIdx === 0 ? "e.g. N853" : "e.g. Y929"}
                          className="w-20 rounded border border-transparent bg-transparent p-1 font-mono text-xs text-gray-700 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white"
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="text"
                          value={docEdits[item._id as string]?.[slotIdx]?.ref ?? getDocCell(item, slotIdx).ref}
                          onChange={(e) => handleDocChange(item._id as string, slotIdx, "ref", e.target.value)}
                          onBlur={() => handleDocBlur(item)}
                          placeholder="Reference"
                          className="w-40 rounded border border-transparent bg-transparent p-1 text-xs text-gray-700 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white"
                        />
                      </td>
                    </React.Fragment>
                  ))}
                  <td className="px-4 py-3 text-right">
                     <button
                        onClick={() => removeItem({ id: item._id })}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                     >
                        <Trash2 className="h-4 w-4" />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
           <div className="flex flex-col items-center justify-center py-20 text-center">
             <UploadCloud className="mb-4 h-8 w-8 text-gray-300" />
             <h3 className="text-sm font-medium text-gray-900">No goods items yet</h3>
             <p className="mt-1 text-xs text-gray-500 max-w-sm">
               You can manually add rows or use our AI to automatically extract the line items from your commercial invoice PDF.
             </p>
           </div>
        )}
      </div>

      <Dialog open={showAddRowModal} onOpenChange={setShowAddRowModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Goods Item</DialogTitle>
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Frozen plucked chickens"
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              disabled={isAdding || !originCountry || !description}
              onClick={handleManualAdd}
              className="flex h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-50"
            >
              {isAdding && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Row
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Quick helper icon for the banner
function InfoIcon(props: React.ComponentPropsWithoutRef<"svg">) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}
