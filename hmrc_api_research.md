# HMRC API Research Report

## Current Integration Status

The application is integrated with two primary HMRC APIs:
1.  **Customs Declarations API (v1.0/v2.0)**: Used for submitting, amending, and cancelling declarations, as well as handling notifications and document uploads.
2.  **Customs Declarations Information (CDI) API (v2.0)**: Used for querying the status of declarations.

### Implemented Endpoints
- `POST /customs-declarations/` (Submit)
- `POST /customs-declarations/amend` (Amend)
- `POST /customs-declarations/cancellation-requests` (Cancel)
- `POST /customs-declarations/initiate-file-upload` (Document Initiate)
- `GET /notifications/conversationId/{id}/unpulled` (Pull Notifications)
- `GET /customs/declarations-information/{id}/status` (Status Query)

---

## Missing Endpoints for "APIs We Use"

Based on the official documentation for the **Customs Declarations Information API**, the following endpoints are available but not yet implemented in the app. These are highly recommended for a full-featured trader dashboard:

### 1. Retrieve Declaration Versions
- **Endpoint**: `GET /customs/declarations-information/mrn/{mrn}/version`
- **Use Case**: Allows the user to see the history of a declaration if it has been amended.

### 2. Retrieve Full Declaration Details
- **Endpoint**: `GET /customs/declarations-information/mrn/{mrn}/full`
- **Use Case**: Fetches the complete XML data for a submitted declaration. Useful for auditing and debugging.

### 3. Search Declarations
- **Endpoint**: `GET /customs/declarations-information/search`
- **Use Case**: Lists declarations based on filters (e.g., date range, party role). Essential for a "Manage Declarations" view.

### 4. Retrieve Declaration Notifications
- **Endpoint**: `GET /customs/declarations-information/mrn/{mrn}/notifications`
- **Use Case**: Fetches all notifications associated with a specific MRN, ensuring no updates were missed.

---

## Critical Compliance Gaps

While investigating the codebase, I discovered that two existing routes are **not** using the mandatory `fetchHmrc` wrapper. This will cause them to fail in the **Trader Dress Rehearsal (TDR)** and **Production** environments due to missing Fraud Prevention Headers:

- [`src/app/api/hmrc/status-query/route.ts`](file:///c:/Users/jason/trader-app/src/app/api/hmrc/status-query/route.ts)
- [`src/app/api/hmrc/notifications/pull/route.ts`](file:///c:/Users/jason/trader-app/src/app/api/hmrc/notifications/pull/route.ts)

---

## Recommended New APIs (Future Scope)

For a comprehensive "Trader App," we should consider adding support for:
- **Check an EORI Number API**: To validate customer/partner EORI numbers before submission.
- **Check a UK VAT Number API**: To verify VAT registration status.
- **UK Trade Tariff API**: To fetch commodity codes, duty rates, and trade measures directly.
