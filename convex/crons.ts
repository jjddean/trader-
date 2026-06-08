import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync exchange rates daily at 00:00 UTC
crons.daily(
  "sync-exchange-rates",
  { hourUTC: 0, minuteUTC: 0 },
  internal.actions.currency.syncExchangeRates,
);

// Recover stuck declarations hourly (pull unpulled notifications + persist)
crons.hourly(
  "recover-stuck-declarations",
  { minuteUTC: 10 },
  internal.hmrc_actions.recoverStuckDeclarations,
);

export default crons;
