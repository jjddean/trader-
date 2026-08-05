import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import {
  getMaerskLocationsByUNLocode,
  MaerskApiError,
  searchMaerskLocations,
} from "@/lib/maersk-client";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cityName = request.nextUrl.searchParams.get("cityName")?.trim();
  const unlocode = request.nextUrl.searchParams.get("unlocode")?.trim().toUpperCase();
  if (!unlocode && (!cityName || cityName.length > 80)) {
    return NextResponse.json({ error: "A valid unlocode or cityName is required" }, { status: 400 });
  }
  if (unlocode && !/^[A-Z]{2}[A-Z0-9]{3}$/.test(unlocode)) {
    return NextResponse.json({ error: "UN/LOCODE must contain five characters" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      unlocode
        ? await getMaerskLocationsByUNLocode(unlocode)
        : await searchMaerskLocations(cityName!),
    );
  } catch (error) {
    const status = error instanceof MaerskApiError ? error.status : 502;
    return NextResponse.json({ error: "Maersk locations are unavailable" }, { status });
  }
}