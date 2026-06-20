import { redirect } from "next/navigation";

/** Billing lives at /dashboard/pricing — not part of sign-up. */
export default function ChoosePlanPage() {
  redirect("/dashboard/pricing");
}
