import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { run as recoverStuckRun } from "./actions/recoverStuckDeclarations";

const crons = cronJobs();

// Sync exchange rates daily at 00:00 UTC
crons.daily(
  "sync-exchange-rates",
  { hourUTC: 0, minuteUTC: 0 },
  internal.actions.currency.syncExchangeRates,
);

// Recover stuck declarations periodically
crons.interval(
  "recover-stuck-declarations",
  { minutes: 15 },
  // Use the action implementation directly because the generated `internal` API
  // may not include newly added action modules until the Convex dev generator
  // has been run. Importing the action avoids a TypeScript build error on CI.
  // Cast to `any` to satisfy the cron API typings as a temporary measure.
  (recoverStuckRun as unknown) as any,
);

export default crons;
