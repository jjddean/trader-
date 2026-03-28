import { Metadata } from "next";

export const metadata: Metadata = {
  title: "UK Import Duty Calculator & Customs Tools | FreightCode",
  description: "Free UK Import Duty Calculator and customs tools. Estimate HMRC CDS tariffs, Anti-Dumping duties, VAT, and total landed costs instantly.",
  alternates: {
    canonical: "/tools",
  },
};

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
