import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

type Coordinates = { latitude: number; longitude: number };

async function geocode(place: string): Promise<Coordinates | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const url = new URL(`https://api.mapbox.com/search/geocode/v6/forward`);
  url.searchParams.set("q", place);
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000), next: { revalidate: 86400 } });
  if (!response.ok) return null;
  const data = await response.json() as { features?: Array<{ geometry?: { coordinates?: number[] } }> };
  const coordinates = data.features?.[0]?.geometry?.coordinates;
  return coordinates?.length === 2 ? { longitude: coordinates[0], latitude: coordinates[1] } : null;
}

async function weather(location: string, coordinates: Coordinates | null) {
  if (!coordinates) return null;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(coordinates.latitude));
  url.searchParams.set("longitude", String(coordinates.longitude));
  url.searchParams.set("current", "temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m");
  url.searchParams.set("wind_speed_unit", "kn");
  url.searchParams.set("timezone", "UTC");
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000), next: { revalidate: 900 } });
  if (!response.ok) return null;
  const data = await response.json() as { current?: Record<string, number | string> };
  return data.current ? { location, coordinates, ...data.current } : null;
}

async function news(origin: string, destination: string) {
  const query = `(${origin} OR ${destination}) (shipping OR port OR maritime OR sanctions OR conflict OR piracy)`;
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", "12");
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "datedesc");
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), next: { revalidate: 900 } });
  if (!response.ok) return [];
  const data = await response.json() as { articles?: unknown[] };
  return Array.isArray(data.articles) ? data.articles : [];
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const origin = request.nextUrl.searchParams.get("origin")?.trim();
  const destination = request.nextUrl.searchParams.get("destination")?.trim();
  if (!origin || !destination || origin.length > 100 || destination.length > 100) {
    return NextResponse.json({ error: "Valid origin and destination are required" }, { status: 400 });
  }

  const [originCoordinates, destinationCoordinates] = await Promise.all([
    geocode(origin),
    geocode(destination),
  ]);
  const [originWeather, destinationWeather, articles] = await Promise.all([
    weather(origin, originCoordinates),
    weather(destination, destinationCoordinates),
    news(origin, destination),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    weather: [originWeather, destinationWeather].filter(Boolean),
    articles,
    maritime: { status: "requires_vessel_imo" },
    sanctions: { status: "intelligence_only", screeningEndpoint: "/api/export-controls/screen" },
  });
}
