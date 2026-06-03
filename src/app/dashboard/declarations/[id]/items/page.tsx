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
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Live completeness state from the rule engine. UI is display-only —
  // it does NOT enforce anything beyond HTML form attributes (required,
  // pattern). The rule engine in convex/lib/rule_engine.ts is the only
  // server-side source of truth for what's missing.
  const completeness = useQuery(
    api.declaration_completeness.getStatus,
    declarationId ? { declarationId } : "skip",
  );
  
  const [originCountry, setOriginCountry] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [description, setDescription] = useState("");

  // Controlled local state for document fields: { [itemId]: [{code,ref}, {code,ref}, {code,ref}] }
  // React owns the display values; Convex is only written on blur. Eliminates the race condition
  // where the code blur saved [] to Convex before the ref blur fired.
  const [docEdits, setDocEdits] = useState<Record<string, Array<{ code: string; ref: string }>>>({});
  // Prevent re-initialising slots the user is actively editing
  const docEditsTouched = useRef<Set<string>>(new Set());
  const docDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [docSaveState, setDocSaveState] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [itemSaveError, setItemSaveError] = useState<string | null>(null);

  // Batch pending field updates per item — flushed after 600ms idle OR immediately on blur.
  const pendingUpdates = useRef<Record<string, Record<string, unknown>>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const flushInFlight = useRef<Record<string, boolean>>({});

  const omitUndefined = (updates: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));

  const flushItemUpdates = async (itemId: string) => {
    clearTimeout(debounceTimers.current[itemId]);
    const updates = pendingUpdates.current[itemId];
    if (!updates || Object.keys(updates).length === 0) return;
    if (flushInFlight.current[itemId]) return;

    const payload = omitUndefined(updates);
    if (Object.keys(payload).length === 0) {
      delete pendingUpdates.current[itemId];
      return;
    }

    delete pendingUpdates.current[itemId];
    flushInFlight.current[itemId] = true;
    setItemSaveError(null);
    try {
      await updateItem({ id: itemId as Id<"goods_items">, ...payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save item";
      console.error("Failed to save item updates:", err);
      setItemSaveError(message);
      pendingUpdates.current[itemId] = { ...payload, ...pendingUpdates.current[itemId] };
    } finally {
      flushInFlight.current[itemId] = false;
    }
  };

  const scheduleUpdate = (itemId: string, field: string, value: unknown) => {
    if (!pendingUpdates.current[itemId]) pendingUpdates.current[itemId] = {};
    pendingUpdates.current[itemId][field] = value;

    clearTimeout(debounceTimers.current[itemId]);
    debounceTimers.current[itemId] = setTimeout(() => {
      void flushItemUpdates(itemId);
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
          const slotCount = Math.max(2, docs.length);
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
  // Y929, Y930 → XB (HMRC LPCOExemptionCode: Y-code waivers use XB).
  // All other codes: leave blank.
  const deriveStatusCode = (category: string, type: string) => {
    if (category === "N" && CHED_TYPES.includes(type)) return "XW";
    if (category === "Y" && ["929", "930"].includes(type)) return "XB";
    return "";
  };

  /** Persist only real documents — lane uses N935 + N271 (AC). */
  const slotsToValidDocs = (slots: Array<{ code: string; ref: string }>) => {
    const seen = new Set<string>();
    return slots
      .map((slot) => {
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
      .filter((doc) => doc.CategoryCode && doc.TypeCode && doc.ID)
      .filter((doc) => !/^excluded$/i.test(doc.ID))
      .filter((doc) => {
        const key = `${doc.CategoryCode}${doc.TypeCode}`.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const DOC_SLOT_HINTS: Array<{ label: string; code: string; ref: string }> = [
    { label: "Commercial invoice", code: "N935", ref: "INV-2026-04112" },
    { label: "Packing list", code: "N271", ref: "PL-2026-04112" },
  ];

  const emptySlots = () => [0, 1].map(() => ({ code: "", ref: "" }));

  const persistDocuments = async (item: GoodsItemRow, slots: Array<{ code: string; ref: string }>) => {
    const itemId = item._id as string;
    setDocSaveState((prev) => ({ ...prev, [itemId]: "saving" }));
    try {
      const validDocs = slotsToValidDocs(slots);
      await updateItem({ id: item._id, additionalDocuments: validDocs });
      setDocSaveState((prev) => ({ ...prev, [itemId]: "saved" }));
      window.setTimeout(() => {
        setDocSaveState((prev) => (prev[itemId] === "saved" ? { ...prev, [itemId]: "idle" } : prev));
      }, 2000);
    } catch (err) {
      console.error("Failed to save documents:", err);
      setDocSaveState((prev) => ({ ...prev, [itemId]: "error" }));
    }
  };

  const scheduleDocPersist = (item: GoodsItemRow, slots: Array<{ code: string; ref: string }>) => {
    const itemId = item._id as string;
    clearTimeout(docDebounceTimers.current[itemId]);
    docDebounceTimers.current[itemId] = setTimeout(() => {
      void persistDocuments(item, slots);
    }, 600);
  };

  useEffect(() => {
    return () => {
      for (const timer of Object.values(docDebounceTimers.current)) {
        clearTimeout(timer);
      }
      for (const timer of Object.values(debounceTimers.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const handleDocChange = (
    item: GoodsItemRow,
    slotIndex: number,
    part: "code" | "ref",
    value: string,
  ) => {
    const itemId = item._id as string;
    docEditsTouched.current.add(itemId);
    setDocEdits((prev) => {
      const current = prev[itemId] ?? emptySlots();
      const updated = current.map((slot, i) => (i === slotIndex ? { ...slot, [part]: value } : slot));
      scheduleDocPersist(item, updated);
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
    await persistDocuments(item, next);
  };

  const handleDocBlur = async (item: GoodsItemRow) => {
    const itemId = item._id as string;
    const slots = docEdits[itemId];
    if (!slots) return;
    clearTimeout(docDebounceTimers.current[itemId]);
    await persistDocuments(item, slots);
  };

  const handleItemFieldBlur = (
    itemId: Id<"goods_items">,
    field: "description" | "commodityCode" | "originCountry" | "valueAmount" | "procedureCode" | "additionalProcedureCode" | "grossWeightKg" | "netWeightKg" | "supplementaryUnitQty" | "shippingMarks" | "packageCount" | "packageType",
    value: string,
  ) => {
    // Format normalisation only — NO field-rule validation here.
    // The browser enforces HTML required/pattern at form level. The rule
    // engine (convex/lib/rule_engine.ts) is the only source of validation
    // beyond format. This handler just shapes the value before persistence.
    const trimmed = value.trim();

    if (field === "commodityCode") {
      scheduleUpdate(itemId, "commodityCode", trimmed);
    } else if (field === "originCountry" || field === "packageType") {
      scheduleUpdate(itemId, field, trimmed.toUpperCase());
    } else if (field === "supplementaryUnitQty") {
      // Empty or zero → undefined (DE 6/2 must be > 0 for tariff-measured commodities).
      const parsed = trimmed === "" ? undefined : Number(trimmed);
      const qty = parsed != null && parsed > 0 ? parsed : undefined;
      scheduleUpdate(itemId, field, qty);
      if (qty != null) scheduleUpdate(itemId, "supplementaryUnitCode", "NAR");
    } else if (field === "valueAmount" || field === "grossWeightKg" || field === "netWeightKg") {
      // Empty input → undefined (not 0). Don't invent a value the user didn't supply.
      const parsed = trimmed === "" ? undefined : Number(trimmed);
      scheduleUpdate(itemId, field, parsed);
    } else if (field === "packageCount") {
      const parsed = trimmed === "" ? undefined : parseInt(trimmed, 10);
      const count = parsed != null && parsed > 0 ? parsed : undefined;
      scheduleUpdate(itemId, field, count);
    } else {
      scheduleUpdate(itemId, field, trimmed);
    }
    void flushItemUpdates(itemId);
  };

  const handleManualAdd = async () => {
    // Persist exactly what the user provided. No invented defaults
    // (no fake "GB" origin, no "New Item" description, no implicit "4000"
    // CPC, no zero value, no GBP). Empty fields stay empty and the rule
    // engine + form-required attributes flag what still needs filling.
    setIsAdding(true);
    try {
      const payload: Record<string, unknown> = {
        declarationId,
        sequenceNumber: (items?.length || 0) + 1,
      };
      const trimmedHs = hsCode.trim();
      const trimmedDesc = description.trim();
      const trimmedOrigin = originCountry.trim().toUpperCase();
      if (trimmedHs) payload.commodityCode = trimmedHs;
      if (trimmedDesc) payload.description = trimmedDesc;
      if (trimmedOrigin) payload.originCountry = trimmedOrigin;
      await addItem(payload as any);
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

      // Persist exactly what the AI extracted. No invented fallbacks
      // (no implicit "GB" origin, no "Unknown Item" description, no "4000"
      // CPC, no zero value, no GBP). Missing fields stay empty so the user
      // sees what the AI couldn't determine and fills it in explicitly.
      if (data.items && Array.isArray(data.items)) {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const payload: Record<string, unknown> = {
            declarationId,
            sequenceNumber: (items?.length || 0) + i + 1,
          };
          const cc = String(item.commodityCode || "").trim();
          const desc = String(item.description || "").trim();
          const origin = String(item.originCountry || "").trim().toUpperCase();
          const cpc = String(item.procedureCode || "").trim();
          const valueRaw = item.valueAmount;
          const valueParsed = valueRaw == null || valueRaw === "" ? undefined : Number(valueRaw);
          const currency = String(item.valueCurrency || "").trim().toUpperCase();
          if (cc) payload.commodityCode = cc;
          if (desc) payload.description = desc;
          if (origin) payload.originCountry = origin;
          if (cpc) payload.procedureCode = cpc;
          if (Number.isFinite(valueParsed) && (valueParsed as number) > 0) payload.valueAmount = valueParsed;
          if (currency) payload.valueCurrency = currency;
          await addItem(payload as any);
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

      {/* Live completeness panel — derived from rule engine. NO local rules. */}
      {completeness && completeness.missing.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-900">
            <AlertCircle className="h-4 w-4" />
            {completeness.missing.length} blocking issue{completeness.missing.length === 1 ? "" : "s"} from rule engine
          </div>
          <ul className="space-y-1 text-[11px] text-amber-900/90">
            {completeness.missing.map((m, i) => (
              <li key={`${m.ruleId}-${i}`} className="flex gap-2">
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[10px]">{m.field}</code>
                <span>{m.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {itemSaveError && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <p>
            <strong>Could not save item:</strong> {itemSaveError}
          </p>
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

                {/*
                  HTML required/pattern attributes are SEMANTIC markers.
                  Mandatory levels per Appendix 21A H1 data set:
                    DE 1/10 procedureCode  — A
                    DE 1/11 additionalProcedureCode — A
                    DE 5/15 originCountry — A
                    DE 6/5  grossWeightKg item-level — A (multi-item)
                    DE 6/14 commodityCode — A
                    DE 4/14 valueAmount   — A
                  Conditional fields (DE 6/11 shipping marks unless bulk,
                  DE 6/1 net weight) are not marked required here.
                  The rule engine remains the only enforcing source.
                */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 md:grid-cols-3 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">HS Code <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      pattern="\d{10}"
                      defaultValue={String(item.commodityCode ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "commodityCode", e.target.value)}
                      placeholder="e.g. 8471300000"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 font-mono text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Origin <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      pattern="[A-Za-z]{2}"
                      defaultValue={String(item.originCountry ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "originCountry", e.target.value)}
                      placeholder="e.g. BR"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 font-mono text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Value ({String(item.valueCurrency ?? "")}) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      defaultValue={item.valueAmount != null ? Number(item.valueAmount) : ""}
                      onBlur={(e) => handleItemFieldBlur(item._id, "valueAmount", e.target.value)}
                      placeholder="0.00"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">CPC (DE 1/10) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      pattern="\d{4}"
                      defaultValue={String(item.procedureCode ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "procedureCode", e.target.value)}
                      placeholder="e.g. 4000"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 font-mono text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Add. Proc (DE 1/11) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      pattern="\d{3}"
                      defaultValue={String(item.additionalProcedureCode ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "additionalProcedureCode", e.target.value)}
                      placeholder="e.g. 000"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 font-mono text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Gross (kg) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0.001"
                      step="0.001"
                      defaultValue={item.grossWeightKg != null ? Number(item.grossWeightKg) : ""}
                      onBlur={(e) => handleItemFieldBlur(item._id, "grossWeightKg", e.target.value)}
                      placeholder="0.000"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Net (kg)</label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      defaultValue={item.netWeightKg != null ? Number(item.netWeightKg) : ""}
                      onBlur={(e) => handleItemFieldBlur(item._id, "netWeightKg", e.target.value)}
                      placeholder="0.000"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Supp. units (DE 6/2) p/st <span className="text-red-500">*</span>
                    </label>
                    <input
                      key={`${item._id}-su-${String((item as Record<string, unknown>).supplementaryUnitQty ?? "")}`}
                      type="number"
                      required
                      min="0.000001"
                      step="1"
                      defaultValue={
                        (item as Record<string, unknown>).supplementaryUnitQty != null
                          ? Number((item as Record<string, unknown>).supplementaryUnitQty)
                          : ""
                      }
                      onBlur={(e) => handleItemFieldBlur(item._id, "supplementaryUnitQty", e.target.value)}
                      placeholder="e.g. 10 (number of laptops)"
                      title="Number of items (not packages). Required for HS 8471300000 per UK tariff."
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pkg Count (DE 6/10) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      defaultValue={(item as Record<string, unknown>).packageCount != null ? Number((item as Record<string, unknown>).packageCount) : ""}
                      onBlur={(e) => handleItemFieldBlur(item._id, "packageCount", e.target.value)}
                      placeholder="e.g. 1"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pkg Type (DE 6/9) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      defaultValue={String((item as Record<string, unknown>).packageType ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "packageType", e.target.value)}
                      placeholder="e.g. PK, BX, CT"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 font-mono text-xs uppercase text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                    />
                  </div>

                  <div className="md:col-span-3 lg:col-span-4">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Shipping Marks (DE 6/11)</label>
                    <input
                      type="text"
                      defaultValue={String((item as Record<string, unknown>).shippingMarks ?? "")}
                      onBlur={(e) => handleItemFieldBlur(item._id, "shippingMarks", e.target.value)}
                      placeholder="Marks printed on the cartons/pallets"
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 px-4 py-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">Additional Documents (DE 2/3)</h4>
                    <div className="flex items-center gap-2">
                      {docSaveState[item._id as string] === "saving" && (
                        <span className="text-[10px] text-gray-500">Saving…</span>
                      )}
                      {docSaveState[item._id as string] === "saved" && (
                        <span className="text-[10px] text-green-600">Saved</span>
                      )}
                      {docSaveState[item._id as string] === "error" && (
                        <span className="text-[10px] text-red-600">Save failed</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const slotsNow = docEdits[item._id as string] ?? emptySlots();
                          void persistDocuments(item as GoodsItemRow, slotsNow);
                        }}
                        className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[10px] font-medium text-gray-700 hover:border-blue-400 hover:text-blue-600"
                      >
                        Save documents
                      </button>
                    </div>
                  </div>
                  <p className="mb-1 text-[10px] text-gray-400">Lane: one N935 + one N271. Auto-saves ~600ms after edits.</p>
                  <p className="mb-2 text-[10px] text-amber-700">
                    Remove duplicate N935/N271 rows and Y-slots with reference &quot;Excluded&quot; — only the first of each code is saved; Excluded is not sent to CDS.
                  </p>
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
                            onChange={(e) => handleDocChange(item as GoodsItemRow, slotIdx, "code", e.target.value)}
                            onBlur={() => handleDocBlur(item)}
                            placeholder={hint.code || "e.g. D006"}
                            className="col-span-3 h-9 rounded-md border border-gray-200 bg-white px-2 font-mono text-xs uppercase text-gray-800 outline-none hover:border-gray-300 focus:border-blue-500 sm:col-span-2"
                          />
                          <input
                            type="text"
                            value={slot.ref}
                            onChange={(e) => handleDocChange(item as GoodsItemRow, slotIdx, "ref", e.target.value)}
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
                placeholder="e.g. Laptop, weight not exceeding 10 kg"
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
