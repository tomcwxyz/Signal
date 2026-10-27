import type { WiFiAccess, WiFiPlace } from "./types";
export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const wifiValues = new Set(["yes", "free", "public", "customers", "paid"]);
const blockedValues = new Set(["no", "private", "closed"]);
function value(tags: Record<string, string>, key: string): string {
  return (tags[key] ?? "").trim().toLowerCase();
}
export function hasWiFiEvidence(tags: Record<string, string>): boolean {
  if (blockedValues.has(value(tags, "wifi")) || blockedValues.has(value(tags, "internet_access"))) return false;
  if (blockedValues.has(value(tags, "access"))) return false;
  return wifiValues.has(value(tags, "wifi")) || /(^|;)\s*(wlan|wifi)\s*(;|$)/i.test(tags.internet_access ?? "");
}
export function classifyWiFiAccess(tags: Record<string, string>): WiFiAccess {
  const fee = value(tags, "internet_access:fee");
  const wifi = value(tags, "wifi");
  if (fee === "customers" || wifi === "customers" || value(tags, "access") === "customers") return "customers";
  if (fee === "yes" || fee === "paid" || wifi === "paid") return "paid";
  if (fee === "no" || fee === "free" || wifi === "free") return "free";
  // Never treat venue fee=no as evidence that its Wi-Fi is free.
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
  if (!element || !["node", "way", "relation"].includes(element.type) || !Number.isSafeInteger(element.id) || element.id < 1) return null;
  const tags = element.tags ?? {};
  if (!hasWiFiEvidence(tags)) return null;
  const point = element.type === "node" ? element : element.center;
  if (!point || typeof point.lat !== "number" || typeof point.lon !== "number") return null;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) return null;
  const kind = (tags.amenity ?? tags.shop ?? tags.tourism ?? "Public access point").replaceAll("_", " ");
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
