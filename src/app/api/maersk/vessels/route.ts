import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getMaerskVessels, MaerskApiError } from "@/lib/maersk-client";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const imo = request.nextUrl.searchParams.get("imo")?.trim() || "";
  const imoNumbers = imo.split(",").map((value) => value.trim()).filter(Boolean);
  if (imoNumbers.length === 0 || imoNumbers.length > 20 || imoNumbers.some((value) => !/^\d{7}$/.test(value))) {
    return NextResponse.json({ error: "Provide up to 20 valid seven-digit IMO numbers" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getMaerskVessels(imoNumbers));
  } catch (error) {
    const status = error instanceof MaerskApiError ? error.status : 502;
    return NextResponse.json({ error: "Maersk vessels are unavailable" }, { status });
  }
}
