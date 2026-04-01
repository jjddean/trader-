import { Metadata } from "next";
import { LandingPageContent } from "@/components/landing-page-content";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function LandingPage() {
  return <LandingPageContent />;
}
