import { MarketingPageShell } from "@/components/marketing-page-shell";

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <MarketingPageShell badge="Contact">{children}</MarketingPageShell>;
}
