import { HSCodeLookup } from "@/components/tools/HSCodeLookup";

export default function HSCodePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <HSCodeLookup variant="card" />
    </div>
  );
}
