import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  const input = (request.nextUrl.searchParams.get("q") || "").trim().replace(/\s+/g, "").toUpperCase();
  if (!/^(GIR0AA|[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2})$/.test(input)) {
    return NextResponse.json({ error: "Enter a full UK postcode, such as DL5 6LA." }, { status: 400 });
  }
  try {
    const response = await fetch("https://api.postcodes.io/postcodes/" + encodeURIComponent(input), {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return NextResponse.json({ error: "We couldn't find that postcode." }, { status: 404 });
    const data = await response.json();
    if (!data.result || typeof data.result.latitude !== "number" || typeof data.result.longitude !== "number") {
      throw new Error("Malformed postcode result");
    }
    return NextResponse.json({
      lat: data.result.latitude,
      lon: data.result.longitude,
      label: data.result.postcode + (data.result.admin_district ? " · " + data.result.admin_district : "")
    });
  } catch {
    return NextResponse.json({ error: "Postcode look-up is temporarily unavailable." }, { status: 503 });
  }
}
