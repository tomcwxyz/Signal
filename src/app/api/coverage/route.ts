import { NextRequest, NextResponse } from "next/server";
import { fetchOfcomRawPostcode, normaliseOfcomPostcode, OfcomConfigurationError, OfcomUpstreamError } from "@/lib/ofcom-client";
import { normaliseOfcomCoverage } from "@/lib/ofcom-coverage";

export const maxDuration = 20;
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
// Per-instance safeguard against casual rapid repeat requests. Not a global quota.
const requests = new Map<string, { count: number; expires: number }>();

export async function GET(request: NextRequest) {
  const postcode = normaliseOfcomPostcode(request.nextUrl.searchParams.get("postcode") || "");
  if (!postcode) return NextResponse.json({ error: "Enter a valid full UK postcode." }, { status: 400, headers });
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
  const now = Date.now();
  if (requests.size > 2000) requests.clear();
  const item = requests.get(ip);
  const current = !item || item.expires < now ? { count: 0, expires: now + 60_000 } : item;
  current.count++;
  requests.set(ip, current);
  if (current.count > 20) return NextResponse.json({ error: "Too many coverage checks. Please try again in a minute." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
  try {
    const raw = await fetchOfcomRawPostcode(postcode);
    return NextResponse.json(normaliseOfcomCoverage(raw, postcode), { headers });
  } catch (error) {
    if (error instanceof OfcomConfigurationError) {
      return NextResponse.json({ error: "Ofcom coverage is not yet configured." }, { status: 503, headers });
    }
    if (error instanceof OfcomUpstreamError) {
      const status = error.status;
      const userStatus = status === 404 ? 404 : status === 429 ? 429 : 503;
      const message = status === 404 ? "Ofcom has no data for this postcode." :
        status === 429 ? "Ofcom is receiving too many requests. Please retry shortly." :
        status === 401 || status === 403 ? "Ofcom access was refused. Please try again later." :
        "Ofcom mobile coverage is temporarily unavailable. Please try again.";
      return NextResponse.json({ error: message }, { status: userStatus, headers });
    }
    return NextResponse.json({ error: "Ofcom returned an unexpected coverage format. No prediction has been shown." }, { status: 502, headers });
  }
}
