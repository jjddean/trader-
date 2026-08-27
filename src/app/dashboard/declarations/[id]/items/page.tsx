"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { Info, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DeclarationModePromote } from "@/components/declaration-mode-promote";
import {
  ConvexSessionMissing,
  isConvexSessionMissing,
} from "@/components/declaration-session-states";
import { ApiError, userMessageFromError } from "@/lib/convex-errors";
import {
  type DocSlot,
  type GoodsItemFormRow as Item,
  buildExtractedDocuments,
  itemErrors,
  looksLikeConvexId,
  mapGoodsItem,
  parseNumber,
  parsePositiveInteger,
  parsePositiveNumber,
  slotsToValidDocs,
} from "@/lib/declaration-items-form";
import {
  AlertBanner,
  ds,
  MetricStrip,
  MutedPanel,
  PageContainer,
  PageHeading,
  PageLoading,
  PageSection,
} from "@/components/dashboard/page-shell";

const BLANK: Omit<Item, "key"> = {
  description: "",
  commodityCode: "",
  originCountry: "",
  valueAmount: "",
  procedureCode: "",
  additionalProcedureCode: "",
  grossWeightKg: "",
  netWeightKg: "",
  supplementaryUnitQty: "",
  packageCount: "",
  packageType: "",
  shippingMarks: "",
  docs: [
    { code: "", ref: "" },
    { code: "", ref: "" },
  ],
};

const DOC_SLOT_HINTS: Array<{ label: string; code: string; ref: string }> = [
  { label: "Commercial invoice", code: "N935", ref: "INV-2026-04112" },
  { label: "Packing list", code: "N271", ref: "PL-2026-04112" },
];

function emptySlots(): Array<{ code: string; ref: string }> {
  return [
    { code: "", ref: "" },
    { code: "", ref: "" },
  ];
}

function AiInvoiceButton({
  isUploading,
  onChange,
}: {
  isUploading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative">
      <input
        type="file"
        accept="application/pdf,image/*"
        onChange={onChange}
        disabled={isUploading}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isUploading}
        className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-700"
      >
        {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {isUploading ? "Extracting JSON with Groq..." : "AI Auto-Fill (Invoice PDF)"}
      </Button>
    </div>
  );
}

function ItemField({
  span,
  id,
  label,
  de,
  required,
  error,
  hint,
  children,
}: {
  span: string;
  id: string;
  label: string;
  de?: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("col-span-12 min-w-0 space-y-2", span)}>
      <Label
        htmlFor={id}
        className={cn(ds.sectionLabel, "flex min-h-6 w-full items-start justify-between leading-4")}
      >
        <span>{label}</span>
        {de || required ? (
          <span className="flex shrink-0 items-center gap-1">
            {de ? (
              <span className="font-mono text-[10px] font-normal normal-case tracking-normal">{de}</span>
            ) : null}
            {required ? <span className="text-destructive">*</span> : null}
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs break-words">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs break-words">{hint}</p>
      ) : null}
    </div>
  );
}

