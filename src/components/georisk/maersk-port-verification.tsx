"use client";

import { BadgeCheck, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

interface MaerskLocation {
  countryCode: string;
  countryName: string;
  cityName: string;
  locationType: string;
  locationName: string;
  carrierGeoID: string;
  UNLocationCode: string;
}

interface VerifiedPort {
  requestedName: string;
  location?: MaerskLocation;
  loading: boolean;
}

function preferredLocation(value: unknown): MaerskLocation | undefined {
  if (!Array.isArray(value)) return undefined;
  const locations = value.filter(
    (item): item is MaerskLocation =>
      typeof item === "object" &&
      item !== null &&
      typeof item.locationName === "string" &&
      typeof item.carrierGeoID === "string" &&
      typeof item.UNLocationCode === "string",
  );
  return locations.find((item) => item.locationType === "CITY") ?? locations[0];
}

export function MaerskPortVerification({
  origin,
  destination,
}: {
  origin: string;
  destination: string;
}) {
  const [ports, setPorts] = useState<VerifiedPort[]>([
    { requestedName: origin, loading: true },
    { requestedName: destination, loading: true },
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const names = [origin, destination];

    void Promise.all(
      names.map(async (requestedName) => {
        try {
          const query = new URLSearchParams({ cityName: requestedName });
          const response = await fetch(`/api/maersk/locations?${query}`, {
            signal: controller.signal,
          });
          if (!response.ok) return { requestedName, loading: false };
          return {
            requestedName,
            location: preferredLocation(await response.json()),
            loading: false,
          };
        } catch {
          return { requestedName, loading: false };
        }
      }),
    ).then((results) => {
      if (!controller.signal.aborted) setPorts(results);
    });

    return () => controller.abort();
  }, [origin, destination]);

  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-semibold text-slate-900">Maersk port verification</h2>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Origin and destination matched against Maersk reference data.
          </p>
        </div>
        <span className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-[9px] font-medium text-blue-700">
          MAERSK API
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ports.map((port, index) => (
          <div key={`${index}-${port.requestedName}`} className="rounded-md border border-slate-200 p-3">
            <p className="text-[9px] font-medium tracking-wider text-slate-400 uppercase">
              {index === 0 ? "Origin" : "Destination"}
            </p>
            {port.loading ? (
              <p className="mt-2 text-[12px] text-slate-400">Verifying {port.requestedName}…</p>
            ) : port.location ? (
              <div className="mt-2 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[12px] font-medium text-slate-900">
                      {port.location.locationName}
                    </p>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {port.location.UNLocationCode} · {port.location.countryName}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] text-slate-400">
                    Maersk Geo ID: {port.location.carrierGeoID}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-slate-400">No Maersk match for {port.requestedName}.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
