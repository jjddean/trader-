import { PricingPlans } from "@/components/billing/PricingPlans";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Plans</h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose Starter, Pro, or Pay As You Go for your company workspace.
        </p>
      </div>
      <PricingPlans />
    </div>
  );
}
