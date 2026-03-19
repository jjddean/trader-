"use client";

import { useState } from "react";
import { FileUp, FileText, Search, PlusCircle, MoreHorizontal, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Static mock data for UI review
const MOCK_FILES = [
  {
    id: "f_1",
    name: "Commercial_Invoice_INV-2026-042.pdf",
    date: "17 Mar 2026",
    size: "1.2 MB",
    status: "extracted",
    mrn: "MRN_8839201A",
  },
  {
    id: "f_2",
    name: "Packing_List_Shipper_Shanghai.xlsx",
    date: "16 Mar 2026",
    size: "45 KB",
    status: "pending",
    mrn: "MRN_8839201A",
  },
  {
    id: "f_3",
    name: "AWB_772-9981-2234.pdf",
    date: "15 Mar 2026",
    size: "2.4 MB",
    status: "extracted",
    mrn: "MRN_9100223B",
  },
];

export default function FilesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="mx-auto max-w-[900px] px-8 py-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#37352f] mb-2">Supporting Files</h1>
          <p className="text-sm text-[#787774]">
            Upload commercial invoices and packing lists for AI extraction.
          </p>
        </div>
        <Button className="bg-[#2383e2] hover:bg-[#1d6fc0] text-white px-4 py-2 rounded-[4px] text-sm font-medium transition-colors shadow-none h-auto">
          <FileUp className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Control Bar */}
      <div className="mb-6 flex items-center justify-between border-b border-[#e9e9e7] pb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#787774]" />
          <input
            type="text"
            placeholder="Search files or MRNs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[4px] bg-gray-50 hover:bg-[#efefed] border-transparent focus:bg-white focus:border-[#2383e2] focus:ring-1 focus:ring-[#2383e2] py-1.5 pl-9 pr-3 text-sm text-[#37352f] placeholder:text-[#787774] outline-none transition-all"
          />
        </div>
      </div>

      {/* File Table */}
      <div className="flex flex-col overflow-hidden rounded-[4px] border border-[#e9e9e7] bg-white shadow-none">
        <div className="grid grid-cols-12 gap-4 border-b border-[#e9e9e7] bg-gray-50 px-5 py-3 text-[0.625rem] font-semibold text-[#787774] tracking-wider uppercase">
          <div className="col-span-5">File Name</div>
          <div className="col-span-2">Date Uploaded</div>
          <div className="col-span-2">Associated MRN</div>
          <div className="col-span-2">AI Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        <div className="flex-1">
          {MOCK_FILES.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-12 items-center gap-4 border-b border-[#e9e9e7] px-5 py-3 hover:bg-gray-50 transition-colors last:border-0"
            >
              <div className="col-span-5 flex items-center gap-3">
                <FileText className="h-4 w-4 text-[#787774]" />
                <span className="truncate text-sm font-medium text-[#37352f]">
                  {file.name}
                </span>
                <span className="text-xs text-[#787774]">{file.size}</span>
              </div>
              <div className="col-span-2">
                <span className="text-sm text-[#787774]">{file.date}</span>
              </div>
              <div className="col-span-2">
                <span className="inline-flex items-center rounded-[4px] border border-[#e9e9e7] bg-white px-2 py-0.5 text-xs font-medium text-[#37352f]">
                  {file.mrn}
                </span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5">
                {file.status === "extracted" ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-sm font-medium text-[#37352f] capitalize">
                      {file.status}
                    </span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-sm font-medium text-[#37352f] capitalize">
                      {file.status}
                    </span>
                  </>
                )}
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[4px] hover:bg-[#e9e9e7] text-[#787774]">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
