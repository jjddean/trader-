import { redirect } from "next/navigation";

export default function FinancialRecordPrintRedirect() {
  redirect("/dashboard/records");
}
