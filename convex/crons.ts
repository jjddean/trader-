import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync exchange rates daily at 00:00 UTC
crons.daily(
    "sync-exchange-rates",
    { hourUTC: 0, minuteUTC: 0 },
    internal.actions.currency.syncExchangeRates
);

export default crons;
