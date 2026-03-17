---
title: Database Schema & Data Dictionary
product: freightcode®
version: 1.0
date: March 2026
---

# 1. Database Architecture Overview
freightcode utilizes Convex, a serverless, reactive database. The schema is fully typed using TypeScript to guarantee runtime safety when persisting financial and customs data.

# 2. Core Tables (Collections)

## 2.1 `users`
Tracks individual authenticated users connected via Clerk.
- `userId` (String): External ID from Clerk authentication.
- `email` (String): Primary contact email.
- `role` (String): E.g., "admin", "trader", "broker".
- `createdAt` (Number): Unix timestamp.

## 2.2 `workspaces`
Represents a corporate entity or logistics team.
- `name` (String): The company or team name.
- `ownerId` (Id<"users">): The user who created the workspace.
- `hmrcTokens` (Object): Secure, encrypted storage of HMRC OAuth Bearer and Refresh tokens.
- `stripeCustomerId` (String): Link to Stripe for SaaS billing.

## 2.3 `declarations` (Trade Lanes)
The header-level record for a specific import/export event sent to HMRC.
- `workspaceId` (Id<"workspaces">): The owning entity.
- `type` (String): e.g., "H1" (Standard Import), "B1" (Standard Export).
- `eori` (String): The Importer's unique EORI number.
- `status` (String): "Draft", "Verified", "Submitted", "Cleared", "Rejected".
- `lrn` (String): Local Reference Number (generated locally).
- `mrn` (String): Movement Reference Number (assigned by HMRC upon submission).
- `route` (String): Customs checking route (e.g., "Route 1", "Route 6").

## 2.4 `goods_items`
The line items attached to a specific declaration. WCO regulations allow up to 99 items per declaration.
- `declarationId` (Id<"declarations">): The parent declaration.
- `sequenceNumber` (Number): E.g., 1, 2, 3...
- `commodityCode` (String): The 10-digit HS code specifying the product.
- `description` (String): Plain text description (often extracted by AI from the invoice).
- `originCountry` (String): ISO standard 2-letter code (e.g., "GB", "CN", "US").
- `procedureCode` (String): Customs procedure, e.g., "4000" (Release for Free Circulation).
- `valueAmount` (Number): The declared monetary value.
- `valueCurrency` (String): ISO Currency code (e.g., "GBP", "USD").

# 3. Data Relationships
- A `user` belongs to one or more `workspaces`.
- A `workspace` contains many `declarations`.
- A `declaration` contains 1 to 99 `goods_items`.
- Deleting a `workspace` recursively archives all related `declarations` and `goods_items` (soft-delete implemented via status flags).
