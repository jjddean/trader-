import { PricingPlans } from "@/components/billing/PricingPlans";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Plans</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose Starter or Business for your company workspace, or talk to us about custom pricing.
        </p>
      </div>
      <PricingPlans />
    </div>
  );
}
