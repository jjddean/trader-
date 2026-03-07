import Link from "next/link";
import { ArrowRight, Globe, ShieldCheck, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="px-6 py-24 md:py-32 flex flex-col items-center text-center space-y-8 bg-gradient-to-b from-card to-background border-b border-border hero-section-match">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <Zap className="mr-2 h-4 w-4" />
          <span>New DCTS Guide March 2026</span>
        </div>
        <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight max-w-4xl">
          The Intelligence Layer for <span className="text-primary italic">Global Trade</span>
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl">
          Elite simplifies the UK Developing Countries Trading Scheme (DCTS).
          Automate compliance, simulate origin, and unlock billions in tariff savings.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button size="lg" className="rounded-full px-8" asChild>
            <Link href="/dashboard/user">
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
            <Link href="/dashboard/admin">
              Admin Portal
            </Link>
          </Button>
        </div>
      </section>

      {/* Value Prop Cards */}
      <section className="px-6 py-24 bg-background">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="bg-card border-border shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <Globe className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Trade Lane Intelligence</CardTitle>
              <CardDescription>
                Define lanes by country, product, and policy tier to uncover high-margin opportunities.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="bg-card border-border shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <Zap className="h-10 w-10 text-primary mb-2" />
              <CardTitle>RoO Simulator</CardTitle>
              <CardDescription>
                Deterministic logic to verify Rules of Origin compliance across 65 DCTS countries.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="bg-card border-border shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <ShieldCheck className="h-10 w-10 text-primary mb-2" />
              <CardTitle>AI Compliance Guard</CardTitle>
              <CardDescription>
                Retrieve real-time trade rules and get expert advisory guidance from our CDE Agent.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto px-6 py-12 border-t border-border bg-card">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Globe className="h-5 w-5" />
            <span className="font-bold text-foreground">Elite</span>
            <span>&copy; 2026 Trade Development Platform</span>
          </div>
          <div className="flex space-x-6">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="#" className="hover:text-foreground transition-colors">DCTS Guide</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
