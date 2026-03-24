import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Technical Resources & Guides | FreightCode",
  description: "Authoritative documentation, compliance utilities, and integration guides for UK customs, HMRC CDS, and import duty management.",
};

export default function ResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