export default function GoodsItemsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const declarationId = params?.id as Id<"declarations">;
  const authReady =
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && Boolean(declarationId);

  const declaration = useQuery(
    api.declarations.getLane,
    authReady ? { id: declarationId } : "skip",
  );
  const items = useQuery(
    api.goods_items.getItems,
    authReady ? { declarationId } : "skip",
  );
  const addItem = useMutation(api.goods_items.addItem);
  const removeItem = useMutation(api.goods_items.removeItem);
  const updateItem = useMutation(api.goods_items.updateItem);
  type AddItemArgs = Parameters<typeof addItem>[0];
  const completeness = useQuery(
    api.declaration_completeness.getStatus,
    authReady ? { declarationId } : "skip",
  );

  const [rows, setRows] = useState<Item[]>([]);
  const [baseline, setBaseline] = useState<Item[]>([]);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [itemSaveError, setItemSaveError] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(baseline), [rows, baseline]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    if (search.get("hsApplied") === "1") {
      toast.success("HS code applied — verify the trade description against your invoice");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!items) return;
    const mapped = (items as unknown as Record<string, unknown>[]).map(mapGoodsItem);
    if (!dirtyRef.current) {
      setRows(mapped);
      setBaseline(mapped);
      return;
    }
    setRows((current) => {
      const keys = new Set(current.map((r) => r.key));
      const added = mapped.filter((m) => !keys.has(m.key));
      return added.length ? [...current, ...added] : current;
    });
    setBaseline((current) => {
      const keys = new Set(current.map((r) => r.key));
      const added = mapped.filter((m) => !keys.has(m.key));
      return added.length ? [...current, ...added] : current;
    });
  }, [items]);

  const errorCount = useMemo(
    () => (touched ? rows.reduce((n, r) => n + Object.keys(itemErrors(r)).length, 0) : 0),
    [rows, touched],
  );
  const totalValue = rows.reduce((n, r) => n + (Number(r.valueAmount) || 0), 0);
  const totalGross = rows.reduce((n, r) => n + (Number(r.grossWeightKg) || 0), 0);

  function patch(key: string, fieldName: keyof Item, value: string) {
    setSaved(false);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [fieldName]: value } : r)));
  }

  function patchDocs(key: string, docs: DocSlot[]) {
    setSaved(false);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, docs } : r)));
  }

  function fieldsFromRow(r: Item): Omit<AddItemArgs, "declarationId" | "sequenceNumber"> {
    const fields: Omit<AddItemArgs, "declarationId" | "sequenceNumber"> = {
      additionalDocuments: slotsToValidDocs(r.docs),
    };
    fields.description = r.description.trim();
    fields.commodityCode = r.commodityCode.trim();
    fields.originCountry = r.originCountry.trim().toUpperCase();
    fields.procedureCode = r.procedureCode.trim();
    fields.additionalProcedureCode = r.additionalProcedureCode.trim();
    fields.shippingMarks = r.shippingMarks.trim();
    fields.packageType = r.packageType.trim().toUpperCase();

    const valueAmount = parseNumber(r.valueAmount);
    if (valueAmount != null) {
      fields.valueAmount = valueAmount;
      if (valueAmount > 0) fields.valueCurrency = "GBP";
    }
    const grossWeightKg = parseNumber(r.grossWeightKg);
    if (grossWeightKg != null) fields.grossWeightKg = grossWeightKg;
    const netWeightKg = parseNumber(r.netWeightKg);
    if (netWeightKg != null) fields.netWeightKg = netWeightKg;
    const supplementaryUnitQty = parsePositiveInteger(r.supplementaryUnitQty);
    if (supplementaryUnitQty != null) {
      fields.supplementaryUnitQty = supplementaryUnitQty;
      fields.supplementaryUnitCode = "NAR";
    }
    const packageCount = parsePositiveInteger(r.packageCount);
    if (packageCount != null) fields.packageCount = packageCount;
    return fields;
  }

  async function handleSave() {
    setTouched(true);
    if (rows.some((r) => Object.keys(itemErrors(r)).length > 0)) return;
    setSaving(true);
    setItemSaveError(null);
    try {
      const rowKeys = new Set(rows.map((r) => r.key));
      for (const b of baseline) {
        if (!rowKeys.has(b.key) && looksLikeConvexId(b.key)) {
          await removeItem({ id: b.key as Id<"goods_items"> });
        }
      }
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const fields = fieldsFromRow(r);
        if (looksLikeConvexId(r.key)) {
          await updateItem({ id: r.key as Id<"goods_items">, ...fields });
        } else {
          await addItem({
            declarationId,
            sequenceNumber: i + 1,
            ...fields,
          });
        }
      }
      setBaseline(rows);
      setSaved(true);
    } catch (err) {
      setItemSaveError(userMessageFromError(err, "Failed to save item"));
    } finally {
      setSaving(false);
    }
  }

  const handleAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setAiError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ai/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new ApiError(
          [data.error || "Failed to extract invoice data.", data.details].filter(Boolean).join(" — "),
        );
      }

      if (data.items && Array.isArray(data.items)) {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i] as Record<string, unknown>;
          const payload: AddItemArgs = {
            declarationId,
            sequenceNumber: (items?.length || 0) + i + 1,
          };
          const cc = String(item.commodityCode || "").trim();
          const desc = String(item.description || "").trim();
          const origin = String(item.originCountry || "").trim().toUpperCase();
          const cpc = String(item.procedureCode || "").trim();
          const additionalProcedureCode = String(item.additionalProcedureCode || "").trim();
          const currency = String(item.valueCurrency || "").trim().toUpperCase();
          const packageType = String(item.packageType || "").trim().toUpperCase();
          const shippingMarks = String(item.shippingMarks || "").trim();
          const valueAmount = parsePositiveNumber(item.valueAmount);
          const grossWeightKg = parsePositiveNumber(item.grossWeightKg);
          const netWeightKg = parsePositiveNumber(item.netWeightKg);
          const supplementaryUnitQty = parsePositiveInteger(item.supplementaryUnitQty);
          const packageCount = parsePositiveInteger(item.packageCount);
          const additionalDocuments = buildExtractedDocuments(item);

          if (cc) payload.commodityCode = cc;
          if (desc) payload.description = desc;
          if (origin) payload.originCountry = origin;
          if (cpc) payload.procedureCode = cpc;
          if (additionalProcedureCode) payload.additionalProcedureCode = additionalProcedureCode;
          if (valueAmount != null) payload.valueAmount = valueAmount;
          if (currency) payload.valueCurrency = currency;
          if (grossWeightKg != null) payload.grossWeightKg = grossWeightKg;
          if (netWeightKg != null) payload.netWeightKg = netWeightKg;
          if (supplementaryUnitQty != null) {
            payload.supplementaryUnitQty = supplementaryUnitQty;
            payload.supplementaryUnitCode = "NAR";
          }
          if (packageCount != null) payload.packageCount = packageCount;
          if (packageType) payload.packageType = packageType;
          if (shippingMarks) payload.shippingMarks = shippingMarks;
          if (additionalDocuments.length > 0) payload.additionalDocuments = additionalDocuments;

          await addItem(payload);
        }
      }
    } catch (err: unknown) {
      setAiError(userMessageFromError(err, "Failed to extract invoice data."));
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  if (isConvexSessionMissing(isLoaded, Boolean(isSignedIn), isConvexAuthLoading, isAuthenticated)) {
    return <ConvexSessionMissing />;
  }

  if (declaration === undefined || items === undefined) {
    return <PageLoading label="Loading goods items" />;
  }

  if (!declaration) {
    return (
      <PageContainer className="px-0 lg:px-0">
        <AlertBanner>Declaration not found or you do not have access.</AlertBanner>
      </PageContainer>
    );
  }

  const blocking: Array<{ ruleId: string; field: string; reason: string }> = completeness?.missing ?? [];

  return (
    <PageContainer className="px-0 lg:px-0">
      <PageHeading
        title="Goods items"
        description="Define the physical commodities in this shipment. Required for WCO payload."
        action={<AiInvoiceButton isUploading={isUploading} onChange={handleAIUpload} />}
      />

      {rows.length > 0 && (
        <MutedPanel className="flex items-start gap-2 text-xs">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Important:</strong> According to HMRC guidelines, you are legally responsible for verifying
            all AI-extracted fields below before submission.
          </p>
        </MutedPanel>
      )}

      {aiError && (
        <AlertBanner>
          <span className="font-medium">Extraction Failed:</span> {aiError}
        </AlertBanner>
      )}

      {itemSaveError && (
        <AlertBanner>
          <strong>Could not save item:</strong> {itemSaveError}
        </AlertBanner>
      )}

      <MetricStrip
        items={[
          { label: "Items", value: rows.length, hint: rows.length === 1 ? "Single item" : "Multi-item" },
          { label: "Total value", value: totalValue.toLocaleString("en-GB"), hint: "GBP · DE 4/14" },
          { label: "Gross weight", value: `${totalGross.toLocaleString("en-GB")} kg`, hint: "DE 6/5" },
          {
            label: "Blocking issues",
            value: blocking.length,
            hint: blocking.length ? "From rule engine" : "Rule engine clear",
          },
        ]}
      />

      {blocking.length > 0 && (
        <AlertBanner variant="destructive">
          <span className="font-semibold">
            {blocking.length} blocking issue{blocking.length === 1 ? "" : "s"} from rule engine
          </span>
          <ul className="mt-2 space-y-1">
            {blocking.map((m, i) => (
              <li key={`${m.ruleId}-${i}`} className="flex gap-2">
                <code className="font-mono">{m.field}</code>
                <span>{m.reason}</span>
              </li>
            ))}
          </ul>
          <DeclarationModePromote
            declarationId={declarationId}
            declarationMode={(declaration as { mode?: string } | undefined)?.mode}
            missing={blocking}
          />
        </AlertBanner>
      )}

      {rows.length === 0 ? (
        <PageSection title="Goods items">
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-muted-foreground text-sm">No goods items yet.</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <AiInvoiceButton isUploading={isUploading} onChange={handleAIUpload} />
              <Button
                size="sm"
                onClick={() => {
                  setSaved(false);
                  setRows([{ key: `new-${Date.now()}`, ...BLANK }]);
                }}
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </div>
        </PageSection>
      ) : (
        rows.map((it, index) => {
          const errs = touched ? itemErrors(it) : {};
          const slots = it.docs.length > 0 ? it.docs : emptySlots();
          return (
            <PageSection
              key={it.key}
              title={`Item ${index + 1}`}
              description={it.description || "No description"}
              action={
                <div className="flex items-center gap-2">
                  {Object.keys(errs).length > 0 && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {Object.keys(errs).length} to fix
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() => {
                      setSaved(false);
                      setRows((rs) => rs.filter((r) => r.key !== it.key));
                    }}
                  >
                    <Trash2 className="text-muted-foreground h-4 w-4" />
                  </Button>
                </div>
              }
            >
              <div className="grid grid-cols-12 gap-x-4 gap-y-5">
                <ItemField span="md:col-span-12" id={`${it.key}-desc`} label="Description">
                  <Input
                    id={`${it.key}-desc`}
                    value={it.description}
                    onChange={(e) => patch(it.key, "description", e.target.value)}
                    placeholder="Item description"
                  />
                </ItemField>

                <ItemField
                  span="md:col-span-3"
                  id={`${it.key}-hs`}
                  label="HS code"
                  de="DE 6/14"
                  required
                  error={errs.commodityCode}
                  hint="Ten digits."
                >
                  <div className="space-y-1">
                    <Input
                      id={`${it.key}-hs`}
                      value={it.commodityCode}
                      onChange={(e) => patch(it.key, "commodityCode", e.target.value.replace(/\D/g, ""))}
                      onBlur={() => setTouched(true)}
                      aria-invalid={Boolean(errs.commodityCode)}
                      placeholder="8471300000"
                      className="font-mono"
                    />
                    {looksLikeConvexId(it.key) ? (
                      <Link
                        href={`/dashboard/tools/hscode-lookup?declarationId=${declarationId}&itemId=${it.key}`}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                      >
                        <Search className="h-3 w-3" />
                        Look up
                      </Link>
                    ) : null}
                  </div>
                </ItemField>

                <ItemField
                  span="md:col-span-2"
                  id={`${it.key}-origin`}
                  label="Origin"
                  de="DE 5/15"
                  required
                  error={errs.originCountry}
                >
                  <Input
                    id={`${it.key}-origin`}
                    value={it.originCountry}
                    onChange={(e) => patch(it.key, "originCountry", e.target.value.toUpperCase().slice(0, 2))}
                    onBlur={() => setTouched(true)}
                    aria-invalid={Boolean(errs.originCountry)}
                    placeholder="CN"
                    className="font-mono"
                  />
                </ItemField>

                <ItemField
                  span="md:col-span-3"
                  id={`${it.key}-value`}
                  label="Value"
                  de="DE 4/14"
                  required
                  error={errs.valueAmount}
                  hint="GBP"
                >
                  <Input
                    id={`${it.key}-value`}
                    value={it.valueAmount}
                    onChange={(e) => patch(it.key, "valueAmount", e.target.value)}
                    onBlur={() => setTouched(true)}
                    aria-invalid={Boolean(errs.valueAmount)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="text-right font-mono"
                  />
                </ItemField>

                <ItemField
                  span="md:col-span-2"
                  id={`${it.key}-cpc`}
                  label="CPC"
                  de="DE 1/10"
                  required
                  error={errs.procedureCode}
                >
                  <Input
                    id={`${it.key}-cpc`}
                    value={it.procedureCode}
                    onChange={(e) => patch(it.key, "procedureCode", e.target.value.toUpperCase())}
                    onBlur={() => setTouched(true)}
                    aria-invalid={Boolean(errs.procedureCode)}
                    placeholder="4000"
                    className="font-mono"
                  />
                </ItemField>

                <ItemField
                  span="md:col-span-2"
                  id={`${it.key}-apc`}
                  label="Add. proc"
                  de="DE 1/11"
                  required
                >
                  <Input
                    id={`${it.key}-apc`}
                    value={it.additionalProcedureCode}
                    onChange={(e) => patch(it.key, "additionalProcedureCode", e.target.value.toUpperCase())}
                    placeholder="000"
                    className="font-mono"
                  />
                </ItemField>

                <ItemField
                  span="md:col-span-3"
                  id={`${it.key}-gross`}
                  label="Gross (kg)"
                  de="DE 6/5"
                  required
                  error={errs.grossWeightKg}
                >
                  <Input
                    id={`${it.key}-gross`}
                    value={it.grossWeightKg}
                    onChange={(e) => patch(it.key, "grossWeightKg", e.target.value)}
                    onBlur={() => setTouched(true)}
                    aria-invalid={Boolean(errs.grossWeightKg)}
                    inputMode="decimal"
                    className="text-right font-mono"
                  />
                </ItemField>

                <ItemField
                  span="md:col-span-3"
                  id={`${it.key}-net`}
                  label="Net (kg)"
                  de="DE 6/1"
                >
                  <Input
                    id={`${it.key}-net`}
                    value={it.netWeightKg}
                    onChange={(e) => patch(it.key, "netWeightKg", e.target.value)}
                    inputMode="decimal"
                    className="text-right font-mono"
                  />
                </ItemField>

                <ItemField
                  span="md:col-span-3"
                  id={`${it.key}-su`}
                  label="Supp. units"
                  de="DE 6/2"
                  required
                  hint="p/st"
                >
                  <Input
                    id={`${it.key}-su`}
                    value={it.supplementaryUnitQty}
                    onChange={(e) => patch(it.key, "supplementaryUnitQty", e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 10"
                    className="text-right font-mono"
                  />
                </ItemField>

                <ItemField
                  span="md:col-span-3"
                  id={`${it.key}-pkgc`}
                  label="Pkg count"
                  de="DE 6/10"
                  required
                >
                  <Input
                    id={`${it.key}-pkgc`}
                    value={it.packageCount}
                    onChange={(e) => patch(it.key, "packageCount", e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    className="text-right font-mono"
                  />
                </ItemField>

                <ItemField
                  span="md:col-span-3"
                  id={`${it.key}-pkgt`}
                  label="Pkg type"
                  de="DE 6/9"
                  required
                >
                  <Input
                    id={`${it.key}-pkgt`}
                    value={it.packageType}
                    onChange={(e) => patch(it.key, "packageType", e.target.value.toUpperCase())}
                    placeholder="CT"
                    className="font-mono"
                  />
                </ItemField>

                <ItemField
                  span="md:col-span-12"
                  id={`${it.key}-marks`}
                  label="Shipping marks"
                  de="DE 6/11"
                >
                  <Input
                    id={`${it.key}-marks`}
                    value={it.shippingMarks}
                    onChange={(e) => patch(it.key, "shippingMarks", e.target.value)}
                    placeholder="Marks and numbers, or NIL for bulk"
                  />
                </ItemField>
              </div>

              <div className="mt-5 space-y-3 border-t border-border pt-5">
                <div className={cn(ds.sectionLabel, "flex min-h-6 w-full items-start justify-between leading-4")}>
                  <span>Additional documents</span>
                  <span className="font-mono text-[10px] font-normal normal-case tracking-normal">DE 2/3</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Lane: one N935 + one N271. Only the first of each code is saved; a reference of Excluded is not
                  sent to CDS.
                </p>
                <div className="space-y-2">
                  {slots.map((slot, slotIdx) => {
                    const hint = DOC_SLOT_HINTS[slotIdx] ?? { label: "Additional document", code: "", ref: "" };
                    return (
                      <div key={slotIdx} className="grid grid-cols-12 items-center gap-2">
                        <p className="text-muted-foreground col-span-12 text-[10px] uppercase tracking-wider sm:col-span-3">
                          Slot {slotIdx + 1} · {hint.label}
                        </p>
                        <Input
                          value={slot.code}
                          onChange={(e) =>
                            patchDocs(
                              it.key,
                              slots.map((s, i) => (i === slotIdx ? { ...s, code: e.target.value } : s)),
                            )
                          }
                          placeholder={hint.code || "e.g. D006"}
                          className="col-span-3 font-mono uppercase sm:col-span-2"
                        />
                        <Input
                          value={slot.ref}
                          onChange={(e) =>
                            patchDocs(
                              it.key,
                              slots.map((s, i) => (i === slotIdx ? { ...s, ref: e.target.value } : s)),
                            )
                          }
                          placeholder={hint.ref || "Reference"}
                          className="col-span-8 sm:col-span-6"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="col-span-1"
                          aria-label={`Remove document slot ${slotIdx + 1}`}
                          onClick={() => patchDocs(it.key, slots.filter((_, i) => i !== slotIdx))}
                        >
                          ×
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => patchDocs(it.key, [...slots, { code: "", ref: "" }])}
                >
                  <Plus className="h-4 w-4" />
                  Add document slot
                </Button>
              </div>
            </PageSection>
          );
        })
      )}

      {rows.length > 0 && (
        <MutedPanel className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {rows.length} item{rows.length === 1 ? "" : "s"} on this declaration.
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <AiInvoiceButton isUploading={isUploading} onChange={handleAIUpload} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSaved(false);
                setRows((rs) => [...rs, { key: `new-${Date.now()}`, ...BLANK }]);
              }}
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </span>
        </MutedPanel>
      )}

      {(dirty || saved) && (
        <MutedPanel className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {errorCount > 0
              ? `${errorCount} field${errorCount === 1 ? "" : "s"} need attention`
              : saved && !dirty
                ? "All changes saved"
                : "Unsaved changes"}
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRows(baseline);
                setTouched(false);
                setSaved(false);
              }}
              disabled={!dirty || saving}
            >
              Discard
            </Button>
            <Button size="sm" disabled={!dirty || saving || errorCount > 0} onClick={() => void handleSave()}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </span>
        </MutedPanel>
      )}
    </PageContainer>
  );
}
