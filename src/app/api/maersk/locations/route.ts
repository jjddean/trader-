import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { MaerskApiError, searchMaerskLocations } from "@/lib/maersk-client";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cityName = request.nextUrl.searchParams.get("cityName")?.trim();
  if (!cityName || cityName.length > 80) {
    return NextResponse.json({ error: "A valid cityName is required" }, { status: 400 });
  }

  try {
    return NextResponse.json(await searchMaerskLocations(cityName));
  } catch (error) {
    const status = error instanceof MaerskApiError ? error.status : 502;
    return NextResponse.json({ error: "Maersk locations are unavailable" }, { status });
  }
}
