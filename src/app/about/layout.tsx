import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | Enterprise Customs Intelligence | FreightCode",
  description: "FreightCode is building the foundational intelligence layer for global trade data, starting with automated UK border clearances and HMRC CDS integration.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
