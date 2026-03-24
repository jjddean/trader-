import { Metadata } from "next";

export const metadata: Metadata = {
  title: "UK Import Calculator & Tools | FreightCode",
  description: "Free UK Import Calculator and customs tools. Estimate UK Import Duty, Anti-Dumping tariffs, VAT, and total landed costs instantly.",
};

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
