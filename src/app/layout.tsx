import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const geistSans = GeistSans;


export const metadata: Metadata = {
  title: "TradeDNA | Global Trade Intelligence",
  description: "UK ↔ DCTS-eligible country trade intelligence, compliance verification, and consultative AI guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className={cn(geistSans.variable, "min-h-screen bg-slate-50 font-sans")} suppressHydrationWarning>
        <ConvexClientProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}

