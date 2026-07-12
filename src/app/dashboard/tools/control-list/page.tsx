import { ControlListBrowser } from "@/components/trade-compliance/control-list-browser";

export default function ControlListPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Control List</h1>
        <p className="mt-1 text-sm text-slate-500">
          Browse UK Strategic Export Control List entries (military, dual-use, firearms, radioactive).
        </p>
      </div>
      <ControlListBrowser />
    </div>
  );
}
