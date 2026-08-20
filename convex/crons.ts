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

// Delete stored files no documents row references. Catches uploads lost to a
// browser refresh between the storage POST and the row insert, which the
// client-side discard cannot reach. 24h grace so in-flight uploads are safe.
crons.daily(
  "sweep-orphaned-files",
  { hourUTC: 3, minuteUTC: 15 },
  internal.documents.sweepOrphanedFiles,
  {},
);

// Daily UK Sanctions List check. Compares a fresh sha256 of the official UKSL
// XML against the recorded snapshot hash and flags a stale (>48h) snapshot.
// Ingest stays manual — `npm run export-controls:refresh-sanctions`.
crons.daily(
  "check-sanctions-snapshot",
  { hourUTC: 4, minuteUTC: 0 },
  internal.actions.sanctions.checkSanctionsSnapshot,
);

export default crons;
