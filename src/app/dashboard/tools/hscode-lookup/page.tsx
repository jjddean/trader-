import { HSCodeLookup } from "@/components/tools/HSCodeLookup";

interface HSCodePageProps {
  searchParams: Promise<{ declarationId?: string; itemId?: string }>;
}

export default async function HSCodePage({ searchParams }: HSCodePageProps) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
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
