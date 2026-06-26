import { clearDeclarationLaneCache } from "@/lib/declaration-lane-cache";
import { clearDocumentsSnapshot } from "@/lib/dashboard-documents-cache";
import { clearComplianceSnapshots } from "@/lib/dashboard-compliance-cache";

/** Drop per-user dashboard snapshots when Clerk identity changes or signs out. */
export function clearDashboardUserCaches() {
  clearDocumentsSnapshot();
  clearComplianceSnapshots();
  clearDeclarationLaneCache();
}
