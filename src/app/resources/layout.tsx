import { MarketingPageShell } from "@/components/marketing-page-shell";

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return <MarketingPageShell badge="Resources">{children}</MarketingPageShell>;
}
