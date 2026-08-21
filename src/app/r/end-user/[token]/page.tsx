import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy URL bearers are no longer accepted. */
export default function LegacyEndUserStatementRoute() {
  redirect("/r/end-user/unavailable");
}
