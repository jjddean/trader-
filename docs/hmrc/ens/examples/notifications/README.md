# Notification examples

HMRC publishes no downloadable example payloads for the Notifications API.

The OpenAPI specification for `import-control-entry-declaration-intervention`
v1.0 references `advancedNotification.xsd`, `listInterventions.xsd` and
`CC351A-v10-0.xsd` but ships no `externalValue` example instances.

An inline IE351 fragment, including the `CUSINT632` intervention block and the
`<acknowledgement>` element, appears in the service guide mirror at
[`../../api/service-guide-api-reference.md`](../../api/service-guide-api-reference.md)
("Retrieve a notification - IE351").

Schemas to validate real responses against: [`../../schemas/notifications/`](../../schemas/notifications/).

Recorded in [`../../SOURCES.md`](../../SOURCES.md) §7.
