import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { validCoordinates } from "@/lib/geo";
import { normaliseWiFi, type OverpassElement } from "@/lib/wifi";

const schema = z.object({ lat: z.coerce.number().finite(), lon: z.coerce.number().finite() });
const source = "https://overpass.private.coffee/api/interpreter";
// Public Overpass is suitable only for a cautious, low-traffic alpha.
// Cache by rounded coordinates for 15 minutes; a proper UK import is next.
const queryOverpass = unstable_cache(async (lat: number, lon: number) => {
  const query = '[out:json][timeout:20];nwr(around:3000,' + lat + ',' + lon + ')["internet_access"="wlan"];out center tags;';
  const response = await fetch(source, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Signal/0.2 (+https://github.com/tomcwxyz/Signal)"
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(23000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Overpass temporarily unavailable");
  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object" || !("elements" in raw) || !Array.isArray(raw.elements)) {
    throw new Error("Invalid upstream data");
  }
  const places = (raw.elements as OverpassElement[])
    .slice(0, 700)
    .map(element => normaliseWiFi(element))
    .filter((place): place is NonNullable<typeof place> => place !== null);
  return { places, centre: { lat, lon }, fetchedAt: new Date().toISOString(), source: "OpenStreetMap" as const };
}, ["signal-wifi-v2"], { revalidate: 900 });

export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success || !validCoordinates(parsed.data)) {
    return NextResponse.json({ error: "Provide valid UK latitude and longitude." }, { status: 400 });
  }
  const lat = Math.round(parsed.data.lat * 100) / 100;
  const lon = Math.round(parsed.data.lon * 100) / 100;
  try {
    return NextResponse.json(await queryOverpass(lat, lon), {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" }
    });
  } catch {
    return NextResponse.json({ error: "Wi-Fi records are temporarily unavailable. Your saved places still work offline." }, {
      status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" }
    });
  }
}
