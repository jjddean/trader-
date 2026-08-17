import { redirect } from "next/navigation";

export const metadata = {
  title: "Resources | freightcode®",
};

/** Resources hub removed — send to Solutions */
export default function ResourcesRedirect() {
  redirect("/solutions");
}
