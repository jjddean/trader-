# 2026 UK CDS Customs App — Final Build Plan (Agent Execution)

## 1. Platform Objective
Build software that submits customs declarations electronically to the UK government system.

Target system:
* HM Revenue & Customs
* Customs Declaration Service

Official integration guide:
* [CDS End-to-End Developer Guide](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/customs-declarations/1.0)

## 2. Core Architecture
Frontend (Trader UI)
↓
Declaration Builder
↓
Validation / Rules Engine
↓
CDS Data Element Mapper
↓
Declaration Message Generator
↓
HMRC Customs Declarations API
↓
CDS Backend
↓
Notifications / Status Updates

CDS API submission requirement:
Submit customs declarations via API

## 3. Workspace Model
Workspace = trader / broker company

Workspace contains:
* company profile
* EORI
* users
* declarations
* documents
* API credentials

Roles:
* Admin
* Submitter
* Viewer

## 4. Core Data Model
Tables:
* users
* workspaces
* declarations
* goods_items
* documents
* notifications
* audit_logs

Declaration structure:
* declaration
  * header
    * EORI
    * declaration type
    * LRN
  * goods_items
    * commodity_code
    * value
    * weight
    * origin
    * procedure_code
  * documents

## 5. CDS Data Element Engine
Implement CDS data elements based on WCO declaration schema.

Declaration datasets:
* H1 – Standard Import
* H2 – Simplified Import
* B1 – Standard Export
* B2 – Simplified Export

The API validates payload against the WCO declaration schema before passing to CDS backend.

## 6. Declaration Creation Workflow
User creates declaration
↓
System validates CDS data elements
↓
Generate declaration message
↓
Submit via CDS API
↓
Receive response
↓
Track lifecycle notifications

API lifecycle:
* Submit declaration
* Receive synchronous response
* Receive asynchronous notifications

## 7. CDS API Integration
Required endpoints:
* POST submit declaration
* POST amend declaration
* POST cancel declaration
* GET declaration status
* POST upload documents

Authentication:
* OAuth token
* HMRC Developer Hub application
* Government Gateway user
* EORI linked account

API catalogue reference:
* [HMRC API catalogue (Declarations)](https://developer.service.hmrc.gov.uk/api-documentation/docs/api)

## 8. Notification System
CDS sends declaration lifecycle notifications.

Examples:
* accepted
* rejected
* goods arrived
* cleared
* held
* documents required

Notification types:
* push notifications
* pull notifications

CDS notification documentation:
* [CDS notifications guide](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/customs-declarations/1.0/help/notifications)

## 9. Document Upload Service
Upload supporting files after submission.

Supported files:
* commercial invoice
* packing list
* licence documents
* transport documents

Upload flow:
request upload reference
↓
upload file
↓
link to declaration

File upload process reference:
* [CDS File Upload Service documentation](https://www.gov.uk/guidance/send-documents-to-support-declarations-for-the-customs-declaration-service)

## 10. AI Integration Layer
AI used before submission.

Modules:
* Document Extraction: Upload invoice -> OCR extraction -> Map to CDS fields
* Commodity Code Suggestion: product description -> AI classification -> HS code suggestion
* Validation Assistant: detect missing fields, detect licence requirements, detect inconsistent origin/value

Final declaration always validated by rule engine before submission.

## 11. Compliance & Audit
Mandatory logs:
* submission logs
* API responses
* declaration versions
* user actions
* document links

Store:
* MRN
* LRN
* EORI
* timestamps

## 12. Reporting Module
Pull declaration activity data.

Reports include:
* import item report
* import header report
* tax lines report
* export item report

HMRC customs data report service:
* [Customs declaration data reports](https://www.gov.uk/guidance/customs-declaration-data-reports)

## 13. Development Environments
* local dev
* HMRC sandbox
* trade test
* production

Developer setup path:
register app -> subscribe to CDS APIs -> test in sandbox -> complete trade test -> go live

Developer setup documentation:
* [HMRC developer setup guide](https://developer.service.hmrc.gov.uk/api-documentation/docs/using-the-hub)

## 14. Deployment Stack
Recommended stack:
* Frontend: Next.js
* Auth: Clerk
* Backend: Node API
* Database: Postgres / Convex
* Queue: Redis
* Storage: S3
* AI: LLM + OCR service

## 15. Final System Flow
documents uploaded -> AI extraction -> user verifies declaration -> rules engine validates CDS data elements -> generate WCO declaration message -> submit to CDS API -> receive MRN -> track notifications -> upload supporting documents -> archive declaration
