import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { validCoordinates } from "@/lib/geo";
import { WIFI_SEARCH_RADIUS_METRES, normaliseOverpassResults, overpassQuery } from "@/lib/wifi-query";
import type { OverpassElement } from "@/lib/wifi";

export const maxDuration = 30;

const schema = z.object({ lat: z.coerce.number().finite(), lon: z.coerce.number().finite() });
const endpoints = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter"
] as const;

type OverpassResponse = {
  elements: OverpassElement[];
  osm3s?: { timestamp_osm_base?: string };
};

async function getElements(url: string, data: string): Promise<OverpassResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Signal-WiFi-Alpha/0.3 (+https://github.com/tomcwxyz/Signal)"
    },
    body: new URLSearchParams({ data }),
    signal: AbortSignal.timeout(11500),
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Overpass " + response.status);
  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object" || !("elements" in raw) || !Array.isArray(raw.elements)) {
    throw new Error("Invalid Overpass response");
  }
  return raw as OverpassResponse;
}

// Requests for the same 0.01-degree cell share this 15-minute cached result.
const queryOverpass = unstable_cache(async (lat: number, lon: number) => {
  const centre = { lat, lon };
  const query = overpassQuery(centre);
  for (const endpoint of endpoints) {
    try {
      const data = await getElements(endpoint, query);
      const { places, matches, limited } = normaliseOverpassResults(data.elements, centre);
      return {
        places, centre, matches, limited,
        fetchedAt: new Date().toISOString(),
        osmDataAt: data.osm3s?.timestamp_osm_base ?? null,
        radiusMetres: WIFI_SEARCH_RADIUS_METRES,
        source: "OpenStreetMap" as const
      };
    } catch (err) {
      console.warn("Signal Wi-Fi: upstream source failed", new URL(endpoint).host,
        err instanceof Error ? err.message : "Unknown error");
    }
  }
  throw new Error("Wi-Fi data sources are unavailable");
}, ["signal-wifi-v3"], { revalidate: 900 });

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
    return NextResponse.json({
      error: "The live OpenStreetMap Wi-Fi feed is not responding. Try again shortly; saved places still work offline.",
      source: "OpenStreetMap",
      status: "unavailable"
    }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
}
