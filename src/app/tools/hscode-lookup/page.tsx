import { redirect } from "next/navigation";

/** Legacy URL retained for existing links and bookmarks. */
export default function LegacyHsCodeLookupRedirect() {
  redirect("/hs-code-lookup");
}
