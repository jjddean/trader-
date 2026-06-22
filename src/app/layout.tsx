import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const geistSans = GeistSans;

export const metadata: Metadata = {
  metadataBase: new URL("https://www.freightcode.co.uk"),
  title: "FreightCode | Instant UK Customs Clearance Software",
  description: "UK customs declaration software for HMRC CDS — build, validate, and submit declarations with duty estimates and compliance guides for TRE and commodity codes.",
  keywords: "HMRC, CDS, UK Customs, Import Duty, Declarations, TRE, FreightCode, AI Customs Agent",
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "FreightCode | Instant UK Customs Clearance Software",
    description: "UK customs declaration software for HMRC CDS — build, validate, and submit declarations with duty estimates and compliance guides for TRE and commodity codes.",
    type: "website",
    url: "https://www.freightcode.co.uk",
    siteName: "FreightCode",
    images: [
      {
        url: "/social/og-image.png",
        width: 1200,
        height: 630,
        alt: "FreightCode Dashboard and Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FreightCode | Instant UK Customs Clearance Software",
    description: "UK customs declaration software for HMRC CDS — build, validate, and submit declarations with FreightCode.",
    creator: "@freightcode",
    images: ["/social/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/session-tasks/choose-organization"
      taskUrls={{ "choose-organization": "/session-tasks/choose-organization" }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                try {
                  var v = localStorage.getItem('freightcode-text-scale') || localStorage.getItem('tradedna-text-scale');
                  if (v) { document.documentElement.style.setProperty('--text-scale', v); }
                } catch (_) {}
              `,
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "FreightCode",
                "url": "https://www.freightcode.co.uk",
                "logo": "https://www.freightcode.co.uk/icon.png",
                "description": "UK customs declaration software for HMRC CDS — build, validate, and submit declarations with FreightCode.",
                "sameAs": [
                  "https://twitter.com/freightcode"
                ],
                "contactPoint": {
                  "@type": "ContactPoint",
                  "contactType": "Customer Support",
                  "url": "https://www.freightcode.co.uk/contact"
                }
              })
            }}
          />
        </head>
        <body
          className={cn(geistSans.variable, "min-h-screen bg-slate-50 font-sans")}
          suppressHydrationWarning
        >
          <ConvexClientProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
