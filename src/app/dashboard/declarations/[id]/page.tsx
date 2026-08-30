"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { CompactCheckbox } from "@/components/ui/compact-checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries } from "@/lib/data/countries";
import {
  inferGoodsLocationKind,
  KNOWN_APPENDIX_16C_CODES,
  type GoodsLocationKind,
} from "@/lib/goods-location";
import { DeclarationModePromote } from "@/components/declaration-mode-promote";
import {
  ConvexSessionMissing,
  isConvexSessionMissing,
} from "@/components/declaration-session-states";
import {
  PAYMENT_METHOD_OPTIONS,
  requiresDefermentAccount,
  validatePaymentFields,
} from "@/lib/payment-method";
import { userMessageFromError } from "@/lib/convex-errors";
import { cn } from "@/lib/utils";
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

type DeclarationCategoryChoice = "" | "B1" | "C1" | "I1";
type RepresentationType = "self" | "direct" | "indirect";

const DECLARATION_CATEGORIES: { value: DeclarationCategoryChoice; label: string }[] = [
  { value: "", label: "H1 — full import declaration" },
  { value: "I1", label: "I1 C&F — simplified import (regular use)" },
  { value: "B1", label: "B1 — standard export / re-export" },
  { value: "C1", label: "C1 C&F — simplified export (regular use)" },
];

function isExportCategory(category: DeclarationCategoryChoice): boolean {
  return category === "B1" || category === "C1";
}

function isSimplifiedCategory(category: DeclarationCategoryChoice): boolean {
  return category === "I1" || category === "C1";
}

const ARRIVAL_BY_CATEGORY = {
  standard: [
    { value: "A", label: "A — arrived" },
    { value: "D", label: "D — pre-lodged" },
  ],
  simplified: [
    { value: "C", label: "C — simplified, arrived" },
    { value: "F", label: "F — simplified, pre-lodged" },
  ],
} as const;

const ROUTES = [
  { value: "Route 1", label: "Route 1 (Documentary Check)" },
  { value: "Route 2", label: "Route 2 (Physical Exam)" },
  { value: "Route 6", label: "Route 6 (Direct Clearance)" },
];

const TRANSPORT_MODE_OPTIONS = [
  { value: "1", label: "1 — Sea" },
  { value: "2", label: "2 — Rail" },
  { value: "3", label: "3 — Road" },
  { value: "4", label: "4 — Air" },
  { value: "5", label: "5 — Postal" },
  { value: "7", label: "7 — Fixed transport installations" },
  { value: "8", label: "8 — Inland waterway" },
  { value: "9", label: "9 — Mode unknown" },
] as const;

const TRANSPORT_ID_TYPE_OPTIONS = [
  { value: "10", label: "10 — IMO ship identification number" },
  { value: "11", label: "11 — Name of seagoing vessel" },
  { value: "20", label: "20 — Wagon number" },
  { value: "30", label: "30 — Vehicle registration number" },
  { value: "40", label: "40 — IATA flight number" },
  { value: "41", label: "41 — Registration of aircraft" },
] as const;

const REPRESENTATION_TYPES = [
  { value: "self", label: "Self — declarant is the importer" },
  { value: "direct", label: "Direct — broker acts for importer (DE 3/21 = 2)" },
  { value: "indirect", label: "Indirect — broker is declarant (DE 3/21 = 3)" },
] as const;

const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const NONE = "__none__";
const LONDON_GATEWAY = "GBAULGPLGPLGP1";

