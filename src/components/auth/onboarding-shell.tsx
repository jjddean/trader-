import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Account" },
  { id: 2, label: "Company" },
] as const;

interface OnboardingShellProps {
  step: 1 | 2;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function OnboardingShell({ step, title, description, children }: OnboardingShellProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-4 text-center">
        <ol className="flex items-center justify-center gap-2">
          {STEPS.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                  item.id === step
                    ? "bg-slate-900 text-white"
                    : item.id < step
                      ? "bg-slate-200 text-slate-700"
                      : "bg-slate-100 text-slate-400",
                )}
              >
                {item.id}
              </span>
              <span
                className={cn(
                  "hidden text-xs sm:inline",
                  item.id === step ? "font-medium text-slate-900" : "text-slate-500",
                )}
              >
                {item.label}
              </span>
              {item.id < STEPS.length && (
                <span className="mx-1 hidden h-px w-6 bg-slate-200 sm:block" aria-hidden />
              )}
            </li>
          ))}
        </ol>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
