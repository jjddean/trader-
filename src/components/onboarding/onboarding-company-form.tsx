"use client";

import { useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { countries } from "@/lib/data/countries";
import { userMessageFromError } from "@/lib/convex-errors";
import {
  ONBOARD_INPUT,
  ONBOARD_LABEL,
  ONBOARD_SECTION,
  OnboardingShell,
} from "@/components/onboarding/onboarding-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENTERPRISE_SELECT_CONTENT,
  ENTERPRISE_SELECT_ITEM,
  ENTERPRISE_SELECT_TRIGGER,
} from "@/lib/enterprise-select-styles";

export interface OnboardingFormValues {
  companyName: string;
  legalEntityType: string;
  companyRegistrationNumber: string;
  tradingName: string;
  country: string;
  addressLine: string;
  postcode: string;
  city: string;
  website: string;
  eori: string;
  contactName: string;
  contactJobTitle: string;
  contactEmail: string;
  contactPhone: string;
  cdsSubscribed: boolean;
  termsAccepted: boolean;
}

interface OnboardingCompanyFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  path: "broker" | "managed_service";
  onSuccess: (next: "choose-organization" | "portal") => void;
}

export function OnboardingCompanyForm({
  title,
  subtitle,
  submitLabel,
  path,
  onSuccess,
}: OnboardingCompanyFormProps) {
  const { user } = useUser();
  const { orgId } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);
  const completeBroker = useMutation(api.onboarding.completeBroker);
  const completeManaged = useMutation(api.onboarding.completeManagedService);

  const [form, setForm] = useState<OnboardingFormValues>({
    companyName: "",
    legalEntityType: "",
    companyRegistrationNumber: "",
    tradingName: "",
    country: "GB",
    addressLine: "",
    postcode: "",
    city: "",
    website: "",
    eori: "",
    contactName: user?.fullName ?? "",
    contactJobTitle: "",
    contactEmail: user?.primaryEmailAddress?.emailAddress ?? "",
    contactPhone: "",
    cdsSubscribed: false,
    termsAccepted: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Managed Service binds the portal to the signed-in user's email. Clerk's Convex
   * JWT carries no email claim, so the server reads it from the users row — which
   * only exists once syncUser has run. Awaiting it here rather than relying on the
   * user having passed through /onboarding first means a direct link, a refresh or
   * a back-button entry to this form still works.
   */
  const ensureUserSynced = async () => {
    if (!isAuthenticated) return;
    const email = user?.primaryEmailAddress?.emailAddress?.trim();
    if (!email) return;
    await syncUser({
      name: user?.fullName ?? undefined,
      email,
      orgId: orgId ?? undefined,
      role: user?.publicMetadata?.role as string | undefined,
    });
  };

  const set = <K extends keyof OnboardingFormValues>(key: K, value: OnboardingFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.legalEntityType) {
      setError("Select a legal entity type");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await ensureUserSynced();
      const payload = {
        companyName: form.companyName,
        legalEntityType: form.legalEntityType,
        companyRegistrationNumber: form.companyRegistrationNumber || undefined,
        tradingName: form.tradingName || undefined,
        country: form.country,
        addressLine: form.addressLine,
        postcode: form.postcode,
        city: form.city || undefined,
        website: form.website || undefined,
        eori: form.eori || undefined,
        contactName: form.contactName,
        contactJobTitle: form.contactJobTitle,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        cdsSubscribed: path === "broker" ? form.cdsSubscribed : undefined,
        termsAccepted: form.termsAccepted,
      };
      if (path === "broker") {
        const res = await completeBroker(payload);
        onSuccess(res.next);
      } else {
        const res = await completeManaged(payload);
        onSuccess(res.next);
      }
    } catch (err) {
      console.error(`[onboarding:${path}] submit failed`, err);
      setError(userMessageFromError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell wide>
      <div className="border-b border-slate-100 px-6 py-5">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 px-6 py-5">
        <div className="space-y-3">
          <p className={ONBOARD_SECTION}>Organisation details</p>
          <div>
            <label className={ONBOARD_LABEL} htmlFor="companyName">
              Company name *
            </label>
            <input
              id="companyName"
              required
              className={ONBOARD_INPUT}
              value={form.companyName}
              onChange={(e) => set("companyName", e.target.value)}
            />
          </div>
          <div>
            <label className={ONBOARD_LABEL} htmlFor="tradingName">
              Trading name
            </label>
            <input
              id="tradingName"
              className={ONBOARD_INPUT}
              value={form.tradingName}
              onChange={(e) => set("tradingName", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ONBOARD_LABEL} htmlFor="legalEntityType">
                Legal entity type *
              </label>
              <Select value={form.legalEntityType} onValueChange={(v) => set("legalEntityType", v)}>
                <SelectTrigger id="legalEntityType" className={ENTERPRISE_SELECT_TRIGGER}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className={ENTERPRISE_SELECT_CONTENT}>
                  <SelectItem value="limited_company" className={ENTERPRISE_SELECT_ITEM}>Limited company</SelectItem>
                  <SelectItem value="sole_trader" className={ENTERPRISE_SELECT_ITEM}>Sole trader</SelectItem>
                  <SelectItem value="partnership" className={ENTERPRISE_SELECT_ITEM}>Partnership</SelectItem>
                  <SelectItem value="limited_liability_partnership" className={ENTERPRISE_SELECT_ITEM}>Limited liability partnership</SelectItem>
                  <SelectItem value="other" className={ENTERPRISE_SELECT_ITEM}>Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={ONBOARD_LABEL} htmlFor="companyRegistrationNumber">
                Company registration number
                {form.legalEntityType === "limited_company" ||
                form.legalEntityType === "limited_liability_partnership"
                  ? " *"
                  : ""}
              </label>
              <input
                id="companyRegistrationNumber"
                required={
                  form.legalEntityType === "limited_company" ||
                  form.legalEntityType === "limited_liability_partnership"
                }
                className={ONBOARD_INPUT}
                value={form.companyRegistrationNumber}
                onChange={(e) => set("companyRegistrationNumber", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={ONBOARD_LABEL} htmlFor="country">
              Country *
            </label>
            <Select value={form.country} onValueChange={(v) => set("country", v)}>
              <SelectTrigger id="country" className={ENTERPRISE_SELECT_TRIGGER}>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className={ENTERPRISE_SELECT_CONTENT}>
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.code} className={ENTERPRISE_SELECT_ITEM}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={ONBOARD_LABEL} htmlFor="addressLine">
              Business address *
            </label>
            <input
              id="addressLine"
              required
              className={ONBOARD_INPUT}
              value={form.addressLine}
              onChange={(e) => set("addressLine", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ONBOARD_LABEL} htmlFor="postcode">
                Postcode *
              </label>
              <input
                id="postcode"
                required
                className={ONBOARD_INPUT}
                value={form.postcode}
                onChange={(e) => set("postcode", e.target.value)}
              />
            </div>
            <div>
              <label className={ONBOARD_LABEL} htmlFor="city">
                City
              </label>
              <input
                id="city"
                required
                className={ONBOARD_INPUT}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={ONBOARD_LABEL} htmlFor="website">
              Website
            </label>
            <input
              id="website"
              type="url"
              placeholder="https://"
              className={ONBOARD_INPUT}
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className={ONBOARD_SECTION}>Customs details</p>
          <div>
            <label className={ONBOARD_LABEL} htmlFor="eori">
              EORI number{path === "broker" ? " *" : ""}
            </label>
            <input
              id="eori"
              required={path === "broker"}
              pattern="(GB|XI)[0-9]{12}"
              title="Enter a GB or XI EORI followed by 12 digits"
              className={ONBOARD_INPUT}
              placeholder={path === "broker" ? undefined : "Optional"}
              value={form.eori}
              onChange={(e) => set("eori", e.target.value)}
            />
          </div>
          {path === "broker" && (
            <label className="flex items-start gap-2 text-[13px] text-slate-600">
              <input
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={form.cdsSubscribed}
                onChange={(e) => set("cdsSubscribed", e.target.checked)}
              />
              <span>I confirm this organisation is subscribed to the Customs Declaration Service.</span>
            </label>
          )}
        </div>

        <div className="space-y-3">
          <p className={ONBOARD_SECTION}>Primary contact</p>
          <div>
            <label className={ONBOARD_LABEL} htmlFor="contactName">
              Full name *
            </label>
            <input
              id="contactName"
              required
              className={ONBOARD_INPUT}
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
            />
          </div>
          <div>
            <label className={ONBOARD_LABEL} htmlFor="contactJobTitle">
              Job title *
            </label>
            <input
              id="contactJobTitle"
              required
              className={ONBOARD_INPUT}
              value={form.contactJobTitle}
              onChange={(e) => set("contactJobTitle", e.target.value)}
            />
          </div>
          <div>
            <label className={ONBOARD_LABEL} htmlFor="contactEmail">
              Email *
            </label>
            <input
              id="contactEmail"
              type="email"
              required
              className={ONBOARD_INPUT}
              value={form.contactEmail}
              onChange={(e) => set("contactEmail", e.target.value)}
            />
          </div>
          <div>
            <label className={ONBOARD_LABEL} htmlFor="contactPhone">
              Phone
            </label>
            <input
              id="contactPhone"
              type="tel"
              className={ONBOARD_INPUT}
              value={form.contactPhone}
              onChange={(e) => set("contactPhone", e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-[13px] text-slate-600">
          <input
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
            checked={form.termsAccepted}
            onChange={(e) => set("termsAccepted", e.target.checked)}
          />
          <span>
            I agree to the{" "}
            <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-slate-900 underline">
              Terms of Service
            </a>{" "}
            and acknowledge the{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-slate-900 underline">
              Privacy Policy
            </a>.
          </span>
        </label>

        {error && (
          <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-black text-[13px] font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitLabel}
        </button>
      </form>
    </OnboardingShell>
  );
}
