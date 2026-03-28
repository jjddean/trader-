import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | FreightCode",
  description: "Terms and conditions for using the FreightCode platform, including our HMRC data sync services and customs tooling.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
