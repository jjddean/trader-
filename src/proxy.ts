import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/session-tasks(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const isClerkHandshake = req.nextUrl.searchParams.has("__clerk_handshake");

  if (isProtectedRoute(req) && !isClerkHandshake) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|_clerk|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
