import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | FreightCode",
  description: "How we collect, use, and protect your data at FreightCode. Review our privacy practices for HMRC CDS data and user information.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
