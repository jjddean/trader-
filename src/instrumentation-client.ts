import * as Sentry from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/sentry-options";

Sentry.init({
  ...sentryInitOptions("client"),
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
