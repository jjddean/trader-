import { HSCodeLookup } from "@/components/tools/HSCodeLookup";

interface HSCodePageProps {
  searchParams: Promise<{ declarationId?: string; itemId?: string }>;
}

export default async function HSCodePage({ searchParams }: HSCodePageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">HS Code Lookup</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search the HMRC Trade Tariff for commodity codes and reference descriptions.
        </p>
      </div>

      {params.declarationId && params.itemId && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Applying to a declaration item — pick a code and click <strong>Apply</strong>, then review the
          description against your invoice on the goods item form.
        </p>
      )}

      <HSCodeLookup
        variant="card"
        declarationId={params.declarationId}
        itemId={params.itemId}
      />
    </div>
  );
}
