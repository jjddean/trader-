import { MarketingPageShell } from "@/components/marketing-page-shell";

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <MarketingPageShell badge="About">{children}</MarketingPageShell>;
}
