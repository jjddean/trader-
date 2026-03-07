"use client";

import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Check, Sparkles, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const PLANS = [
    {
        name: "Starter",
        price: "$0",
        description: "Perfect for exploring global trade data.",
        features: [
            "Basic HS Code Lookup",
            "Company Search (Limited)",
            "Manual Tariff Calculator",
            "Public DCTS Knowledge",
        ],
        priceId: "free",
        buttonText: "Current Plan",
        variant: "outline" as const,
    },
    {
        name: "Professional",
        price: "$99",
        description: "For active traders needing live data.",
        features: [
            "Everything in Starter",
            "Live HMRC Shipment Tracking",
            "Deterministic DCTS Eligibility",
            "AI Explainer (Unlimited)",
            "Priority Support",
        ],
        priceId: "price_PRO_PLACEHOLDER",
        buttonText: "Upgrade to Pro",
        variant: "default" as const,
        highlight: true,
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "Scale your global supply chain ops.",
        features: [
            "Everything in Pro",
            "Bulk R2 Data Exports",
            "Custom API Access",
            "Dedicated Account Manager",
            "On-prem Deployment Options",
        ],
        priceId: "price_ENT_PLACEHOLDER",
        buttonText: "Contact Sales",
        variant: "outline" as const,
    },
];

export default function PricingPage() {
    const createCheckout = useAction(api.actions.stripe.createCheckoutSession);

    const handleUpgrade = async (plan: string, priceId: string) => {
        if (priceId === "free") return;

        try {
            const url = await createCheckout({ plan, priceId });
            window.location.href = url;
        } catch (error) {
            console.error("Checkout Error:", error);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12 h-[calc(100vh-64px)] overflow-y-auto">
            <div className="text-center space-y-4">
                <h1 className="text-3xl font-bold tracking-tight">Simple, Transparent Pricing</h1>
                <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
                    Choose the plan that fits your trade operations. Match your scale with deterministic intelligence.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {PLANS.map((plan) => (
                    <Card key={plan.name} className={`relative flex flex-col ${plan.highlight ? 'border-[#00897b] shadow-lg scale-105 z-10' : ''}`}>
                        {plan.highlight && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00897b] text-white px-3 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm uppercase tracking-widest">
                                <Sparkles className="h-3 w-3" /> Most Popular
                            </div>
                        )}
                        <CardHeader className="text-center pt-8">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{plan.name}</CardTitle>
                            <div className="mt-4 flex items-baseline justify-center gap-1">
                                <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                                {plan.price !== "Custom" && <span className="text-muted-foreground text-sm">/mo</span>}
                            </div>
                            <p className="text-muted-foreground mt-2 text-[10px] leading-relaxed px-4">{plan.description}</p>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-4 pt-6 px-8">
                            <ul className="space-y-3">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-3 text-[11px]">
                                        <Check className="h-4 w-4 text-[#00897b] shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter className="pb-8 pt-6 px-8">
                            <Button
                                className={`w-full h-11 text-xs font-bold uppercase tracking-wide transition-all ${plan.highlight ? "bg-[#00897b] hover:bg-[#00796b] text-white" : ""
                                    }`}
                                variant={plan.variant}
                                onClick={() => handleUpgrade(plan.name, plan.priceId)}
                                disabled={plan.priceId === "free"}
                            >
                                {plan.buttonText}
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            <div className="bg-primary/5 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-primary/10">
                <div className="flex items-center gap-4 text-left">
                    <div className="bg-primary/10 p-3 rounded-xl">
                        <Globe className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Enterprise Grade Infrastructure</h3>
                        <p className="text-[10px] text-muted-foreground">Deterministic grounding and live HMRC integration for serious shippers.</p>
                    </div>
                </div>
                <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/5 text-[10px] font-bold uppercase tracking-widest">
                    Learn about Security <Check className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