const PORT_LOCATION_OPTIONS = Object.entries(KNOWN_APPENDIX_16C_CODES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const FORBIDDEN_ON_EXPORT = [
  "importerEori",
  "incoterms",
  "incotermLocation",
  "defermentAccountNumber",
  "paymentMethodCode",
] as const;

interface FormData {
  eori: string;
  declarationType: string;
  additionalDeclarationType: string;
  route: string;
  dispatchCountry: string;
  transportMode: string;
  transportId: string;
  transportIdType: string;
  destinationCountry: string;
  importerEori: string;
  invoiceCurrency: string;
  invoiceTotal: string;
  incoterms: string;
  incotermLocation: string;
  goodsLocationKind: GoodsLocationKind | "";
  locationId: string;
  presentationOffice: string;
  exporterEori: string;
  exporterCountry: string;
  exporterName: string;
  exporterCity: string;
  exporterLine: string;
  exporterPostcode: string;
  transactionNatureCode: string;
  paymentMethodCode: string;
  defermentAccountNumber: string;
  declarationCategory: DeclarationCategoryChoice;
  customsOfficeOfExit: string;
  authorisationHolderEori: string;
  authorisationCategoryCode: string;
  consigneeEori: string;
  consigneeName: string;
  consigneeCity: string;
  consigneeLine: string;
  consigneePostcode: string;
  consigneeCountry: string;
  sealNumber: string;
  containerNumber: string;
  cnsUcn: string;
}

interface RepresentationForm {
  representationType: RepresentationType;
  representativeEori: string;
  representativeName: string;
  representativeAddressLine: string;
  representativeCity: string;
  representativePostcode: string;
  representativeCountry: string;
  authorityVerified: boolean;
  authorityValidFrom: string;
  authorityValidTo: string;
}

const EMPTY_FORM: FormData = {
  eori: "",
  declarationType: "H1",
  additionalDeclarationType: "A",
  route: "Route 1",
  dispatchCountry: "",
  transportMode: "",
  transportId: "",
  transportIdType: "",
  destinationCountry: "",
  importerEori: "",
  invoiceCurrency: "",
  invoiceTotal: "",
  incoterms: "",
  incotermLocation: "",
  goodsLocationKind: "",
  locationId: "",
  presentationOffice: "",
  exporterEori: "",
  exporterCountry: "",
  exporterName: "",
  exporterCity: "",
  exporterLine: "",
  exporterPostcode: "",
  transactionNatureCode: "",
  paymentMethodCode: "",
  defermentAccountNumber: "",
  declarationCategory: "",
  customsOfficeOfExit: "",
  authorisationHolderEori: "",
  authorisationCategoryCode: "",
  consigneeEori: "",
  consigneeName: "",
  consigneeCity: "",
  consigneeLine: "",
  consigneePostcode: "",
  consigneeCountry: "",
  sealNumber: "",
  containerNumber: "",
  cnsUcn: "",
};

const EMPTY_REP: RepresentationForm = {
  representationType: "self",
  representativeEori: "",
  representativeName: "",
  representativeAddressLine: "",
  representativeCity: "",
  representativePostcode: "",
  representativeCountry: "",
  authorityVerified: false,
  authorityValidFrom: "",
  authorityValidTo: "",
};

function normalizeTransportIdType(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  const code = raw.match(/^(\d{2})/)?.[1];
  return code ?? raw;
}

function normalizeTransportMode(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  const code = raw.match(/^(\d)/)?.[1];
  return code ?? raw;
}

function dateInputValue(ms: number | undefined | null): string {
  if (!ms || !Number.isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function parseDateInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Date.parse(`${trimmed}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function Field({
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
  error?: string | null;
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

function fieldGrid(children: React.ReactNode) {
  return <div className="grid grid-cols-12 gap-x-4 gap-y-5">{children}</div>;
}

export default function CoreSchemaPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id as Id<"declarations">;
  const ready = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && id;

  const declaration = useQuery(api.declarations.getLane, ready ? { id } : "skip");
  const updateDeclaration = useMutation(api.declarations.updateDeclarationDetails);
  const completeness = useQuery(
    api.declaration_completeness.getStatus,
    ready ? { declarationId: id } : "skip",
  );
  const clients = useQuery(api.clients.list, ready ? { includeArchived: false } : "skip");
  const setClient = useMutation(api.clients.setClient);
  const representationStatus = useQuery(
    api.representation.getStatus,
    ready ? { declarationId: id } : "skip",
  );
  const setRepresentationDetails = useMutation(api.representation.setRepresentationDetails);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [clientBusy, setClientBusy] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const hydratedVersionRef = useRef<string | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formBaseline, setFormBaseline] = useState<FormData>(EMPTY_FORM);
  const [repForm, setRepForm] = useState<RepresentationForm>(EMPTY_REP);
  const [repBaseline, setRepBaseline] = useState<RepresentationForm>(EMPTY_REP);
  const [repHydrated, setRepHydrated] = useState(false);

  useEffect(() => {
    setRepHydrated(false);
  }, [id]);

  useEffect(() => {
    if (!declaration || !id) return;
    const version = `${id}:${String(declaration.lastUpdated ?? declaration._creationTime ?? "")}`;
    if (hydratedVersionRef.current === version) return;
    hydratedVersionRef.current = version;
    const d = declaration as Record<string, unknown>;
    const next: FormData = {
      eori: (d.eori as string) || "",
      declarationType: "H1",
      additionalDeclarationType: (d.additionalDeclarationType as string) || "A",
      route: (d.route as string) || "Route 1",
      dispatchCountry: (d.dispatchCountry as string) || "",
      transportMode: normalizeTransportMode(d.transportMode),
      transportId: (d.transportId as string) || "",
      transportIdType: normalizeTransportIdType(d.transportIdType),
      destinationCountry: (d.destinationCountry as string) || "",
      importerEori: (d.importerEori as string) || "",
      invoiceCurrency: (d.invoiceCurrency as string) || "",
      invoiceTotal: d.invoiceTotal != null ? String(d.invoiceTotal) : "",
      incoterms: (d.incoterms as string) || "",
      incotermLocation: (d.incotermLocation as string) || "",
      declarationCategory: ((d.declarationCategory as string) || "") as DeclarationCategoryChoice,
      customsOfficeOfExit: (d.customsOfficeOfExit as string) || "",
      authorisationHolderEori: (d.authorisationHolderEori as string) || "",
      authorisationCategoryCode: (d.authorisationCategoryCode as string) || "",
      consigneeEori: (d.consigneeEori as string) || "",
      consigneeName: (d.consigneeName as string) || "",
      consigneeCity: (d.consigneeCity as string) || "",
      consigneeLine: (d.consigneeLine as string) || "",
      consigneePostcode: (d.consigneePostcode as string) || "",
      consigneeCountry: (d.consigneeCountry as string) || "",
      sealNumber: (d.sealNumber as string) || "",
      goodsLocationKind:
        inferGoodsLocationKind({
          goodsLocationKind: d.goodsLocationKind,
          locationId: d.locationId,
        }) || "",
      locationId: (d.locationId as string) || "",
      presentationOffice: (d.presentationOffice as string) || "",
      exporterEori: (d.exporterEori as string) || "",
      exporterCountry: (d.exporterCountry as string) || "",
      exporterName: (d.exporterName as string) || "",
      exporterCity: (d.exporterCity as string) || "",
      exporterLine: (d.exporterLine as string) || "",
      exporterPostcode: (d.exporterPostcode as string) || "",
      transactionNatureCode: (d.transactionNatureCode as string) || "",
      paymentMethodCode: (d.paymentMethodCode as string) || "",
      defermentAccountNumber: (d.defermentAccountNumber as string) || "",
      containerNumber: (d.containerNumber as string) || "",
      cnsUcn: (d.cnsUcn as string) || "",
    };
    setFormData(next);
    setFormBaseline(next);
  }, [declaration, id]);

  useEffect(() => {
    if (!representationStatus || repHydrated) return;
    const rep = representationStatus.representation;
    const next: RepresentationForm = {
      representationType: (rep.representationType as RepresentationType) || "self",
      representativeEori: rep.representativeEori || "",
      representativeName: rep.representativeName || "",
      representativeAddressLine: rep.representativeAddressLine || "",
      representativeCity: rep.representativeCity || "",
      representativePostcode: rep.representativePostcode || "",
      representativeCountry: rep.representativeCountry || "",
      authorityVerified: rep.authorityVerified ?? false,
      authorityValidFrom: dateInputValue(rep.authorityValidFrom),
      authorityValidTo: dateInputValue(rep.authorityValidTo),
    };
    setRepForm(next);
    setRepBaseline(next);
    setRepHydrated(true);
  }, [representationStatus, repHydrated]);

  const formDirty = JSON.stringify(formData) !== JSON.stringify(formBaseline);
  const repDirty = JSON.stringify(repForm) !== JSON.stringify(repBaseline);
  const dirty = formDirty || repDirty;

  function patch<K extends keyof FormData>(key: K, value: FormData[K]) {
    setSaved(false);
    setSaveError(null);
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleClientChange(value: string) {
    setClientBusy(true);
    setClientError(null);
    try {
      await setClient({
        declarationId: id,
        clientId: value === NONE ? null : value,
      });
    } catch (err) {
      setClientError(userMessageFromError(err, "Failed to link client"));
    } finally {
      setClientBusy(false);
    }
  }

  const handleSave = async () => {
    if (saving) return;
    const exportCategory = isExportCategory(formData.declarationCategory);
    const scrubbed = { ...formData };
    if (exportCategory) {
      for (const field of FORBIDDEN_ON_EXPORT) scrubbed[field] = "";
    }
    const paymentError = validatePaymentFields(
      scrubbed.paymentMethodCode,
      requiresDefermentAccount(scrubbed.paymentMethodCode)
        ? scrubbed.defermentAccountNumber
        : "",
    );
    if (paymentError) {
      setSaveError(paymentError);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const validationMessages: string[] = [];
      if (!formData.transportIdType.trim()) {
        validationMessages.push("Identification Type (DE 7/9) is required.");
      }
      if (!formData.transportMode.trim()) {
        validationMessages.push("Transport Mode (DE 7/4) is required.");
      }
      if (formData.locationId.trim().toUpperCase() === LONDON_GATEWAY && !formData.cnsUcn.trim()) {
        validationMessages.push("CNS UCN is required for London Gateway inventory-linked declarations.");
      }
      const dispatch = formData.dispatchCountry.trim().toUpperCase();
      if (exportCategory) {
        const hasEori = Boolean(formData.exporterEori.trim());
        const hasNameAddress =
          Boolean(formData.exporterName.trim()) &&
          Boolean(formData.exporterCity.trim()) &&
          Boolean(formData.exporterLine.trim()) &&
          Boolean(formData.exporterPostcode.trim());
        if (!hasEori && !hasNameAddress) {
          validationMessages.push("Exporter EORI (DE 3/2) or name and address (DE 3/1) is required.");
        }
      } else if (dispatch && dispatch !== "GB" && dispatch !== "XI") {
        if (!formData.exporterName.trim()) {
          validationMessages.push("Exporter name (DE 3/1) is required for overseas dispatch.");
        }
        if (!formData.exporterCity.trim() || !formData.exporterLine.trim() || !formData.exporterPostcode.trim()) {
          validationMessages.push("Exporter city, address line, and postcode (DE 3/1) are required for overseas dispatch.");
        }
      }
      if (!formData.transactionNatureCode.trim()) {
        validationMessages.push("Nature of transaction (DE 8/5) is required.");
      }

      const invoiceTotalParsed =
        formData.invoiceTotal.trim() === "" ? null : Number(formData.invoiceTotal);
      if (formDirty) {
        await updateDeclaration({
        id,
        eori: formData.eori.trim(),
        declarationType: "H1",
        additionalDeclarationType: formData.additionalDeclarationType,
        route: formData.route,
        dispatchCountry: formData.dispatchCountry,
        transportMode: normalizeTransportMode(formData.transportMode),
        transportId: formData.transportId.trim(),
        transportIdType: normalizeTransportIdType(formData.transportIdType),
        destinationCountry: formData.destinationCountry,
        importerEori: scrubbed.importerEori.trim(),
        invoiceCurrency: formData.invoiceCurrency.trim().toUpperCase(),
        invoiceTotal:
          invoiceTotalParsed === null || Number.isFinite(invoiceTotalParsed)
            ? invoiceTotalParsed
            : null,
        incoterms: scrubbed.incoterms.trim().toUpperCase(),
        incotermLocation: scrubbed.incotermLocation.trim(),
        goodsLocationKind:
          formData.goodsLocationKind ||
          inferGoodsLocationKind({ locationId: formData.locationId }) ||
          undefined,
        locationId: formData.locationId.trim() || String(declaration?.locationId ?? "").trim(),
        presentationOffice: formData.presentationOffice.trim(),
        exporterEori: formData.exporterEori.trim().toUpperCase(),
        exporterCountry: formData.exporterCountry,
        exporterName: formData.exporterName.trim(),
        exporterCity: formData.exporterCity.trim(),
        exporterLine: formData.exporterLine.trim(),
        exporterPostcode: formData.exporterPostcode.trim(),
        transactionNatureCode: formData.transactionNatureCode.trim(),
        declarationCategory: formData.declarationCategory || undefined,
        customsOfficeOfExit: formData.customsOfficeOfExit.trim().toUpperCase(),
        authorisationHolderEori: formData.authorisationHolderEori.trim().toUpperCase(),
        authorisationCategoryCode: formData.authorisationCategoryCode.trim().toUpperCase(),
        consigneeEori: formData.consigneeEori.trim().toUpperCase(),
        consigneeName: formData.consigneeName.trim(),
        consigneeCity: formData.consigneeCity.trim(),
        consigneeLine: formData.consigneeLine.trim(),
        consigneePostcode: formData.consigneePostcode.trim(),
        consigneeCountry: formData.consigneeCountry,
        sealNumber: formData.sealNumber.trim(),
        paymentMethodCode: scrubbed.paymentMethodCode.trim().toUpperCase() || undefined,
        defermentAccountNumber: requiresDefermentAccount(scrubbed.paymentMethodCode)
          ? scrubbed.defermentAccountNumber.replace(/\D/g, "")
          : undefined,
        containerNumber: formData.containerNumber.trim().toUpperCase(),
        cnsUcn: formData.cnsUcn.trim().toUpperCase(),
      });
      }

      if (repHydrated && repDirty) {
        const showRepFields = repForm.representationType !== "self";
        const showAuthority = repForm.representationType === "indirect";
        await setRepresentationDetails({
          declarationId: id,
          representationType: repForm.representationType,
          representativeEori: showRepFields ? repForm.representativeEori.trim() || null : null,
          representativeName: showRepFields ? repForm.representativeName.trim() || null : null,
          representativeAddressLine: showRepFields
            ? repForm.representativeAddressLine.trim() || null
            : null,
          representativeCity: showRepFields ? repForm.representativeCity.trim() || null : null,
          representativePostcode: showRepFields
            ? repForm.representativePostcode.trim() || null
            : null,
          representativeCountry: showRepFields
            ? repForm.representativeCountry.trim().toUpperCase() || null
            : null,
          authorityVerified: showAuthority ? repForm.authorityVerified : false,
          authorityValidFrom: showAuthority ? parseDateInput(repForm.authorityValidFrom) ?? null : null,
          authorityValidTo: showAuthority ? parseDateInput(repForm.authorityValidTo) ?? null : null,
        });
        setRepBaseline(repForm);
      }

      setFormData(scrubbed);
      setFormBaseline(scrubbed);
      if (validationMessages.length > 0) {
        setSaveError(`Saved draft. Still blocking: ${validationMessages[0]}`);
      } else {
        setSaved(true);
      }
    } catch (e) {
      setSaveError(userMessageFromError(e, "Failed to save core details"));
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded) {
    return <PageLoading label="Loading declaration" />;
  }

  if (isConvexSessionMissing(isLoaded, Boolean(isSignedIn), isConvexAuthLoading, isAuthenticated)) {
    return <ConvexSessionMissing />;
  }

  if (isSignedIn && isAuthenticated && declaration === undefined) {
    return <PageLoading label="Loading declaration" />;
  }

  if (!declaration) {
    return (
      <PageContainer className="px-0 lg:px-0">
        <AlertBanner>Declaration not found or you do not have access.</AlertBanner>
      </PageContainer>
    );
  }

  const exportSet = isExportCategory(formData.declarationCategory);
  const simplified = isSimplifiedCategory(formData.declarationCategory);
  const showAuthorisation =
    simplified || (exportSet && formData.additionalDeclarationType === "A");
  const arrivalOptions = ARRIVAL_BY_CATEGORY[simplified ? "simplified" : "standard"];
  const showRepFields = repForm.representationType !== "self";
  const showAuthority = repForm.representationType === "indirect";
  const locationIdUpper = (
    formData.locationId.trim() || String(declaration.locationId ?? "").trim()
  ).toUpperCase();
  const locationIdIsKnown = Boolean(locationIdUpper && KNOWN_APPENDIX_16C_CODES[locationIdUpper]);
  const linkedClientId = declaration.clientId ? String(declaration.clientId) : undefined;
  const blocking: Array<{ ruleId: string; field: string; reason: string }> =
    completeness?.missing ?? [];
  const incotermOptions =
    formData.incoterms && !INCOTERMS.includes(formData.incoterms)
      ? [formData.incoterms, ...INCOTERMS]
      : INCOTERMS;
  const overseasDispatch =
    Boolean(formData.dispatchCountry) &&
    formData.dispatchCountry !== "GB" &&
    formData.dispatchCountry !== "XI";

  const countryOptions = countries.map((c) => (
    <SelectItem key={c.code} value={c.code}>
      {c.code} — {c.name}
    </SelectItem>
  ));

  return (
    <PageContainer className="px-0 lg:px-0">
      <PageHeading
        title="Core declaration details"
        description="Enter the core details for this CDS declaration."
      />

      <MetricStrip
        items={[
          {
            label: "Data set",
            value: formData.declarationCategory || "H1",
            hint: exportSet ? "Export data set" : "Import data set",
          },
          {
            label: "Arrival status",
            value: formData.additionalDeclarationType || "—",
            hint: "DE 1/2",
          },
          {
            label: "Route",
            value: formData.route.replace(/^Route\s+/i, "") || "—",
            hint: "CDS routing",
          },
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
            declarationId={id}
            declarationMode={(declaration as { mode?: string }).mode}
            missing={blocking}
          />
        </AlertBanner>
      )}

      <PageSection title="Declaration" description="Data set, arrival status and customs routing.">
        {fieldGrid(
          <>
            <Field
              span="md:col-span-6"
              id="category"
              label="Declaration category"
              hint={
                exportSet
                  ? "Export data set — importer, preference and valuation fields are not declared."
                  : "Import data set."
              }
            >
              <Select
                value={formData.declarationCategory || "H1"}
                onValueChange={(v) => {
                  const category = (v === "H1" ? "" : v) as DeclarationCategoryChoice;
                  setSaved(false);
                  setSaveError(null);
                  setFormData({
                    ...formData,
                    declarationCategory: category,
                    additionalDeclarationType: isSimplifiedCategory(category)
                      ? "C"
                      : isExportCategory(category)
                        ? "D"
                        : "A",
                  });
                }}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {DECLARATION_CATEGORIES.map((c) => (
                    <SelectItem key={c.value || "H1"} value={c.value || "H1"}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              span="md:col-span-3"
              id="arrival"
              label="Arrival status"
              de="DE 1/2"
              required
              hint={simplified ? "Simplified sets accept C or F." : undefined}
            >
              <Select
                value={formData.additionalDeclarationType}
                onValueChange={(v) => patch("additionalDeclarationType", v)}
              >
                <SelectTrigger id="arrival" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {arrivalOptions.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field span="md:col-span-3" id="route" label="Customs routing">
              <Select value={formData.route} onValueChange={(v) => patch("route", v)}>
                <SelectTrigger id="route" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {ROUTES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>,
        )}
      </PageSection>

      {showAuthorisation && (
        <PageSection
          title={simplified ? "Simplified authorisation" : "Authorisation"}
          description={
            simplified
              ? "Mandatory on both simplified data sets."
              : "Required on an arrived export."
          }
        >
          {fieldGrid(
            <>
              <Field
                span="md:col-span-6"
                id="authHolder"
                label="Authorisation holder"
                de="DE 3/39"
                required
                hint="EORI holding the SDP or EIDR authorisation."
              >
                <Input
                  id="authHolder"
                  value={formData.authorisationHolderEori}
                  onChange={(e) => patch("authorisationHolderEori", e.target.value.toUpperCase())}
                  placeholder="GB123456789000"
                  className="font-mono"
                />
              </Field>
              <Field span="md:col-span-6" id="authType" label="Authorisation type code">
                <Input
                  id="authType"
                  value={formData.authorisationCategoryCode}
                  onChange={(e) => patch("authorisationCategoryCode", e.target.value.toUpperCase())}
                  placeholder="SDE"
                  className="font-mono"
                />
              </Field>
            </>,
          )}
        </PageSection>
      )}

      <PageSection title="Parties" description="Who is declaring, and on whose behalf.">
        {fieldGrid(
          <>
            <Field
              span="md:col-span-6"
              id="eori"
              label="Declarant EORI"
              de="DE 3/18"
              required
              hint="Must match your HMRC Developer Hub credentials."
            >
              <Input
                id="eori"
                value={formData.eori}
                onChange={(e) => patch("eori", e.target.value.toUpperCase())}
                placeholder="GB123456789000"
                className="font-mono"
              />
            </Field>

            {!exportSet && (
              <Field
                span="md:col-span-6"
                id="importerEori"
                label="Importer EORI"
                de="DE 3/16"
                required
                hint="Same as declarant when self-representing."
              >
                <Input
                  id="importerEori"
                  value={formData.importerEori}
                  onChange={(e) => patch("importerEori", e.target.value.toUpperCase())}
                  placeholder="GB123456789000"
                  className="font-mono"
                />
              </Field>
            )}

            {exportSet && (
              <Field
                span="md:col-span-6"
                id="exit"
                label="Customs office of exit"
                de="DE 5/12"
                required
                hint="Office where the goods leave the UK."
              >
                <Input
                  id="exit"
                  value={formData.customsOfficeOfExit}
                  onChange={(e) => patch("customsOfficeOfExit", e.target.value.toUpperCase())}
                  placeholder="GB000060"
                  className="font-mono"
                />
              </Field>
            )}

            <Field
              span="md:col-span-6"
              id="client"
              label="Client (filed on behalf of)"
              error={clientError}
              hint={
                <>
                  Association only — manage in{" "}
                  <Link href="/dashboard/clients" className="underline underline-offset-2">
                    Clients
                  </Link>
                  .
                </>
              }
            >
              {clients === undefined ? (
                <div className="text-muted-foreground flex h-9 items-center gap-2 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading…
                </div>
              ) : (
                <Select
                  value={linkedClientId ?? NONE}
                  onValueChange={(v) => void handleClientChange(v)}
                  disabled={clientBusy}
                >
                  <SelectTrigger id="client" className="w-full">
                    <SelectValue placeholder="No client linked" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value={NONE}>No client linked</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client._id} value={client._id}>
                        {client.name}
                        {client.eori ? ` · ${client.eori}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </>,
        )}
      </PageSection>

      <PageSection title="Consignee" description="Party the goods are consigned to.">
        {fieldGrid(
          <>
            <Field span="md:col-span-4" id="consigneeEori" label="EORI / ID" de="DE 3/10">
              <Input
                id="consigneeEori"
                value={formData.consigneeEori}
                onChange={(e) => patch("consigneeEori", e.target.value.toUpperCase())}
                placeholder="Optional"
                className="font-mono"
              />
            </Field>
            <Field
              span="md:col-span-8"
              id="consigneeName"
              label="Name"
              de="DE 3/9"
              required={exportSet}
            >
              <Input
                id="consigneeName"
                value={formData.consigneeName}
                onChange={(e) => patch("consigneeName", e.target.value)}
                placeholder={exportSet ? "Required on export" : "Optional"}
              />
            </Field>
            <Field span="md:col-span-5" id="consigneeLine" label="Address line">
              <Input
                id="consigneeLine"
                value={formData.consigneeLine}
                onChange={(e) => patch("consigneeLine", e.target.value)}
              />
            </Field>
            <Field span="md:col-span-3" id="consigneeCity" label="City">
              <Input
                id="consigneeCity"
                value={formData.consigneeCity}
                onChange={(e) => patch("consigneeCity", e.target.value)}
              />
            </Field>
            <Field span="md:col-span-2" id="consigneePostcode" label="Postcode">
              <Input
                id="consigneePostcode"
                value={formData.consigneePostcode}
                onChange={(e) => patch("consigneePostcode", e.target.value.toUpperCase())}
                className="font-mono"
              />
            </Field>
            <Field span="md:col-span-2" id="consigneeCountry" label="Country">
              <Select
                value={formData.consigneeCountry || NONE}
                onValueChange={(v) => patch("consigneeCountry", v === NONE ? "" : v)}
              >
                <SelectTrigger id="consigneeCountry" className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  <SelectItem value={NONE}>Not declared</SelectItem>
                  {countryOptions}
                </SelectContent>
              </Select>
            </Field>
          </>,
        )}
      </PageSection>

      <PageSection
        title="Exporter"
        description={
          exportSet
            ? "The party sending the goods out of the UK. A GB or XI EORI is enough on its own — give name and address only where the exporter holds no EORI."
            : "Required when dispatch is not GB or XI. Use the foreign seller on the commercial invoice — legal name and registered address in the dispatch country, not your UK importer details."
        }
      >
        {fieldGrid(
          <>
            {exportSet && (
              <Field span="md:col-span-6" id="exporterEori" label="Exporter EORI" de="DE 3/2">
                <Input
                  id="exporterEori"
                  value={formData.exporterEori}
                  onChange={(e) => patch("exporterEori", e.target.value.toUpperCase())}
                  placeholder="GB123456789000"
                  className="font-mono"
                />
              </Field>
            )}
            <Field
              span="md:col-span-6"
              id="exporterName"
              label="Exporter name"
              de="DE 3/1"
              required={exportSet ? false : overseasDispatch}
            >
              <Input
                id="exporterName"
                value={formData.exporterName}
                onChange={(e) => patch("exporterName", e.target.value)}
                placeholder={exportSet ? "Only needed without an EORI" : "e.g. Acme Export GmbH"}
              />
            </Field>
            <Field span="md:col-span-6" id="exporterLine" label="Address line">
              <Input
                id="exporterLine"
                value={formData.exporterLine}
                onChange={(e) => patch("exporterLine", e.target.value)}
                placeholder={exportSet ? undefined : "e.g. 1 Hafenstrasse"}
              />
            </Field>
            <Field span="md:col-span-3" id="exporterCity" label="City">
              <Input
                id="exporterCity"
                value={formData.exporterCity}
                onChange={(e) => patch("exporterCity", e.target.value)}
                placeholder={exportSet ? undefined : "e.g. Hamburg"}
              />
            </Field>
            <Field span="md:col-span-3" id="exporterPostcode" label="Postcode">
              <Input
                id="exporterPostcode"
                value={formData.exporterPostcode}
                onChange={(e) => patch("exporterPostcode", e.target.value.toUpperCase())}
                className="font-mono"
              />
            </Field>
          </>,
        )}
      </PageSection>

      <PageSection
        title="Representation"
        description="Indirect representation requires internal approval before submission."
      >
        {representationStatus === undefined ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading representation…
          </div>
        ) : (
          <>
            {fieldGrid(
              <>
                <Field span="md:col-span-4" id="repType" label="Representation" de="DE 3/21">
                  <Select
                    value={repForm.representationType}
                    onValueChange={(v) => {
                      setSaved(false);
                      setSaveError(null);
                      setRepForm((prev) => ({
                        ...prev,
                        representationType: v as RepresentationType,
                      }));
                    }}
                  >
                    <SelectTrigger id="repType" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {REPRESENTATION_TYPES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {showRepFields && (
                  <>
                    <Field
                      span="md:col-span-4"
                      id="repEori"
                      label="Representative EORI"
                      de="DE 3/19"
                      required
                    >
                      <Input
                        id="repEori"
                        value={repForm.representativeEori}
                        onChange={(e) => {
                          setSaved(false);
                          setSaveError(null);
                          setRepForm({ ...repForm, representativeEori: e.target.value.toUpperCase() });
                        }}
                        placeholder="GB123456789000"
                        className="font-mono"
                      />
                    </Field>
                    <Field span="md:col-span-4" id="repName" label="Representative name" de="DE 3/19">
                      <Input
                        id="repName"
                        value={repForm.representativeName}
                        onChange={(e) => {
                          setSaved(false);
                          setSaveError(null);
                          setRepForm({ ...repForm, representativeName: e.target.value });
                        }}
                      />
                    </Field>
                    <Field
                      span="md:col-span-12"
                      id="repAddress"
                      label="Representative address"
                      de="DE 3/19"
                    >
                      <Input
                        id="repAddress"
                        value={repForm.representativeAddressLine}
                        onChange={(e) => {
                          setSaved(false);
                          setSaveError(null);
                          setRepForm({ ...repForm, representativeAddressLine: e.target.value });
                        }}
                        placeholder="Address line"
                      />
                    </Field>
                    <Field span="md:col-span-4" id="repCity" label="City">
                      <Input
                        id="repCity"
                        value={repForm.representativeCity}
                        onChange={(e) => {
                          setSaved(false);
                          setSaveError(null);
                          setRepForm({ ...repForm, representativeCity: e.target.value });
                        }}
                      />
                    </Field>
                    <Field span="md:col-span-4" id="repPostcode" label="Postcode">
                      <Input
                        id="repPostcode"
                        value={repForm.representativePostcode}
                        onChange={(e) => {
                          setSaved(false);
                          setSaveError(null);
                          setRepForm({ ...repForm, representativePostcode: e.target.value });
                        }}
                      />
                    </Field>
                    <Field span="md:col-span-4" id="repCountry" label="Country">
                      <Select
                        value={repForm.representativeCountry || NONE}
                        onValueChange={(v) => {
                          setSaved(false);
                          setSaveError(null);
                          setRepForm({
                            ...repForm,
                            representativeCountry: v === NONE ? "" : v,
                          });
                        }}
                      >
                        <SelectTrigger id="repCountry" className="w-full">
                          <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-[300px]">
                          <SelectItem value={NONE}>Select country</SelectItem>
                          {countries.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name} ({c.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                )}
              </>,
            )}
            {showAuthority && (
              <MutedPanel className="mt-4 space-y-3">
                <p className="text-xs font-medium">Authority documents (indirect)</p>
                <label className="flex items-center gap-2 text-xs">
                  <CompactCheckbox
                    border="amber"
                    checked={repForm.authorityVerified}
                    onChange={(e) => {
                      setSaved(false);
                      setSaveError(null);
                      setRepForm({ ...repForm, authorityVerified: e.target.checked });
                    }}
                  />
                  Authority documents verified
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field span="" id="authFrom" label="Valid from">
                    <Input
                      id="authFrom"
                      type="date"
                      value={repForm.authorityValidFrom}
                      onChange={(e) => {
                        setSaved(false);
                        setSaveError(null);
                        setRepForm({ ...repForm, authorityValidFrom: e.target.value });
                      }}
                    />
                  </Field>
                  <Field span="" id="authTo" label="Valid to">
                    <Input
                      id="authTo"
                      type="date"
                      value={repForm.authorityValidTo}
                      onChange={(e) => {
                        setSaved(false);
                        setSaveError(null);
                        setRepForm({ ...repForm, authorityValidTo: e.target.value });
                      }}
                    />
                  </Field>
                </div>
                {representationStatus?.approvalRequired && (
                  <p
                    className={cn(
                      "text-xs",
                      representationStatus?.approvalCurrent
                        ? "text-emerald-700"
                        : "text-muted-foreground",
                    )}
                  >
                    {representationStatus?.approvalCurrent
                      ? "Approved — submit unlocked."
                      : representationStatus?.reason ??
                        "Internal approval required on Submit tab before HMRC submission."}
                  </p>
                )}
              </MutedPanel>
            )}
          </>
        )}
      </PageSection>

      <PageSection
        title="Routing and transport"
        description="Countries, mode and conveyance identity."
      >
        {fieldGrid(
          <>
            <Field
              span="md:col-span-6"
              id="dispatch"
              label="Dispatch country"
              de="DE 5/14"
              required
            >
              <Select
                value={formData.dispatchCountry || NONE}
                onValueChange={(v) => patch("dispatchCountry", v === NONE ? "" : v)}
              >
                <SelectTrigger id="dispatch" className="w-full">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {countryOptions}
                </SelectContent>
              </Select>
            </Field>

            <Field
              span="md:col-span-6"
              id="destination"
              label="Destination country"
              de="DE 5/8"
              required
            >
              <Select
                value={formData.destinationCountry || NONE}
                onValueChange={(v) => patch("destinationCountry", v === NONE ? "" : v)}
              >
                <SelectTrigger id="destination" className="w-full">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {countryOptions}
                </SelectContent>
              </Select>
            </Field>

            <Field span="md:col-span-4" id="mode" label="Transport mode" de="DE 7/4" required>
              <Select
                value={formData.transportMode || NONE}
                onValueChange={(v) => patch("transportMode", v === NONE ? "" : v)}
              >
                <SelectTrigger id="mode" className="w-full">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {TRANSPORT_MODE_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              span="md:col-span-4"
              id="idType"
              label="Identification type"
              de="DE 7/9"
              required
            >
              <Select
                value={formData.transportIdType || NONE}
                onValueChange={(v) => patch("transportIdType", v === NONE ? "" : v)}
              >
                <SelectTrigger id="idType" className="w-full">
                  <SelectValue placeholder="Select identifier type" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {TRANSPORT_ID_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field span="md:col-span-4" id="transportId" label="Identification" de="DE 7/9" required>
              <Input
                id="transportId"
                value={formData.transportId}
                onChange={(e) => patch("transportId", e.target.value)}
                placeholder="Vessel, flight or registration"
                className="font-mono"
              />
            </Field>

            <Field
              span="md:col-span-6"
              id="container"
              label="Container number"
              de="DE 7/10"
              hint="Shown for operator verification against the CNS inventory record."
            >
              <Input
                id="container"
                value={formData.containerNumber}
                onChange={(e) => patch("containerNumber", e.target.value.toUpperCase())}
                placeholder="MSCU1234567"
                className="font-mono"
              />
            </Field>

            <Field span="md:col-span-6" id="seal" label="Seal number" de="DE 7/18">
              <Input
                id="seal"
                value={formData.sealNumber}
                onChange={(e) => patch("sealNumber", e.target.value)}
                className="font-mono"
              />
            </Field>
          </>,
        )}
      </PageSection>

      <PageSection title="Goods location" description="Where the goods are presented to customs.">
        {fieldGrid(
          <>
            <Field
              span="md:col-span-8"
              id="locationId"
              label="Location of goods"
              de="DE 5/23"
              required
              hint="Appendix 16C maritime codes."
            >
              <Select
                value={locationIdIsKnown ? locationIdUpper : undefined}
                onValueChange={(code) => {
                  setSaved(false);
                  setSaveError(null);
                  setFormData({ ...formData, locationId: code, goodsLocationKind: "port" });
                }}
              >
                <SelectTrigger id="locationId" className="w-full">
                  <SelectValue placeholder="Select maritime port or wharf (Appendix 16C)" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {PORT_LOCATION_OPTIONS.map(({ code, name }) => (
                    <SelectItem key={code} value={code} className="text-xs">
                      {name} — {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {locationIdUpper && !locationIdIsKnown && (
              <Field
                span="md:col-span-8"
                id="locationIdUnknown"
                label="Location ID"
                hint={
                  <>
                    This declaration has code{" "}
                    <code className="font-mono">{formData.locationId.trim()}</code>, which is not in
                    Appendix 16C. Pick a port above or replace it
                    below, then save.
                  </>
                }
              >
                <Input
                  id="locationIdUnknown"
                  value={formData.locationId}
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase();
                    setSaved(false);
                    setSaveError(null);
                    setFormData({
                      ...formData,
                      locationId: next,
                      goodsLocationKind:
                        inferGoodsLocationKind({ locationId: next, goodsLocationKind: "port" }) ||
                        "",
                    });
                  }}
                  className="font-mono"
                />
              </Field>
            )}

            <Field
              span="md:col-span-4"
              id="presentation"
              label="Office of presentation"
              de="DE 5/26"
              hint="Conditional — required only when goods are not at the goods location."
            >
              <Input
                id="presentation"
                value={formData.presentationOffice}
                onChange={(e) => patch("presentationOffice", e.target.value.toUpperCase())}
                placeholder="e.g. GBLON004 (only if presented elsewhere)"
                className="font-mono"
              />
            </Field>

            {locationIdUpper === LONDON_GATEWAY && (
              <Field
                span="md:col-span-6"
                id="cns"
                label="CNS UCN"
                required
                hint="Inventory reference used to link the declaration at London Gateway."
              >
                <Input
                  id="cns"
                  value={formData.cnsUcn || String(declaration.cnsUcn ?? "")}
                  onChange={(e) => patch("cnsUcn", e.target.value.toUpperCase())}
                  placeholder="LGP100DPS00100"
                  className="font-mono"
                />
              </Field>
            )}
          </>,
        )}
      </PageSection>

      <PageSection title="Valuation" description="Invoice, delivery terms and transaction nature.">
        {fieldGrid(
          <>
            <Field
              span="md:col-span-3"
              id="currency"
              label="Invoice currency"
              de="DE 4/11"
              required
            >
              <Input
                id="currency"
                value={formData.invoiceCurrency}
                onChange={(e) => patch("invoiceCurrency", e.target.value.toUpperCase())}
                placeholder="GBP"
                className="font-mono"
              />
            </Field>

            <Field
              span="md:col-span-3"
              id="total"
              label="Invoice total"
              de="DE 4/11"
              hint="Optional override — leave blank to derive from goods item values."
            >
              <Input
                id="total"
                value={formData.invoiceTotal}
                onChange={(e) => patch("invoiceTotal", e.target.value)}
                inputMode="decimal"
                placeholder="If empty, mapper sums from items"
                className="text-right font-mono"
              />
            </Field>

            {!exportSet && (
              <Field span="md:col-span-3" id="incoterms" label="Incoterms" de="DE 4/1">
                <Select
                  value={formData.incoterms || NONE}
                  onValueChange={(v) => patch("incoterms", v === NONE ? "" : v)}
                >
                  <SelectTrigger id="incoterms" className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value={NONE}>Not declared</SelectItem>
                    {incotermOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {!exportSet && (
              <Field
                span="md:col-span-3"
                id="incotermLocation"
                label="Incoterm location"
                de="DE 4/1"
                hint="Required with CIF for method-1 valuation. Mapper sends GB + place (e.g. Felixstowe → GBFELIXSTOWE) per Group 4."
              >
                <Input
                  id="incotermLocation"
                  value={formData.incotermLocation}
                  onChange={(e) => patch("incotermLocation", e.target.value)}
                  placeholder="e.g. Felixstowe or GBFXT"
                  className="font-mono"
                />
              </Field>
            )}

            <Field
              span="md:col-span-3"
              id="nature"
              label="Nature of transaction"
              de="DE 8/5"
              required
              hint="WCOID 103 — GoodsShipment/TransactionNatureCode. Trade Test passing baseline uses 11."
            >
              <Input
                id="nature"
                value={formData.transactionNatureCode}
                onChange={(e) =>
                  patch("transactionNatureCode", e.target.value.replace(/\D/g, "").slice(0, 2))
                }
                inputMode="numeric"
                placeholder="11"
                className="font-mono"
              />
            </Field>
          </>,
        )}
      </PageSection>

      <PageSection title="Duty payment" description="Method of payment and deferment account.">
        {fieldGrid(
          <>
            <Field span="md:col-span-6" id="payment" label="Payment method" de="DE 4/8">
              <Select
                value={formData.paymentMethodCode || NONE}
                onValueChange={(v) => {
                  const next = v === NONE ? "" : v;
                  setSaved(false);
                  setSaveError(null);
                  setFormData({
                    ...formData,
                    paymentMethodCode: next,
                    defermentAccountNumber:
                      next === "E" || next === "R" ? formData.defermentAccountNumber : "",
                  });
                }}
              >
                <SelectTrigger id="payment" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {PAYMENT_METHOD_OPTIONS.map((m) => (
                    <SelectItem key={m.value || NONE} value={m.value || NONE}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {requiresDefermentAccount(formData.paymentMethodCode) && (
              <Field
                span="md:col-span-6"
                id="deferment"
                label="Deferment account"
                de="DE 2/6"
                required
              >
                <Input
                  id="deferment"
                  value={formData.defermentAccountNumber}
                  onChange={(e) =>
                    patch(
                      "defermentAccountNumber",
                      e.target.value.replace(/\D/g, "").slice(0, 7),
                    )
                  }
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="7-digit DAN"
                  className="font-mono"
                />
              </Field>
            )}
          </>,
        )}
      </PageSection>

      <MutedPanel className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-card">
        <span className={saveError ? "text-destructive" : "text-muted-foreground"}>
          {saveError
            ? saveError
            : saved && !dirty
              ? "Core details saved."
              : dirty
                ? "Unsaved changes"
                : "Save writes these fields to the declaration."}
        </span>
        <span className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setFormData(formBaseline);
              setRepForm(repBaseline);
              setSaveError(null);
              setSaved(false);
            }}
            disabled={!dirty || saving}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={!dirty || saving}
          >
            {saving ? "Saving…" : "Save core details"}
          </Button>
        </span>
      </MutedPanel>
    </PageContainer>
  );
}
