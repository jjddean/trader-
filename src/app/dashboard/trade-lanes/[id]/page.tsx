"use client";

export default function TradeLaneDetailsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">Lane Details</h2>
        <p className="mt-1 text-xs text-slate-500">
          Enter the core details for this contracted trade lane.
        </p>
        <div className="mt-6 rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
          <p className="text-xs text-slate-500">Lane fields will be wired here.</p>
        </div>
      </div>
    </div>
  );
}
