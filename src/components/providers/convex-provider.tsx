"use client";

import { ReactNode, useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!convexUrl || !publishableKey) {
        return <>{children}</>;
    }

    const convex = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);

    return (
        <ClerkProvider publishableKey={publishableKey}>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                {children}
            </ConvexProviderWithClerk>
        </ClerkProvider>
    );
}
