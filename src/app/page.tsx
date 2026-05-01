import { Metadata } from "next";
import { LandingPageContent } from "@/components/landing-page-content";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LandingPage() {
  return <LandingPageContent />;
}
