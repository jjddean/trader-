"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { Building2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";

const FIELD_LABEL =
  "mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase";

/** Company profile — uses existing getMyClientProfile (read-only). */
export default function PortalCompanyPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const profile = useQuery(api.client_portal.getMyClientProfile, authReady ? {} : "skip");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Company</h1>
        <p className="mt-1 text-sm text-slate-500">Your company details on file with your broker.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <Building2 className="h-4 w-4 text-slate-400" />
          <div>
            <h2 className="text-sm font-medium text-black">Profile</h2>
            <p className="text-[11px] text-slate-500">Read-only</p>
          </div>
        </div>

        {profile === undefined ? (
          <div className="h-24" aria-hidden />
        ) : profile === null ? (
          <p className="px-6 py-8 text-xs text-slate-500">No company profile linked.</p>
        ) : (
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <div>
              <label className={FIELD_LABEL}>Company name</label>
              <p className="text-xs text-black">{profile.name || "—"}</p>
            </div>
            <div>
              <label className={FIELD_LABEL}>EORI</label>
              <p className="font-mono text-xs text-black">{profile.eori || "—"}</p>
              {!profile.eori && (
                <p className="mt-1 text-[10px] text-slate-400">
                  May be blank when filed under indirect representation
                </p>
              )}
            </div>
            <div>
              <label className={FIELD_LABEL}>Contact</label>
              <p className="text-xs text-black">{profile.contactName || "—"}</p>
            </div>
            <div>
              <label className={FIELD_LABEL}>Portal email</label>
              <p className="text-xs text-black">{profile.portalEmail || profile.contactEmail || "—"}</p>
            </div>
            <div>
              <label className={FIELD_LABEL}>Phone</label>
              <p className="text-xs text-black">{profile.contactPhone || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <label className={FIELD_LABEL}>Address</label>
              <p className="text-xs text-black">
                {[profile.addressLine, profile.city, profile.postcode, profile.country]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
