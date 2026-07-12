import { MarketingPageShell } from "@/components/marketing-page-shell";

export default function SolutionsLayout({ children }: { children: React.ReactNode }) {
  return <MarketingPageShell badge="Solutions">{children}</MarketingPageShell>;
}
