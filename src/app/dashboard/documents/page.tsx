"use client";

import React from "react";
import { Upload, ClipboardPaste, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// MOCK DATA
const MOCK_DOCUMENTS = [
  { id: 1, name: "INV-2026-03-01.pdf", method: "Smart Upload", date: "Today, 09:41 AM", type: "N935", typeName: "Commercial invoice", mrn: "26GB1234567890ABCD", status: "verified", de23: "N935", flag: "" },
  { id: 2, name: "PL-004-B.pdf", method: "Smart Upload", date: "Today, 09:42 AM", type: "N271", typeName: "Packing list", mrn: "26GB1234567890ABCD", status: "verified", de23: "N271", flag: "" },
  { id: 3, name: "CERT-ORIGIN-CH.pdf", method: "Manual Paste", date: "Yesterday, 14:22 PM", type: "N864", typeName: "Certificate of origin", mrn: "26GB9876543210WXYZ", status: "review", flag: "Signature unverified", de23: "N864" },
  { id: 4, name: "Missing Document", method: "System Flag", date: "System", type: "C400", typeName: "Licence", mrn: "26GB9876543210WXYZ", status: "missing", flag: "Required for 6110 30 10 00", de23: "C400" },
  { id: 5, name: "BOL-HKG-LHR.pdf", method: "Smart Upload", date: "Mar 18, 11:05 AM", type: "N705", typeName: "Bill of lading", mrn: "26GB1234567890ABCD", status: "verified", de23: "N705", flag: "" },
];

export default function DocumentsPage() {
  const totalDocs = MOCK_DOCUMENTS.length;
  const verifiedDocs = MOCK_DOCUMENTS.filter(d => d.status === 'verified').length;
  const reviewDocs = MOCK_DOCUMENTS.filter(d => d.status === 'review').length;
  const missingDocs = MOCK_DOCUMENTS.filter(d => d.status === 'missing').length;

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Supporting documents required for CDS declarations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-9 text-xs">
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Manual paste
          </Button>
          <Button className="h-9 text-xs">
            <Upload className="mr-2 h-4 w-4" />
            Upload document
          </Button>
        </div>
      </div>

      {/* KPI CARDS ROW */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
            Total Documents
          </p>
          <h2 className="text-2xl font-medium tracking-tight text-foreground tabular-nums">
            {totalDocs}
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-500">across 2 declarations</p>
        </div>

        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
            Verified By AI
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-medium tracking-tight text-green-600 tabular-nums">
              {verifiedDocs}
            </h2>
          </div>
          <p className="mt-1 text-[0.625rem] text-gray-500">no issues found</p>
        </div>

        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
            Needs Review
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-medium tracking-tight text-amber-600 tabular-nums">
              {reviewDocs}
            </h2>
          </div>
          <p className="mt-1 text-[0.625rem] text-gray-500">compliance flags</p>
        </div>

        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
            Missing
          </p>
          <h2 className="text-2xl font-medium tracking-tight text-red-600 tabular-nums">
            {missingDocs}
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-500">required for submission</p>
        </div>
      </div>

      {/* FILTER BAR & TABLE AREA */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
        <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-gray-50 px-5 py-4">
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px] h-8 bg-white text-xs border-gray-200">
              <SelectValue placeholder="All declarations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All declarations</SelectItem>
              <SelectItem value="26GB1234567890ABCD" className="text-xs font-mono">26GB1234567890ABCD</SelectItem>
              <SelectItem value="26GB9876543210WXYZ" className="text-xs font-mono">26GB9876543210WXYZ</SelectItem>
            </SelectContent>
          </Select>
          
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px] h-8 bg-white text-xs border-gray-200">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All types</SelectItem>
              <SelectItem value="Commercial invoice" className="text-xs">Commercial invoice</SelectItem>
              <SelectItem value="Packing list" className="text-xs">Packing list</SelectItem>
              <SelectItem value="Certificate of origin" className="text-xs">Certificate of origin</SelectItem>
              <SelectItem value="Bill of lading" className="text-xs">Bill of lading</SelectItem>
              <SelectItem value="Licence" className="text-xs">Licence</SelectItem>
              <SelectItem value="Other" className="text-xs">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-[#e9e9e7]">
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase w-[40%]">DOCUMENT</th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">TYPE</th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">LINKED MRN</th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">STATUS</th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase text-right w-[80px]">DE 2/3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9e9e7]">
              {MOCK_DOCUMENTS.map((doc) => {
                const isWarning = doc.status === 'review';
                const isMissing = doc.status === 'missing';

                return (
                  <tr 
                    key={doc.id} 
                    className={cn(
                      "group cursor-pointer transition-colors",
                      isWarning ? "bg-orange-50/50 hover:bg-orange-50" : "",
                      isMissing ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-gray-50"
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={cn("text-xs font-semibold transition-colors", isWarning ? "text-orange-900 group-hover:text-orange-900" : isMissing ? "text-red-900 group-hover:text-red-900" : "text-black group-hover:text-black")}>
                          {doc.name}
                        </span>
                        <span className={cn("text-[0.625rem] mt-0.5", isWarning ? "text-orange-700 font-medium" : isMissing ? "text-red-700 font-medium" : "text-gray-500")}>
                          {isMissing || isWarning ? doc.flag : `${doc.method} • ${doc.date}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-gray-600">
                      {doc.typeName} <span className="text-[0.625rem] text-gray-400 ml-1">({doc.type})</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-semibold text-black transition-colors group-hover:text-black">{doc.mrn}</span>
                    </td>
                    <td className="px-6 py-4">
                      {doc.status === 'verified' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                          Verified
                        </span>
                      )}
                      {doc.status === 'review' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-[0.625rem] font-medium text-orange-700">
                          Review
                        </span>
                      )}
                      {doc.status === 'missing' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700">
                          Missing
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-[0.6875rem] font-medium text-gray-400">{doc.de23}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <p className="text-[0.6875rem] text-gray-400 flex items-center gap-1.5 mt-3">
        <Info className="h-3.5 w-3.5" />
        DE 2/3 = CDS Data Element reference used in declaration submission
      </p>

      {/*
        ========================================================================
        LEGACY TOOLS PRESERVATION
        The DCTS Eligibility Check, Rules of Origin Simulator, and Landed Cost 
        Calculator have been successfully archived here. DO NOT DELETE.
        They will be migrated to /dashboard/tools in a future task.
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
      */}

    </div>
  );
}
