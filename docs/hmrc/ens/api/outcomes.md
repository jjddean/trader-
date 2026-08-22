# Safety and Security Import Outcomes API (v1.0)

> Source: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/import-control-entry-declaration-outcome/1.0
> Retrieved: 2026-08-22
> Verbatim mirror of the HMRC page. Do not edit — re-download to update.

---

- Overview
- Errors
- Testing
- Versioning
- Endpoints

# Safety and Security Import Outcomes API

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

This API will allow you to:

- get a list of outcomes
- retrieve an outcome
- acknowledge an outcome

## Changelog

All service changes can be found within our Wiki page located here .

## Errors

We use standard HTTP status codes to show whether an API request succeeded or not. They are usually in the range:

- 200 to 299 if it succeeded, including code 202 if it was accepted by an API that needs to wait for further action
- 400 to 499 if it failed because of a client error by your application
- 500 to 599 if it failed because of an error on our server

Errors specific to each API are shown in the Endpoints section, under Response. See our reference guide for more on errors.

## Testing

You can use the HMRC Developer Sandbox to test the API. The Sandbox is an enhanced testing service that functions as a simulator of HMRC’s production environment.

## Versioning

When an API changes in a way that is backwards-incompatible, we increase the version number of the API. See our reference guide for more on versioning.

## Endpoints

| Version | Environments | Endpoints |
|---|---|---|
| Version 1.0 - beta (opens in new tab) | Sandbox and Production | View endpoints |
