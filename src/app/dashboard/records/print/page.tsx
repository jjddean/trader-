"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FinancialRecordDocument } from "@/components/print/financial-record-document";
import { readFinancialRecordPrintData, type FinancialRecordPrintData } from "@/lib/print-sheet";

export default function FinancialRecordPrintPage() {
  const router = useRouter();
  const [record, setRecord] = useState<FinancialRecordPrintData | null>(null);

  useEffect(() => {
    const data = readFinancialRecordPrintData();
    if (!data) {
      router.replace("/dashboard/records");
      return;
    }
    setRecord(data);
  }, [router]);

  if (!record) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500">
        Loading print preview...
      </div>
    );
  }

  return <FinancialRecordDocument record={record} />;
}
