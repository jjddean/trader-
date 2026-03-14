# Codebase Cleanliness & Performance Standards

To maintain the high performance and stability of the TradeDNA application, all future modifications must adhere to these standards.

## 1. Zero-Ghost Artifacts
- **No Orphan Tables**: Do not define database tables (e.g., in `schema.ts`) that do not have active read/write paths in the application.
- **No Unused Metadata**: Audit logs or "edit history" records should only be implemented if there is a corresponding UI/service that consumes them. Purge logic that strictly "inserts" without "reading".

## 2. Server-Side Data Optimization
- **Database-Level Filtering**: Avoid fetching large collections (e.g., `prospects`, `shipments`) to the client for filtering. Always use Convex indexes and server-side arguments to limit the payload.
- **Single-Record Queries**: Use specialized queries (like `getLane`) to fetch specific records by ID rather than filtering through a list of all user records on the client.

## 3. Visual Stability & Stale Data
- **No Mock "Flashes"**: Eliminate mock data fallbacks in active workspaces. If data is loading, show a skeleton or a loading spinner rather than rendering stale "dummy" records.
- **Frame-Time Integrity**: UI components must maintain <50ms frame time. Any component causing layout shifts (CLS > 0.1) or long tasks (>100ms) during data population must be refactored or paginated.

## 4. Periodic Purging
- Run the cleanup scripts (`npm run cleanup:run`) regularly to identify and remove unused dependencies, temporary files, and orphaned configuration files.
