import type { LatLon, WiFiPlace } from "./types";
export const DEFAULT_CENTRE: LatLon = { lat: 54.617, lon: -1.577 };
export const FETCH_RADIUS_METRES = 3000;
export function validCoordinates({ lat, lon }: LatLon): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 49 && lat <= 61.2 && lon >= -9 && lon <= 2.5;
}
export function distanceMetres(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function sortByDistance(places: WiFiPlace[], centre: LatLon): WiFiPlace[] {
  return [...places].sort((a, b) => distanceMetres(centre, a) - distanceMetres(centre, b));
}
export function prettyDistance(distance: number): string {
  return distance < 1000 ? Math.round(distance) + " m" : (distance / 1000).toFixed(1) + " km";
}
