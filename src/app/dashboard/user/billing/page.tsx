"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { CreditCard, Zap, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function BillingPage() {
    const { user } = useUser();
    const subscription = useQuery(api.subscriptions.getSubscription, user ? { userId: user.id } : "skip");
    const createPortal = useAction(api.actions.stripe.createPortalSession);

    const handleManageBilling = async () => {
        if (!subscription?.stripeCustomerId) return;
        try {
            const url = await createPortal({ customerId: subscription.stripeCustomerId });
            window.location.href = url;
        } catch (error) {
            console.error("Portal Error:", error);
        }
    };

    if (subscription === undefined) {
        return (
            <div className="flex h-[calc(100vh-64px)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
            </div>
        );
    }

    const isPro = subscription?.plan === "Professional" || subscription?.plan === "Enterprise";

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 h-[calc(100vh-64px)] overflow-y-auto">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Billing & Subscription</h1>
                <p className="text-sm text-muted-foreground">Manage your plan, payment methods, and invoices.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 border-primary/20 bg-primary/5">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Subscription Plan</CardTitle>
                            <Badge variant={isPro ? "default" : "secondary"} className={isPro ? "bg-[#00897b] hover:bg-[#00897b]" : ""}>
                                {subscription?.plan || "Starter"} Plan
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            {isPro
                                ? "You have full access to live HMRC data and deterministic trade intelligence."
                                : "You are currently on the limited free tier."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-background border shadow-sm">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Zap className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold uppercase tracking-tight">Status: {subscription?.status === "active" ? "Active" : "Inactive"}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    {subscription?.currentPeriodEnd
                                        ? `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                                        : "Standard access with limited rates."}
                                </p>
                            </div>
                            {subscription?.status === "active" && (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/30 pt-4 flex justify-between border-t border-primary/10">
                        {subscription?.stripeCustomerId ? (
                            <Button variant="outline" size="sm" onClick={handleManageBilling} className="text-[10px] h-8 border-primary/20">
                                <CreditCard className="h-3 w-3 mr-2" /> Manage Payments
                            </Button>
                        ) : (
                            <Link href="/dashboard/pricing">
                                <Button className="bg-[#00897b] hover:bg-[#00796b] text-[10px] h-8 font-bold uppercase tracking-widest px-6 shadow-md transition-all active:scale-95">
                                    Upgrade Now
                                </Button>
                            </Link>
                        )}
                        <p className="text-[9px] text-muted-foreground italic flex items-center gap-1 opacity-70">
                            <ExternalLink className="h-3 w-3" /> Securely managed via Stripe
                        </p>
                    </CardFooter>
                </Card>

                <Card className="flex flex-col border-dashed bg-background">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest opacity-60">Usage Limits</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center space-y-6">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span>AI Explainer</span>
                                <span>{isPro ? "Unlimited" : "4 / 20"}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className={`h-full bg-[#00897b] transition-all duration-1000 ${isPro ? "w-full" : "w-[20%]"}`} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold">
                                <span>HS Code Lookup</span>
                                <span>{isPro ? "Unlimited" : "2 / 5"}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className={`h-full bg-[#00897b] transition-all duration-1000 ${isPro ? "w-full" : "w-[40%]"}`} />
                            </div>
                        </div>
                        {!isPro && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 mt-4 leading-normal">
                                <AlertCircle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                                <p className="text-[9px] text-yellow-700">
                                    Unlock high-frequency HS searches and **live HMRC tracking** with Professional.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
