import { DocsSiteFooter, DocsSiteHeader } from "@/components/docs-chrome";
import { MarketingSidebarNav } from "@/components/marketing-sidebar-nav";

interface MarketingPageShellProps {
  badge: string;
  children: React.ReactNode;
}

export function MarketingPageShell({ badge, children }: MarketingPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <DocsSiteHeader badge={badge} />

      <div className="mx-auto flex w-full max-w-[1280px] flex-1 gap-12 px-6 py-10">
        <MarketingSidebarNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <DocsSiteFooter />
    </div>
  );
}
