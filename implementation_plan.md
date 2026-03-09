# Implementation Plan: Sidebar Architecture and Auth Resolution

This plan addresses the goal of unifying the dashboard layout, fixing the sidebar/header relationship, and resolving authentication-related issues identified in the current codebase.

## Proposed Changes

### 1. Header Unification
Replace ad-hoc header implementations in dashboard pages with the centralized `DashboardHeader` component.

- **[MODIFY] [DashboardPage](src/app/dashboard/page.tsx)**: Replace ad-hoc header with `<DashboardHeader />`.
- **[MODIFY] [CompliancePage](src/app/dashboard/compliance/page.tsx)**: Replace ad-hoc header with `<DashboardHeader />`.
- **[MODIFY] [ProspectsPage](src/app/dashboard/prospects/page.tsx)**: Replace ad-hoc header with `<DashboardHeader />`.

### 2. Sidebar Integration
Ensure `AppSidebar` is the single, stable sidebar implementation.

### 3. Authentication & Issues Badge
Resolve the `aud` claim mismatch and address the "2 Issues" notification.

---

## Verification Plan
1. **Layout**: Check sidebar toggle and header alignment.
2. **Navigation**: Verify header consistency across pages.
3. **Auth**: Verify successful user sync in Convex.
