import { validCoordinates } from "./geo";
import type { LatLon } from "./types";

export type SharedMap = { centre: LatLon; zoom: number };
export function parseSharedMap(params: URLSearchParams): SharedMap | null {
  if (!params.has("lat") || !params.has("lon")) return null;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const zoom = Number(params.get("zoom") || "14");
  if (!validCoordinates({ lat, lon }) || !Number.isFinite(zoom)) return null;
  return { centre: { lat, lon }, zoom: Math.max(8, Math.min(17, zoom)) };
}
export function sharedMapPath(centre: LatLon, zoom: number): string {
  const params = new URLSearchParams({
    lat: centre.lat.toFixed(5), lon: centre.lon.toFixed(5), zoom: String(Math.round(zoom))
  });
  return "/?" + params.toString();
}
