import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const geistSans = GeistSans;

export const metadata: Metadata = {
  title: "FreightCode | Instant Customs Clearance",
  description:
    "Automate your UK customs declarations, detect savings, and ensure compliance instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var v = localStorage.getItem('tradedna-text-scale');
                if (v) { document.documentElement.style.setProperty('--text-scale', v); }
              } catch (_) {}
            `,
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
  );
}
