'use client';

import { TariffUnifiedTool } from '@/components/TariffUnifiedTool';

const workflowSteps = [
  {
    title: 'Estimate landed cost',
    body: 'Run pre-clearance duty, VAT, and border charge estimates from Trade Tariff data. Results are indicative — HMRC DMSTAX overrides on acceptance.',
  },
  {
    title: 'Classify goods',
    body: 'Confirm commodity codes and tariff measures before filing. Incorrect classification affects duty rates, compliance risk, and clearance outcomes.',
  },
  {
    title: 'Carry into declarations',
    body: 'Use the same logic in your declaration workspace. When HMRC notifications arrive, compare estimates against confirmed duty and VAT amounts.',
  },
];

export default function ToolsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 bg-slate-50">
        <section className="relative px-6 pb-12 pt-24">
          <div className="mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/50 p-8 md:p-12">
                <div className="mb-8 text-center">
                  <p className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-blue-600">
                    Pre-clearance
                  </p>
                  <h1 className="mb-3 text-3xl font-bold tracking-tight text-slate-900">
                    Duty &amp; VAT estimates
                  </h1>
                  <p className="mx-auto max-w-2xl text-[16px] leading-relaxed text-slate-600">
                    Estimate duty, VAT, and landed cost from Trade Tariff data before you file. Model cashflow impact and review tariff measures ahead of CDS submission.
                  </p>
                </div>
                <div className="mx-auto max-w-2xl">
                  <TariffUnifiedTool />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-slate-200 bg-white py-24 text-slate-900">
          <div className="relative z-10 mx-auto max-w-5xl px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-900">In your declaration workspace</h2>
              <p className="mx-auto max-w-2xl text-[16px] leading-relaxed text-slate-600">
                These checks support filing decisions — dry-run validation, pre-clearance estimates, and HMRC notification tracking in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {workflowSteps.map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-white p-8"
                >
                  <h3 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">{step.title}</h3>
                  <p className="text-[15px] leading-relaxed text-slate-600">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
