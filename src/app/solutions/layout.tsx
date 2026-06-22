import { Metadata } from "next";

export const metadata: Metadata = {
  title: "HMRC CDS Solutions | UK Customs Declarations | FreightCode",
  description: "UK customs declaration software for HMRC CDS — practice in TDR, dry-run validation, submit and track declarations, and manage compliance documents.",
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
