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

// Refresh stale Trade Tariff commodity caches daily (batch per run)
crons.daily(
  "refresh-stale-tariff-cache",
  { hourUTC: 2, minuteUTC: 30 },
  internal.actions.tariff.refreshStaleCommodities,
  { batchSize: 15 },
);

export default crons;
