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

// Poll the CNS notification topic. The action self-gates on CNS_ENABLED, pull
// mode and the topic lease, so this is a no-op until CNS is configured.
// Notification APIs v1.0.3 requires no more than one poll per 30s after an empty
// response; the lease and nextPollAt floor enforce that, not the cron interval.
crons.interval(
  "cns-poll-notifications",
  { seconds: 60 },
  internal.cns_notifications.pollTopic,
);

// Refresh stale Trade Tariff commodity caches daily (batch per run)
crons.daily(
  "refresh-stale-tariff-cache",
  { hourUTC: 2, minuteUTC: 30 },
  internal.actions.tariff.refreshStaleCommodities,
  { batchSize: 15 },
);

export default crons;
