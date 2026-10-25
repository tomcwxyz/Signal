import type { WiFiAccess, WiFiPlace } from "./types";
export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};
export function classifyWiFiAccess(tags: Record<string, string>): WiFiAccess {
  const fee = (tags["internet_access:fee"] ?? tags.fee ?? "").trim().toLowerCase();
  if (fee === "customers" || tags.access === "customers") return "customers";
  if (["yes", "paid"].includes(fee)) return "paid";
  if (["no", "free"].includes(fee)) return "free";
  return "unknown";
}
function safeWebsite(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : undefined;
  } catch { return undefined; }
}
export function normaliseWiFi(element: OverpassElement): WiFiPlace | null {
  const point = element.type === "node" ? element : element.center;
  if (!point || typeof point.lat !== "number" || typeof point.lon !== "number") return null;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return null;
  const tags = element.tags ?? {};
  const kind = tags.amenity?.replaceAll("_", " ") ?? tags.shop?.replaceAll("_", " ") ?? "Public access point";
  const name = tags.name ?? tags.operator ?? (kind === "Public access point" ? "Unnamed Wi-Fi location" : kind[0].toUpperCase() + kind.slice(1));
  return {
    id: element.type + "/" + element.id,
    name: name.slice(0, 150),
    lat: point.lat,
    lon: point.lon,
    kind,
    access: classifyWiFiAccess(tags),
    openingHours: tags.opening_hours?.slice(0, 140),
    website: safeWebsite(tags.website ?? tags["contact:website"]),
    osmUrl: "https://www.openstreetmap.org/" + element.type + "/" + element.id
  };
}
