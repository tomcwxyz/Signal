import { distanceMetres, sortByDistance } from "./geo";
import { normaliseWiFi, type OverpassElement } from "./wifi";
import type { LatLon, WiFiPlace } from "./types";

export const WIFI_SEARCH_RADIUS_METRES = 5000;
export const WIFI_RESULT_LIMIT = 300;

export function overpassQuery(centre: LatLon): string {
  const lat = centre.lat.toFixed(2);
  const lon = centre.lon.toFixed(2);
  const around = "(around:" + WIFI_SEARCH_RADIUS_METRES + "," + lat + "," + lon + ")";
  // Search BOTH accepted tagging conventions. The union deduplicates an OSM
  // object with both keys, while out center tags gives a coordinate to ways.
  return '[out:json][timeout:18];(' +
    'nwr' + around + '["internet_access"~"wlan|wifi",i];' +
    'nwr' + around + '["wifi"~"^(yes|free|public|customers|paid)$",i];' +
    ');out center tags qt;';
}

export function normaliseOverpassResults(elements: OverpassElement[], centre: LatLon): {
  places: WiFiPlace[];
  matches: number;
  limited: boolean;
} {
  const seen = new Set<string>();
  const matches: WiFiPlace[] = [];
  // Ignore unusually large/malformed payloads before mapping any of their data.
  for (const element of elements.slice(0, 3000)) {
    const place = normaliseWiFi(element);
    if (!place || seen.has(place.id)) continue;
    if (distanceMetres(place, centre) > WIFI_SEARCH_RADIUS_METRES + 300) continue;
    seen.add(place.id);
    matches.push(place);
  }
  const sorted = sortByDistance(matches, centre);
  return { places: sorted.slice(0, WIFI_RESULT_LIMIT), matches: sorted.length, limited: sorted.length > WIFI_RESULT_LIMIT };
}
