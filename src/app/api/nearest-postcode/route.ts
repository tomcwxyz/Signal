import { NextRequest, NextResponse } from "next/server";
import { validCoordinates } from "@/lib/geo";
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  if (!validCoordinates({ lat, lon })) return NextResponse.json({ error: "Invalid UK location." }, { status: 400 });
  try {
    const upstream = await fetch("https://api.postcodes.io/postcodes?lat=" + encodeURIComponent(String(lat)) + "&lon=" + encodeURIComponent(String(lon)) + "&limit=1", {
      next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000)
    });
    if (!upstream.ok) throw new Error("lookup unavailable");
    const data = await upstream.json();
    const postcode = data?.result?.[0]?.postcode;
    if (typeof postcode !== "string") return NextResponse.json({ error: "No nearby postcode found." }, { status: 404 });
    return NextResponse.json({ postcode });
  } catch { return NextResponse.json({ error: "Nearest postcode lookup unavailable." }, { status: 503 }); }
}
