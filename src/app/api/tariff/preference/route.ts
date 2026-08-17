import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPreferenceDecisionFromApi } from "@/lib/preference-engine";
import { userMessageFromError } from "@/lib/convex-errors";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = await request.json();
    const country = String(body?.country || "").trim().toUpperCase();
    const commodityCode = String(body?.commodityCode || "").replace(/\s+/g, "");
    const customsValueGbp = Number(body?.customsValueGbp ?? 0);
    const netWeightKg =
      body?.netWeightKg != null && body.netWeightKg !== ""
        ? Number(body.netWeightKg)
        : undefined;
    const supplementaryUnitQty =
      body?.supplementaryUnitQty != null && body.supplementaryUnitQty !== ""
        ? Number(body.supplementaryUnitQty)
        : undefined;

    if (!country || !/^[A-Z]{2}$/.test(country)) {
      return NextResponse.json({ error: "Valid 2-letter country code required" }, { status: 400 });
    }
    if (!/^\d{10}$/.test(commodityCode)) {
      return NextResponse.json({ error: "Commodity code must be a valid 10-digit number" }, { status: 400 });
    }

    const result = await getPreferenceDecisionFromApi({
      country,
      commodityCode,
      customsValueGbp: Number.isFinite(customsValueGbp) ? customsValueGbp : 0,
      netWeightKg: Number.isFinite(netWeightKg) ? netWeightKg : undefined,
      supplementaryUnitQty: Number.isFinite(supplementaryUnitQty) ? supplementaryUnitQty : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = userMessageFromError(error, "Preference check failed");
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
