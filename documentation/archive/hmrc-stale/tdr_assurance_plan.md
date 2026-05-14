# HMRC Trader Dress Rehearsal (TDR) Assurance Guide

You are absolutely correct to be cautious. Unlike the Sandbox (Trade Test) environment where you can submit dummy or random data, Trader Dress Rehearsal (TDR) is highly controlled and actively monitored by HMRC’s Software Developer Support (SDH) team.

HMRC uses your TDR submissions as the final assurance gate before granting your software production credentials.

## What HMRC Monitors in TDR
Before granting live Production API credentials, HMRC expects software providers to demonstrate competence and compliance. They evaluate:

**Volume and Realism**: TDR is not a load-testing environment. HMRC expects "day-in-the-life" volumes. Submitting 50 identical dummy declarations in an hour will flag your account for misuse.

**Data Quality**: You must use live, realistic data. This includes valid, real GB EORI numbers, legitimate commodity codes (HS Codes), and realistic monetary values that make sense for the specified goods. Entering "Test" or "12345" in mandatory fields will result in rejection.

**End-to-End Handling**: HMRC monitors whether your software correctly handles the full lifecycle. They want to see that when a declaration receives a DMSROG (Route to examine), your platform can successfully upload the requested supporting documents via the Secure Upload API.

**Error Rate**: If your software repeatedly submits mathematically incorrect payloads (e.g., incorrect tax calculations or contradictory procedure codes) causing a high DMSREJ (Rejected) rate, your production access may be delayed until the software bugs are fixed.

## How Developers Handle the TDR Phase
Because you are building a commercial ISV software (FreightCode) rather than doing your own internal declarations, HMRC recommends the Pilot Customer Approach:

### 1. The Pilot User Strategy (Recommended)
You should onboard at least one friendly "Pilot Trader" or Freight Forwarder.
* Obtain their explicit consent to use their live GB EORI number in the TDR environment.
* Ask them to provide a recent, real-world commercial invoice from a shipment they have successfully processed in the past.
* Re-key this exact commercial invoice into FreightCode and submit it to the TDR API.
Because it's a real historical shipment, the HS Codes, values, weights, and EORIs will perfectly align, passing all HMRC heuristic checks.

### 2. Using Your Own EORI
If your business has a GB EORI, you can use it, but you must still construct a highly realistic, fully-fleshed out commercial scenario.

## Strict Rules of Engagement for TDR
WARNING

* Do NOT use TDR for exploratory testing. If you are ever unsure how an API endpoint behaves, switch HMRC_ENVIRONMENT back to sandbox to figure it out before touching TDR.
* Never upload test files containing sensitive real-world PII (Personally Identifiable Information) or live financial datasets to the TDR upload endpoints unless they relate directly to the test scenario.
* Never run automated test suites (like Jest or Playwright) against the TDR endpoints.

## Next Steps to Production Recognition
* Complete integration with the sandbox until you have a 100% success rate on the end-to-end flow.
* Secure a pilot client's data or prepare a highly researched, realistic test payload.
* Apply for TDR access via the Developer Hub, explicitly stating you are an ISV preparing for production recognition.
* Run the small batch of highly-curated test declarations.
* Apply for HMRC "Recognised Software" status to get your production client ID and secret
