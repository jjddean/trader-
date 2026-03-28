import { Metadata } from "next";

export const metadata: Metadata = {
  title: "UK Customs Resources & Compliance Guides | FreightCode",
  description: "Authoritative documentation, technical compliance utilities, and integration guides for UK customs, HMRC CDS, and import duty management.",
  alternates: {
    canonical: "/resources",
  },
};

export default function ResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
