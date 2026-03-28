import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Enterprise Customs Inquiries | FreightCode",
  description: "Contact FreightCode for enterprise HMRC CDS deployments, infrastructural capabilities, or strategic global trade partnerships.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
