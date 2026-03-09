import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal"],
  display: "swap",
  variable: "--font-sans",
});


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
      <body className={cn(inter.variable, inter.className, "min-h-screen bg-slate-50 font-sans")} suppressHydrationWarning>
        <ConvexClientProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}

