"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Download, Loader2, Plus, Printer, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  openEndUserStatementPrintDialog,
  downloadEndUserStatementHtml,
  EUSU_ROLE_LABELS,
  END_USER_CERTIFICATIONS,
  STOCKIST_CERTIFICATIONS,
  type EusuDetails,
  type EusuItemLine,
  type EusuRoles,
} from "@/lib/export-controls/end-user-statement";

const inputCls = "mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs";
const textareaCls = "mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs";
const labelCls = "text-[11px] font-medium text-slate-600";
const sectionCls = "space-y-4 rounded-xl border border-slate-200 bg-white p-5";
const sectionTitleCls = "text-sm font-semibold text-slate-900";

const defaultRoles: EusuRoles = {
  consignee: false,
  endUser: true,
  intermediateUser: false,
  ultimateEndUser: false,
  stockistNoOrders: false,
  stockistConfirmed: false,
};

function YesNo({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <div className="mt-1 flex gap-4 text-xs text-slate-700">
        {[true, false].map((option) => (
          <label key={String(option)} className="flex items-center gap-1.5">
            <input
              type="radio"
              name={id}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {option ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </div>
  );
}

export function EndUserStatementPage({ token }: { token: string }) {
  const data = useQuery(api.compliance_end_user.getEndUserFormByToken, { token });
  const markOpened = useMutation(api.compliance_end_user.markEndUserTokenOpened);
  const submit = useMutation(api.compliance_end_user.submitEndUserStatement);

  // Export process (roles)
  const [roles, setRoles] = useState<EusuRoles>(defaultRoles);
  const [rolesSeeded, setRolesSeeded] = useState(false);

  // Section 1
  const [exporterName, setExporterName] = useState("");
  const [exporterLicenceRef, setExporterLicenceRef] = useState("");

  // Section 2
  const [items, setItems] = useState<EusuItemLine[]>([]);
  const [itemsSeeded, setItemsSeeded] = useState(false);

  // Section 3
  const [consigneeName, setConsigneeName] = useState("");
  const [consigneeAddress, setConsigneeAddress] = useState("");

  // Section 4
  const [endUserName, setEndUserName] = useState("");
  const [endUserAddress, setEndUserAddress] = useState("");
  const [endUserCountry, setEndUserCountry] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [endUserWebsite, setEndUserWebsite] = useState("");
  const [armedForces, setArmedForces] = useState<boolean | undefined>(undefined);

  // Section 5
  const [intendedUse, setIntendedUse] = useState("");
  const [incorporation, setIncorporation] = useState<boolean | undefined>(undefined);
  const [soleUser, setSoleUser] = useState<boolean | undefined>(undefined);
  const [otherSupportingInfo, setOtherSupportingInfo] = useState("");

  // Section 6
  const [intermediateUserDetails, setIntermediateUserDetails] = useState("");
  const [intermediateUse, setIntermediateUse] = useState("");

  // Section 7
  const [newProductDescription, setNewProductDescription] = useState("");
  const [ultimateEndUserDetails, setUltimateEndUserDetails] = useState("");

  // Sections 8 / 9
  const [noProhibitedEndUse, setNoProhibitedEndUse] = useState(false);
  const [noDiversion, setNoDiversion] = useState(false);
  const [signedBy, setSignedBy] = useState("");
  const [signedJobRole, setSignedJobRole] = useState("");
  const [stockistReExport, setStockistReExport] = useState<"no_reexport" | "likely_exports">("no_reexport");
  const [stockistLikelyExports, setStockistLikelyExports] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!data || data.completedAt) return;
    void markOpened({ token });
  }, [data, markOpened, token]);

  useEffect(() => {
    if (!data?.assessment) return;
    const eu = data.assessment.endUser as { name?: string; address?: string; country?: string } | undefined;
    if (eu?.name && !endUserName) setEndUserName(eu.name);
    if (eu?.address && !endUserAddress) setEndUserAddress(eu.address);
    if (eu?.country && !endUserCountry) setEndUserCountry(eu.country);
    if (data.assessment.intendedUse && !intendedUse) setIntendedUse(data.assessment.intendedUse);
    if (data.recipientEmail && !contactEmail) setContactEmail(data.recipientEmail);
    const consignee = data.assessment.consignee as { name?: string; address?: string } | undefined;
    if (consignee?.name && !consigneeName) setConsigneeName(consignee.name);
    if (consignee?.address && !consigneeAddress) setConsigneeAddress(consignee.address);
    if (consignee?.name && !rolesSeeded) setRoles((prev) => ({ ...prev, consignee: true }));
    if (!rolesSeeded) setRolesSeeded(true);
    if (!itemsSeeded) {
      setItems(
        data.products.length > 0
          ? data.products.map((p) => ({
              description: p.techDescription?.trim() || p.name,
              quantity: p.quantity != null ? String(p.quantity) : "",
              unit: "",
            }))
          : [{ description: "", quantity: "", unit: "" }],
      );
      setItemsSeeded(true);
    }
  }, [data, contactEmail, consigneeAddress, consigneeName, endUserAddress, endUserCountry, endUserName, intendedUse, itemsSeeded, rolesSeeded]);

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading form…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-600">This link is invalid or has expired.</p>
      </div>
    );
  }

  const statement = data.assessment.endUserStatement as {
    signedBy: string;
    signedAt: number;
    endUserName: string;
    endUserAddress: string;
    endUserCountry: string;
    contactName: string;
    contactEmail?: string;
    intendedUse: string;
    eusu?: EusuDetails;
  } | undefined;

  if (data.completedAt || done) {
    const signedAt = statement?.signedAt ?? Date.now();
    const printInput = statement && {
      assessmentReference: data.assessment.reference,
      destinationCountry: data.assessment.destinationCountry,
      products: data.products,
      endUserName: statement.endUserName,
      endUserAddress: statement.endUserAddress,
      endUserCountry: statement.endUserCountry,
      contactName: statement.contactName,
      contactEmail: statement.contactEmail,
      intendedUse: statement.intendedUse,
      signedBy: statement.signedBy,
      signedAt,
      eusu: statement.eusu,
    };
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-green-200 bg-white p-8 text-center">
          <Check className="mx-auto h-8 w-8 text-green-600" />
          <p className="mt-3 text-sm font-semibold text-slate-900">EUSU submitted</p>
          <p className="mt-2 text-xs text-slate-500">
            Thank you. Assessment {data.assessment.reference} has been updated.
          </p>
          {printInput && (
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => openEndUserStatementPrintDialog(printInput)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-3.5 w-3.5" />
                Print PDF
              </button>
              <button
                type="button"
                onClick={() => downloadEndUserStatementHtml(printInput)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const showConsignee = roles.consignee || roles.stockistConfirmed;
  const showEndUser = roles.endUser || roles.stockistNoOrders || roles.stockistConfirmed;
  const showEndUse = roles.endUser || roles.stockistConfirmed;
  const showUltimate = roles.ultimateEndUser || soleUser === false;
  const isStockistSection9 = roles.stockistNoOrders;
  const certifications = isStockistSection9 ? STOCKIST_CERTIFICATIONS : END_USER_CERTIFICATIONS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const eusu: EusuDetails = {
        roles,
        exporterName: exporterName.trim() || undefined,
        exporterLicenceRef: exporterLicenceRef.trim() || undefined,
        items: items
          .filter((item) => item.description.trim())
          .map((item) => ({
            description: item.description.trim(),
            quantity: item.quantity?.trim() || undefined,
            unit: item.unit?.trim() || undefined,
          })),
        consigneeName: consigneeName.trim() || undefined,
        consigneeAddress: consigneeAddress.trim() || undefined,
        endUserWebsite: endUserWebsite.trim() || undefined,
        armedForces,
        incorporation,
        soleUser,
        otherSupportingInfo: otherSupportingInfo.trim() || undefined,
        intermediateUserDetails: intermediateUserDetails.trim() || undefined,
        intermediateUse: intermediateUse.trim() || undefined,
        newProductDescription: newProductDescription.trim() || undefined,
        ultimateEndUserDetails: ultimateEndUserDetails.trim() || undefined,
        signatureSection: isStockistSection9 ? "stockist" : "end_user",
        signedJobRole: signedJobRole.trim() || undefined,
        stockistReExport: isStockistSection9 ? stockistReExport : undefined,
        stockistLikelyExports:
          isStockistSection9 && stockistReExport === "likely_exports"
            ? stockistLikelyExports.trim() || undefined
            : undefined,
      };
      await submit({
        token,
        endUserName,
        endUserAddress,
        endUserCountry,
        contactName,
        contactEmail: contactEmail.trim() || undefined,
        intendedUse,
        noProhibitedEndUse,
        noDiversion,
        signedBy,
        eusu,
      });
      setDone(true);
      // Notify the sender; failure here must not affect the buyer's submission.
      void fetch("/api/export-controls/eusu-submitted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).catch(() => undefined);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
          Freightcode · End-user and stockist undertaking (EUSU)
        </p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{data.assessment.reference}</h1>
        <p className="mt-1 text-xs text-slate-500">
          Structured to the official GOV.UK EUSU form (June 2025). Destination: {data.assessment.destinationCountry ?? "—"}
        </p>
        {data.senderNote && (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium">Note:</span> {data.senderNote}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-2xl p-6">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* Export process */}
          <section className={sectionCls}>
            <div>
              <h2 className={sectionTitleCls}>Export process</h2>
              <p className="mt-1 text-xs text-slate-500">
                Mark all relevant parties involved in the export — the sections below appear based on what you mark.
                Sections 1 and 2 are required for all applications.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {EUSU_ROLE_LABELS.map((role) => (
                <label
                  key={role.key}
                  className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={roles[role.key]}
                    onChange={(e) => setRoles((prev) => ({ ...prev, [role.key]: e.target.checked }))}
                  />
                  <span>
                    {role.label}
                    <span className="block text-[10px] text-slate-400">{role.sections}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* Section 1 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>Section 1: UK exporter</h2>
            <div>
              <label htmlFor="exporter-name" className={labelCls}>
                Name of UK exporter <span className="text-red-600">*</span>
              </label>
              <input
                id="exporter-name"
                required
                value={exporterName}
                onChange={(e) => setExporterName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="exporter-ref" className={labelCls}>
                UK exporter&apos;s licence application reference (optional)
              </label>
              <input
                id="exporter-ref"
                value={exporterLicenceRef}
                onChange={(e) => setExporterLicenceRef(e.target.value)}
                className={inputCls}
              />
            </div>
          </section>

          {/* Section 2 */}
          <section className={sectionCls}>
            <div>
              <h2 className={sectionTitleCls}>Section 2: Items</h2>
              <p className="mt-1 text-xs text-slate-500">
                Provide a plain-English description for every item, including spares, components or accessories.
              </p>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-semibold text-slate-400">Item {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`Remove item ${index + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={item.description}
                    onChange={(e) =>
                      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, description: e.target.value } : it)))
                    }
                    rows={2}
                    placeholder="Item description"
                    className={textareaCls}
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      value={item.quantity ?? ""}
                      onChange={(e) =>
                        setItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity: e.target.value } : it)))
                      }
                      placeholder="Quantity"
                      className="h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
                    />
                    <input
                      value={item.unit ?? ""}
                      onChange={(e) =>
                        setItems((prev) => prev.map((it, i) => (i === index ? { ...it, unit: e.target.value } : it)))
                      }
                      placeholder="Unit of measurement (e.g. pieces)"
                      className="h-9 w-full rounded-md border border-slate-200 px-3 text-xs"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { description: "", quantity: "", unit: "" }])}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </button>
            </div>
          </section>

          {/* Section 3 */}
          {showConsignee && (
            <section className={sectionCls}>
              <div>
                <h2 className={sectionTitleCls}>Section 3: Consignee</h2>
                <p className="mt-1 text-xs text-slate-500">
                  The initial recipient of the items outside the UK (the importer of record) — not the freight
                  forwarder. If the consignee is the same entity as the end-user, enter: &quot;The consignee is the
                  same entity as the end-user in Section 4&quot;.
                </p>
              </div>
              <div>
                <label htmlFor="consignee-name" className={labelCls}>
                  Consignee&apos;s name
                </label>
                <input
                  id="consignee-name"
                  value={consigneeName}
                  onChange={(e) => setConsigneeName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="consignee-address" className={labelCls}>
                  Consignee&apos;s address
                </label>
                <textarea
                  id="consignee-address"
                  value={consigneeAddress}
                  onChange={(e) => setConsigneeAddress(e.target.value)}
                  rows={2}
                  className={textareaCls}
                />
              </div>
            </section>
          )}

          {/* Section 4 */}
          {showEndUser && (
            <section className={sectionCls}>
              <h2 className={sectionTitleCls}>Section 4: End-user</h2>
              <div>
                <label htmlFor="eu-name" className={labelCls}>
                  End-user&apos;s name <span className="text-red-600">*</span>
                </label>
                <input
                  id="eu-name"
                  required
                  value={endUserName}
                  onChange={(e) => setEndUserName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="eu-address" className={labelCls}>
                  End-user&apos;s address (where the items will be used or kept)
                </label>
                <textarea
                  id="eu-address"
                  value={endUserAddress}
                  onChange={(e) => setEndUserAddress(e.target.value)}
                  rows={2}
                  className={textareaCls}
                />
              </div>
              <div>
                <label htmlFor="eu-country" className={labelCls}>
                  Country
                </label>
                <input
                  id="eu-country"
                  value={endUserCountry}
                  onChange={(e) => setEndUserCountry(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className={labelCls}>
                    Contact name (responsible official) <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="contact-name"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className={labelCls}>
                    Contact email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="eu-website" className={labelCls}>
                  End-user&apos;s website (leave blank if none)
                </label>
                <input
                  id="eu-website"
                  value={endUserWebsite}
                  onChange={(e) => setEndUserWebsite(e.target.value)}
                  className={inputCls}
                />
              </div>
              <YesNo
                id="armed-forces"
                label="Is the end-user part of the armed forces or internal security forces of their country?"
                value={armedForces}
                onChange={setArmedForces}
              />
            </section>
          )}

          {/* Section 5 */}
          {showEndUse && (
            <section className={sectionCls}>
              <h2 className={sectionTitleCls}>Section 5: Intended end-use</h2>
              <div>
                <label htmlFor="intended-use" className={labelCls}>
                  Intended end-use of the items <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="intended-use"
                  required
                  value={intendedUse}
                  onChange={(e) => setIntendedUse(e.target.value)}
                  rows={3}
                  placeholder="Explain how the end-user intends to use the items, with as much detail as possible."
                  className={textareaCls}
                />
              </div>
              <YesNo
                id="incorporation"
                label="Are the items going to be incorporated into another product or higher-level system?"
                value={incorporation}
                onChange={setIncorporation}
              />
              {incorporation === true && (
                <YesNo
                  id="sole-user"
                  label="Will the end-user be the only user of the new product or higher-level system?"
                  value={soleUser}
                  onChange={setSoleUser}
                />
              )}
              <div>
                <label htmlFor="other-info" className={labelCls}>
                  Other supporting information (optional)
                </label>
                <textarea
                  id="other-info"
                  value={otherSupportingInfo}
                  onChange={(e) => setOtherSupportingInfo(e.target.value)}
                  rows={2}
                  placeholder="Contracts in place, others who will use or access the items, supply chains, re-export licence arrangements…"
                  className={textareaCls}
                />
              </div>
            </section>
          )}

          {/* Section 6 */}
          {roles.intermediateUser && (
            <section className={sectionCls}>
              <h2 className={sectionTitleCls}>Section 6: Intermediate user</h2>
              <div>
                <label htmlFor="intermediate-details" className={labelCls}>
                  Name and address of the organisation or individual using the items after incorporation or processing
                </label>
                <textarea
                  id="intermediate-details"
                  value={intermediateUserDetails}
                  onChange={(e) => setIntermediateUserDetails(e.target.value)}
                  rows={2}
                  className={textareaCls}
                />
              </div>
              <div>
                <label htmlFor="intermediate-use" className={labelCls}>
                  Intended intermediate use of the items
                </label>
                <textarea
                  id="intermediate-use"
                  value={intermediateUse}
                  onChange={(e) => setIntermediateUse(e.target.value)}
                  rows={2}
                  className={textareaCls}
                />
              </div>
            </section>
          )}

          {/* Section 7 */}
          {showUltimate && (
            <section className={sectionCls}>
              <h2 className={sectionTitleCls}>Section 7: Ultimate end-user</h2>
              <div>
                <label htmlFor="new-product" className={labelCls}>
                  Describe the new product or higher-level system and its intended end-use
                </label>
                <textarea
                  id="new-product"
                  value={newProductDescription}
                  onChange={(e) => setNewProductDescription(e.target.value)}
                  rows={2}
                  className={textareaCls}
                />
              </div>
              <div>
                <label htmlFor="ultimate-details" className={labelCls}>
                  Name and address of the ultimate end-user(s)
                </label>
                <textarea
                  id="ultimate-details"
                  value={ultimateEndUserDetails}
                  onChange={(e) => setUltimateEndUserDetails(e.target.value)}
                  rows={2}
                  className={textareaCls}
                />
              </div>
            </section>
          )}

          {/* Section 8 / 9 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>
              {isStockistSection9 ? "Section 9: Stockist sign and date" : "Section 8: End-user sign and date"}
            </h2>
            <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-medium">
                {isStockistSection9
                  ? "I certify that I have the authority to sign for the stockist of the items described in Section 2, supplied by the UK exporter named in Section 1. I also certify that:"
                  : "I certify that I have the authority to sign for the end-user of the items described in Section 2, supplied by the UK exporter named in Section 1. I certify that:"}
              </p>
              <ul className="list-disc space-y-1 pl-4">
                {certifications.map((cert) => (
                  <li key={cert}>{cert}</li>
                ))}
              </ul>
            </div>
            {isStockistSection9 && (
              <div className="space-y-2 text-xs text-slate-700">
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="stockist-reexport"
                    className="mt-0.5"
                    checked={stockistReExport === "no_reexport"}
                    onChange={() => setStockistReExport("no_reexport")}
                  />
                  <span>The items will not be re-exported, sold for export or otherwise exported from the country where we are based.</span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="stockist-reexport"
                    className="mt-0.5"
                    checked={stockistReExport === "likely_exports"}
                    onChange={() => setStockistReExport("likely_exports")}
                  />
                  <span>The items are likely to be exported to the following countries and customers:</span>
                </label>
                {stockistReExport === "likely_exports" && (
                  <textarea
                    value={stockistLikelyExports}
                    onChange={(e) => setStockistLikelyExports(e.target.value)}
                    rows={2}
                    placeholder="Countries and customers"
                    className={textareaCls}
                  />
                )}
              </div>
            )}
            <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={noProhibitedEndUse}
                  onChange={(e) => setNoProhibitedEndUse(e.target.checked)}
                  className="mt-0.5"
                />
                <span>I confirm the certifications above regarding prohibited end uses (including WMD or means of delivery).</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={noDiversion}
                  onChange={(e) => setNoDiversion(e.target.checked)}
                  className="mt-0.5"
                />
                <span>I confirm the certifications above regarding re-export, resale, transfer and sanctioned destinations.</span>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="signed-by" className={labelCls}>
                  Print name <span className="text-red-600">*</span>
                </label>
                <input
                  id="signed-by"
                  required
                  value={signedBy}
                  onChange={(e) => setSignedBy(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="job-role" className={labelCls}>
                  Job role
                </label>
                <input
                  id="job-role"
                  value={signedJobRole}
                  onChange={(e) => setSignedJobRole(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !noProhibitedEndUse || !noDiversion}
            className="h-9 w-full rounded-md bg-black text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit EUSU"}
          </button>
        </form>
      </main>
    </div>
  );
}
