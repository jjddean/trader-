import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automated HMRC CDS Solutions | UK Customs Compliance | FreightCode",
  description: "Enterprise customs intelligence to automate HMRC CDS compliance, discover duty reclamation, and optimize your UK import strategy.",
  alternates: {
    canonical: "/solutions",
  },
};

export default function SolutionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
