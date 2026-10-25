import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validCoordinates } from "@/lib/geo";
import { normaliseWiFi, type OverpassElement } from "@/lib/wifi";
const schema = z.object({
  lat: z.coerce.number().finite(),
  lon: z.coerce.number().finite()
});
export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success || !validCoordinates(parsed.data)) {
    return NextResponse.json({ error: "Provide valid UK latitude and longitude." }, { status: 400 });
  }
  // Coarse coordinate bucketing improves cache reuse and reduces community API load.
  const lat = Math.round(parsed.data.lat * 100) / 100;
  const lon = Math.round(parsed.data.lon * 100) / 100;
  const query = "[out:json][timeout:20];nwr(around:3000," + lat + "," + lon + ")[\"internet_access\"=\"wlan\"];out center tags;";
  try {
    const response = await fetch("https://overpass.private.coffee/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "User-Agent": "Signal/0.1 (https://github.com/tomcwxyz/Signal)" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(20000),
      next: { revalidate: 900 }
    });
    if (!response.ok) throw new Error("Upstream Wi-Fi lookup unavailable");
    const data: { elements?: OverpassElement[] } = await response.json();
    const places = (data.elements ?? []).slice(0, 350).map(normaliseWiFi).filter((place): place is NonNullable<typeof place> => place !== null);
    return NextResponse.json({ places, fetchedAt: new Date().toISOString(), source: "OpenStreetMap" }, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" }
    });
  } catch {
    return NextResponse.json({ error: "Wi-Fi records are temporarily unavailable. Saved areas still work offline." }, { status: 503 });
  }
}
