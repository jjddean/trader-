"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomsReportDocument } from "@/components/print/customs-report-document";
import { readCustomsReportPrintData, type CustomsReportPrintData } from "@/lib/print-sheet";

export default function CustomsReportPrintPage() {
  const router = useRouter();
  const [report, setReport] = useState<CustomsReportPrintData | null>(null);

  useEffect(() => {
    const data = readCustomsReportPrintData();
    if (!data) {
      router.replace("/dashboard/reports");
      return;
    }
    setReport(data);
  }, [router]);

  if (!report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500">
        Loading print preview...
      </div>
    );
  }

  return <CustomsReportDocument report={report} />;
}
