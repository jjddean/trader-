import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isAfterAuthRoute = createRouteMatcher(["/after-auth"]);
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isSessionTasksRoute = createRouteMatcher(["/session-tasks(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const isClerkHandshake = req.nextUrl.searchParams.has("__clerk_handshake");
  if (isClerkHandshake) return;

  // Session-task pages run while Clerk session may be `pending`.
  // @see https://clerk.com/docs/guides/configure/session-tasks
  if (isSessionTasksRoute(req)) {
    const { userId, sessionStatus } = await auth({ treatPendingAsSignedOut: false });
    if (!userId && sessionStatus !== "pending") {
      const signIn = new URL("/sign-in", req.url);
      signIn.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(signIn);
    }
    return;
  }

  // Portal: always send unauthenticated users to sign-in WITH return to /portal.
  // auth.protect() was dropping that and sending them to /dashboard → org crash.
  if (isPortalRoute(req)) {
    // Allow pending sessions so a misconfigured org task cannot bounce portal users to sign-in.
    const { userId } = await auth({ treatPendingAsSignedOut: false });
    if (!userId) {
      const signIn = new URL("/sign-in", req.url);
      const returnPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
      signIn.searchParams.set(
        "redirect_url",
        returnPath.startsWith("/portal") ? returnPath : "/portal",
      );
      return NextResponse.redirect(signIn);
    }
    return;
  }

  if (isAfterAuthRoute(req) || isDashboardRoute(req) || isOnboardingRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|_clerk|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
