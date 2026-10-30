import type { LatLon } from "./types";

export type TravelMode = "walking" | "bicycling" | "driving";
export const DIRECTION_MODES: readonly TravelMode[] = ["walking", "bicycling", "driving"];

/**
 * Maps URLs use the destination's actual OpenStreetMap coordinates.
 * Leave origin unspecified so Google Maps can use the traveller's own
 * current position (not Signal's map centre).
 * See https://developers.google.com/maps/documentation/urls/get-started
 */
export function googleMapsDirectionsUrl(destination: LatLon, mode: TravelMode = "walking"): string {
  if (!Number.isFinite(destination.lat) || !Number.isFinite(destination.lon) ||
      destination.lat < -90 || destination.lat > 90 ||
      destination.lon < -180 || destination.lon > 180) {
    throw new RangeError("Invalid destination coordinates.");
  }
  if (!DIRECTION_MODES.includes(mode)) throw new RangeError("Invalid travel mode.");
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", destination.lat.toFixed(6) + "," + destination.lon.toFixed(6));
  url.searchParams.set("travelmode", mode);
  return url.toString();
}
