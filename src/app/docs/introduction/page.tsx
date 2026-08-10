import { redirect } from "next/navigation";

/** Old intro URL — canonical docs home is now /docs */
export default function IntroductionRedirect() {
  redirect("/docs");
}
