# FreightCode Modernization & TRE Integration (March 2026)

## Overview of Recent Changes
We have transitioned from the legacy Freightcode prototype logic to a more robust, integrated customs declaration suite. Recent updates include:

1. **Bug Fixes (Documents Page)**:
   - Resolved critical `ReferenceError` by implementing the missing `declarationFilter`, `typeFilter`, and `selectedDocument` state hooks.
   - Restored full MRN filtering and document detail side-sheet functionality.

2. **HMRC TRE Hero Section**:
   - Implemented a dedicated **Automated TRE Data Analysis** hero section on the landing page.
   - Focuses on the "Forward CSV" ingestion model, instant duty reclaims, and broker performance auditing.

3. **Knowledge Hub Optimization**:
   - Refined the primary resource section by removing redundant TRE guide cards.
   - Optimized the layout to a compact 4-column grid.
   - Standardized typography (`text-base` titles, `text-[13px]` descriptions) and reduced padding for a cleaner, high-density UI.

## Bug Discovery & Root Cause (March 2026)
During the audit of the `DocumentsPage`, we identified a critical `ReferenceError` that prevented the page from rendering.

**Findings**:
- The component was attempting to filter documents and manage a detail side-sheet using `declarationFilter`, `typeFilter`, and `selectedDocument`.
- While the logic for handling these values (useMemo, useCallback) was present, the actual `useState` hooks were missing from the component body.
- **Impact**: The page would crash immediately on load due to `declarationFilter is not defined` inside the `filteredDocuments` useMemo.
- **Correction**: We restored the missing state declarations and initialized them with default values (`"all"` and `null`), re-enabling the filtering and detail view capabilities.

---

# Legacy Tools Preservation Archive (Freightcode Prototype Era)

The following legacy prototype logic has been preserved for future reference. These tools have been replaced by the modern Freightcode compliance suite but are kept here to ensure no custom business logic or edge cases are lost.

========================================================================
LEGACY TOOLS PRESERVATION
========================================================================

[LEGACY IMPORTS]
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileText, Download, Globe, Package, Calculator } from "lucide-react";

[LEGACY STATE]
const [selectedCountry, setSelectedCountry] = useState("");
const eligibility = useQuery(api.compliance.checkEligibility, selectedCountry ? { originCountry: selectedCountry } : "skip");

const simulateRoO = useMutation(api.compliance.simulateRoO);
const [rooForm, setRooForm] = useState({ originCountry: "", commodityCode: "", valueOrigin: "", valueUK: "", valueThirdParty: "" });
const [rooResult, setRooResult] = useState<any | null>(null);
const [simulating, setSimulating] = useState(false);

const calculateLandedCost = useMutation(api.calculator.calculateLandedCost);
const [calcForm, setCalcForm] = useState({ hsCode: "", originCountry: "", itemValue: "", shippingCost: "", dutyRate: "", vatRate: "20" });
const [calcResult, setCalcResult] = useState<any | null>(null);
const [calculating, setCalculating] = useState(false);

[LEGACY JSX - DCTS Eligibility Check & Rules of Origin Simulator]
<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
  // Left: DCTS Eligibility Checker
  <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
    ...
  </div>
  
  // Right: Rules of Origin Simulator
  <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
    ...
  </div>
</div>

[LEGACY JSX - Landed Cost Calculator]
<div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
  ...
</div>
