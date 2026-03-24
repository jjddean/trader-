import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact & Corporate Inquiries | FreightCode",
  description: "Contact FreightCode for enterprise deployments, infrastructural capabilities, or strategic customs and global trade partnerships.",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
