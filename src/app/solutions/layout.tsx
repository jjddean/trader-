import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Automated Customs Solutions | FreightCode",
  description: "Enterprise customs intelligence to automate compliance, uncover financial reclamation, and seamlessly integrate with HMRC CDS.",
};

export default function SolutionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
