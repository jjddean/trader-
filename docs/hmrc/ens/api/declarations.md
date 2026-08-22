# Safety and Security Import Declarations API (v1.0)

> Source: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/import-control-entry-declaration-store/1.0
> Retrieved: 2026-08-22
> Verbatim mirror of the HMRC page. Do not edit — re-download to update.

---

- Overview
- Errors
- Testing
- Versioning
- Endpoints

# Safety and Security Import Declarations API

| API type | REST |
|---|---|
| Latest version | Version 1.0 - beta |
| Last updated | 03 July 2026 |
| Sandbox base URL | https://test-api.service.hmrc.gov.uk |
| Production base URL | https://api.service.hmrc.gov.uk |

## Overview

The Safety and Security system handles digital communications between:

- customs administrators
- carriers or their appointed representatives

You must provide the UK customs authorities with advance information by submitting an ENS before you bring goods into the UK. The Safety and Security system is designed to incorporate the:

- lodging, handling and processing of the ENS in advance of the arrival of goods
- issuing of a Movement Reference Number (MRN)

The MRN is a Customs computer system-generated number that is automatically allocated after successful validation. The MRN must be issued to the carrier and, where different, the declarant.

The APIs will receive new ENS submissions or amendments and will return a response for the end-user. The response will include a movement reference number or an error message.

This API allows you to:

- create a new ENS submission
- amend an existing ENS submission

## Changelog

All service changes can be found within our Wiki page located here .

## Errors

We use standard HTTP status codes to show whether an API request succeeded or not. They are usually in the range:

- 200 to 299 if it succeeded, including code 202 if it was accepted by an API that needs to wait for further action
- 400 to 499 if it failed because of a client error by your application
- 500 to 599 if it failed because of an error on our server

Errors specific to each API are shown in the Endpoints section, under Response. See our reference guide for more on errors.

## Testing

You can use the sandbox environment to test this API .

## Test headers

Additional test support is provided by a number of test headers that can be passed when submitting new or amended ENS declarations.

The following test headers are supported:

### simulateRiskingResponse

This header should be used in order for risking simulation to occur so that an outcome (see Safety and Security Import Outcomes ) is made available for an ENS submission.

The following values are supported:

| Value | Description |
|---|---|
| accept | Associate a positive outcome and a Movement Reference Number with an ENS submission (identifiable by its correlation ID). |
| reject | Associate a negative outcome and error details with an ENS submission (identifiable by its correlation ID). |

If the header is omitted or has any other value then no risking simulation will be performed and no outcome will be made available for an ENS submission. If the customs office of first entry <RefNumCUSOFFFENT731> is in Northern Ireland a rejection will be issued regardless of the value of the header.

### riskingResponseError

To control the specific error received with a negative outcome when the simulateRiskingResponse header is set to reject .

The following values are supported:

| Value | Description |
|---|---|
| nonUniqueLRN | Simulates the scenario where the local reference number in the declaration is not unique. |
| badTransportMode | Simulates the scenario where the transport mode is not supported. |
| badMessageCode | Simulates the scenario where the message code is not supported. |

If the simulateRiskingResponse header is set to reject but no riskingResponseError header is provided, a default of badTransportMode is assumed. If the customs office of first entry <RefNumCUSOFFFENT731> is in Northern Ireland a rejection will be issued regardless of the value of the header.

### simulateRiskingResponseLatencyMillis

This is used with the simulateRiskingResponse header to provide a delay between the submission of an ENS and the outcome being made available.

The header value is the required simulated latency in milliseconds.

If a value larger than 30000 is supplied, then 30 seconds will be assumed. If the header or value is omitted, then no latency will be simulated.

### simulateInterventionResponse

This header should be used in order for intervention simulation to occur so that an advanced notification (see Safety and Security Import Notifications ) is made available for an ENS submission.

The header takes the values true or false .

When true , an advanced notification will be associated with an ENS submission (identifiable by its correlation ID).

If the header is omitted or has any other value then no intervention simulation will be performed, and no advanced notification will be made available for an ENS submission.

### simulateInterventionResponseLatencyMillis

This is used with the simulateInterventionResponse header to provide a delay between the submission of an ENS and the advanced notification being made available.

The header value is the required simulated latency in milliseconds.

If a value larger than 30000 is supplied, then 30 seconds will be assumed. If the header or value is omitted, then no latency will be simulated.

If you have a specific testing need that is not supported in the sandbox, contact our support team .

## Versioning

When an API changes in a way that is backwards-incompatible, we increase the version number of the API. See our reference guide for more on versioning.

## Endpoints

| Version | Environments | Endpoints |
|---|---|---|
| Version 1.0 - beta (opens in new tab) | Sandbox and Production | View endpoints |
