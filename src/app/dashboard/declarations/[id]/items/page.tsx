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

  // Batch pending field updates per item — flushed as a single updateItem call after 600ms idle.
  // Prevents one mutation per field blur (e.g. tabbing through 8 fields = 8 mutations → 1).
  const pendingUpdates = useRef<Record<string, Record<string, unknown>>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const scheduleUpdate = (itemId: string, field: string, value: unknown) => {
    if (!pendingUpdates.current[itemId]) pendingUpdates.current[itemId] = {};
    pendingUpdates.current[itemId][field] = value;

    clearTimeout(debounceTimers.current[itemId]);
    debounceTimers.current[itemId] = setTimeout(async () => {
      const updates = pendingUpdates.current[itemId];
      if (!updates || Object.keys(updates).length === 0) return;
      delete pendingUpdates.current[itemId];
      try {
        await updateItem({ id: itemId as Id<"goods_items">, ...updates } as any);
      } catch (err) {
        console.error("Failed to save item updates:", err);
      }
    }, 600);
  };

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
          // Always seed >= 6 slots so the editor has room for new entries, but
          // never truncate existing docs — earlier hardcoded length of 6 was
          // dropping AdditionalDocument rows >= index 6 on save.
          const slotCount = Math.max(6, docs.length);
          next[id] = Array.from({ length: slotCount }, (_, i) => ({
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

  const DOC_SLOT_HINTS: Array<{ label: string; code: string; ref: string }> = [
    { label: "CHED-P (live-animal / POAO)", code: "N853", ref: "GBCHD2026.1234567" },
    { label: "Organic statement waiver", code: "Y929", ref: "Excluded" },
    { label: "Non-organic statement", code: "Y930", ref: "Excluded" },
    { label: "Commercial invoice", code: "N935", ref: "INV-2026-04112" },
    { label: "Packing list", code: "N271", ref: "PL-2026-04112" },
    { label: "Spare slot", code: "", ref: "" },
  ];

  const emptySlots = () => [0, 1, 2, 3, 4, 5].map(() => ({ code: "", ref: "" }));

  const handleDocChange = (itemId: string, slotIndex: number, part: "code" | "ref", value: string) => {
    docEditsTouched.current.add(itemId);
    setDocEdits(prev => {
      const current = prev[itemId] ?? emptySlots();
      const updated = current.map((slot, i) => i === slotIndex ? { ...slot, [part]: value } : slot);
      return { ...prev, [itemId]: updated };
    });
  };

  const addDocSlot = (itemId: string) => {
    docEditsTouched.current.add(itemId);
    setDocEdits(prev => {
      const current = prev[itemId] ?? emptySlots();
      return { ...prev, [itemId]: [...current, { code: "", ref: "" }] };
    });
  };

  const removeDocSlot = async (item: GoodsItemRow, slotIndex: number) => {
    const itemId = item._id as string;
    docEditsTouched.current.add(itemId);
    const next = (docEdits[itemId] ?? emptySlots()).filter((_, i) => i !== slotIndex);
    setDocEdits(prev => ({ ...prev, [itemId]: next }));
    // Persist immediately — removal isn't covered by the onBlur path.
    try {
      const validDocs = next
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
    } catch (err) {
      console.error("Failed to remove document slot:", err);
    }
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

  const handleItemFieldBlur = (
    itemId: Id<"goods_items">,
    field: "description" | "commodityCode" | "originCountry" | "valueAmount" | "procedureCode" | "additionalProcedureCode" | "grossWeightKg" | "netWeightKg" | "shippingMarks",
    value: string,
  ) => {
    if (field === "commodityCode") {
      const cleaned = value.trim();
      if (cleaned.length !== 10 || !/^\d{10}$/.test(cleaned)) {
        setFieldErrors(prev => ({ ...prev, [`${itemId}-commodityCode`]: "Must be exactly 10 digits" }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, [`${itemId}-commodityCode`]: "" }));
      scheduleUpdate(itemId, "commodityCode", cleaned);
      return;
    }

    if (field === "originCountry") {
      const cleaned = value.trim().toUpperCase();
      if (cleaned.length !== 2 || !/^[A-Z]{2}$/.test(cleaned)) {
        setFieldErrors(prev => ({ ...prev, [`${itemId}-originCountry`]: "Must be exactly 2 letters" }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, [`${itemId}-originCountry`]: "" }));
      scheduleUpdate(itemId, "originCountry", cleaned);
      return;
    }

    if (field === "valueAmount") {
      scheduleUpdate(itemId, "valueAmount", Number(value) || 0);
      return;
    }

    if (field === "grossWeightKg") {
      scheduleUpdate(itemId, "grossWeightKg", Number(value) || 0);
      return;
    }

    if (field === "netWeightKg") {
      scheduleUpdate(itemId, "netWeightKg", Number(value) || 0);
      return;
    }

    scheduleUpdate(itemId, field, value.trim());
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

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item: GoodsItemRow, index: number) => {
            const slots = docEdits[item._id as string];
            return (
              <div key={item._id} className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-[11px] font-medium text-white">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      defaultValue={String(item.description ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "description", e.target.value)}
                      placeholder="Item description"
                      className="w-[26rem] max-w-full bg-transparent text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
                    />
                  </div>
                  <button
                    onClick={() => removeItem({ id: item._id })}
                    className="rounded p-1 text-gray-400 transition-colors hover:text-red-600"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 md:grid-cols-3 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">HS Code</label>
                    <input
                      type="text"
                      defaultValue={String(item.commodityCode ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "commodityCode", e.target.value)}
                      placeholder="e.g. 0207129000"
                      className={`h-9 w-full rounded-md border bg-white px-2 font-mono text-xs text-gray-800 outline-none focus:border-blue-500 ${fieldErrors[`${item._id}-commodityCode`] ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                    />
                    {fieldErrors[`${item._id}-commodityCode`] && (
                      <div className="mt-1 text-[10px] text-red-500 leading-tight">{fieldErrors[`${item._id}-commodityCode`]}</div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Origin</label>
                    <input
                      type="text"
                      defaultValue={String(item.originCountry ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "originCountry", e.target.value)}
                      placeholder="e.g. BR"
                      className={`h-9 w-full rounded-md border bg-white px-2 font-mono text-xs text-gray-800 outline-none focus:border-blue-500 ${fieldErrors[`${item._id}-originCountry`] ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                    />
                    {fieldErrors[`${item._id}-originCountry`] && (
                      <div className="mt-1 text-[10px] text-red-500 leading-tight">{fieldErrors[`${item._id}-originCountry`]}</div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Value ({String(item.valueCurrency ?? "GBP")})</label>
                    <input
                      type="number"
                      defaultValue={Number(item.valueAmount ?? 0)}
                      onBlur={(e) => handleItemFieldBlur(item._id, "valueAmount", e.target.value)}
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">CPC (DE 1/10)</label>
                    <input
                      type="text"
                      defaultValue={String(item.procedureCode ?? "4000")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "procedureCode", e.target.value)}
                      placeholder="4000"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 font-mono text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Add. Proc (DE 1/11)</label>
                    <input
                      type="text"
                      defaultValue={String(item.additionalProcedureCode ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "additionalProcedureCode", e.target.value)}
                      placeholder="000 = none"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 font-mono text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Gross (kg)</label>
                    <input
                      type="number"
                      defaultValue={item.grossWeightKg != null ? Number(item.grossWeightKg) : ""}
                      onBlur={(e) => handleItemFieldBlur(item._id, "grossWeightKg", e.target.value)}
                      placeholder="0"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Net (kg)</label>
                    <input
                      type="number"
                      defaultValue={item.netWeightKg != null ? Number(item.netWeightKg) : ""}
                      onBlur={(e) => handleItemFieldBlur(item._id, "netWeightKg", e.target.value)}
                      placeholder="0"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-3 lg:col-span-4">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Shipping Marks (DE 6/11)</label>
                    <input
                      type="text"
                      defaultValue={String((item as Record<string, unknown>).shippingMarks ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "shippingMarks", e.target.value)}
                      placeholder='Marks printed on the cartons/pallets — or "UNMARKED" if literally none'
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 px-4 py-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">Additional Documents (DE 2/3)</h4>
                    <span className="text-[10px] text-gray-400">Status code auto-derived: N+CHED → XW · Y929/Y930 → XB</span>
                  </div>
                  <div className="space-y-2">
                    {(slots ?? emptySlots()).map((slot, slotIdx) => {
                      const hint = DOC_SLOT_HINTS[slotIdx] ?? { label: "Additional document", code: "", ref: "" };
                      return (
                        <div key={slotIdx} className="grid grid-cols-12 items-center gap-2">
                          <div className="col-span-12 text-[10px] uppercase tracking-wider text-gray-400 sm:col-span-3">
                            Slot {slotIdx + 1} · {hint.label}
                          </div>
                          <input
                            type="text"
                            value={slot.code}
                            onChange={(e) => handleDocChange(item._id as string, slotIdx, "code", e.target.value)}
                            onBlur={() => handleDocBlur(item)}
                            placeholder={hint.code || "e.g. D006"}
                            className="col-span-3 h-9 rounded-md border border-gray-200 bg-white px-2 font-mono text-xs uppercase text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 sm:col-span-2"
                          />
                          <input
                            type="text"
                            value={slot.ref}
                            onChange={(e) => handleDocChange(item._id as string, slotIdx, "ref", e.target.value)}
                            onBlur={() => handleDocBlur(item)}
                            placeholder={hint.ref || "Reference"}
                            className="col-span-8 h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 sm:col-span-6"
                          />
                          <button
                            type="button"
                            onClick={() => removeDocSlot(item as GoodsItemRow, slotIdx)}
                            className="col-span-1 h-9 rounded-md border border-gray-200 bg-white text-xs text-gray-400 transition-colors hover:border-red-200 hover:text-red-500"
                            title="Remove this document slot"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => addDocSlot(item._id as string)}
                    className="mt-3 inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-gray-300 px-3 text-[11px] font-medium text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600"
                  >
                    + Add document slot
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20 text-center">
          <UploadCloud className="mb-4 h-8 w-8 text-gray-300" />
          <h3 className="text-sm font-medium text-gray-900">No goods items yet</h3>
          <p className="mt-1 max-w-sm text-xs text-gray-500">
            You can manually add rows or use our AI to automatically extract the line items from your commercial invoice PDF.
          </p>
        </div>
      )}

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
