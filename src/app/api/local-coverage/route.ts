import { NextRequest, NextResponse } from "next/server";
import { validCoordinates, distanceMetres } from "@/lib/geo";
import { sampleTargets, summariseSample, MAX_LOCAL_SAMPLES, LOCAL_SAMPLE_RADIUS_METRES } from "@/lib/local-coverage";
import { fetchOfcomRawPostcode, normaliseOfcomPostcode, OfcomConfigurationError, OfcomUpstreamError } from "@/lib/ofcom-client";
import { normaliseOfcomCoverage } from "@/lib/ofcom-coverage";
import type { LatLon } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 40;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const windows = new Map<string, { count: number; expires: number }>();
type NearestResult = { result?: Array<{ postcode?: string; latitude?: number; longitude?: number; distance?: number }> | null };

async function nearestPostcode(target: LatLon): Promise<{ postcode: string; centre: LatLon } | null> {
  const url = new URL("https://api.postcodes.io/postcodes");
  url.searchParams.set("lat", target.lat.toFixed(5));
  url.searchParams.set("lon", target.lon.toFixed(5));
  url.searchParams.set("limit", "1");
  url.searchParams.set("radius", "550");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5500) });
  if (!response.ok) throw new Error("Postcode service unavailable");
  const body = await response.json() as NearestResult;
  const postcode = normaliseOfcomPostcode(body.result?.[0]?.postcode || "");
  const location = { lat: body.result?.[0]?.latitude, lon: body.result?.[0]?.longitude };
  if (!postcode || typeof location.lat !== "number" || typeof location.lon !== "number" ||
      !validCoordinates({ lat: location.lat, lon: location.lon }) ||
      distanceMetres(target, { lat: location.lat, lon: location.lon }) > 600) return null;
  return { postcode, centre: { lat: location.lat, lon: location.lon } };
}

/** A small and deliberate local lookup; never a bulk postcode crawl or stored dataset. */
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const centre = { lat, lon };
  if (!validCoordinates(centre)) return NextResponse.json({ error: "Select a valid UK map location." }, { status: 400, headers: noStore });
  if (!process.env.OFCOM_API_KEY) return NextResponse.json({ error: "Ofcom mobile coverage is not configured." }, { status: 503, headers: noStore });

  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const now = Date.now();
  if (windows.size > 1500) windows.clear();
  const previous = windows.get(ip);
  const state = !previous || previous.expires <= now ? { count: 0, expires: now + 60_000 } : previous;
  state.count += 1;
  windows.set(ip, state);
  // Nine provider requests per click, so impose a stricter endpoint budget.
  if (state.count > 3) return NextResponse.json({
    error: "You've checked this local area several times. Please try again in a minute."
  }, { status: 429, headers: { ...noStore, "Retry-After": "60" } });

  const lookups = await Promise.allSettled(sampleTargets(centre).slice(0, MAX_LOCAL_SAMPLES).map(nearestPostcode));
  const unique = new Map<string, { postcode: string; centre: LatLon }>();
  let failedLookups = lookups.filter(item => item.status === "rejected").length;
  for (const lookup of lookups) {
    if (lookup.status === "fulfilled" && lookup.value) unique.set(lookup.value.postcode, lookup.value);
  }
  const located = [...unique.values()].slice(0, MAX_LOCAL_SAMPLES);
  if (!located.length) return NextResponse.json({
    centre, searchRadiusMetres: LOCAL_SAMPLE_RADIUS_METRES,
    samples: [], failedLookups, source: "Ofcom", kind: "sampled-postcode-centroids"
  }, { headers: noStore });
  // All requests are for postcodes chosen from this single user-initiated local view.
  // No persistence, no export and no interpretation as a continuous geospatial surface.
  const results = await Promise.allSettled(located.map(async item => {
    const raw = await fetchOfcomRawPostcode(item.postcode);
    return summariseSample(normaliseOfcomCoverage(raw, item.postcode), item.centre);
  }));
  const samples = results.flatMap(item => item.status === "fulfilled" ? [item.value] : []);
  failedLookups += results.filter(item => item.status === "rejected").length;
  if (!samples.length) return NextResponse.json({
    error: "Ofcom did not return usable predictions for these nearby postcodes. Try again shortly."
  }, { status: 503, headers: noStore });
  return NextResponse.json({
    centre, searchRadiusMetres: LOCAL_SAMPLE_RADIUS_METRES, samples,
    failedLookups, source: "Ofcom", kind: "sampled-postcode-centroids"
  }, { headers: noStore });
}
