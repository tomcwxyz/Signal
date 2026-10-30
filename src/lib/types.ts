export type LatLon = { lat: number; lon: number };
export type WiFiAccess = "free" | "unknown" | "customers" | "paid";
export type WiFiPlace = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: string;
  access: WiFiAccess;
  openingHours?: string;
  website?: string;
  osmUrl: string;
};
export type WiFiResult = { places: WiFiPlace[]; centre: LatLon; fetchedAt: string; source: "OpenStreetMap"; matches?: number; limited?: boolean; radiusMetres?: number; osmDataAt?: string | null };
export type SavedArea = {
  id: string;
  label: string;
  centre: LatLon;
  places: WiFiPlace[];
  savedAt: string;
  radiusMetres: number;
};
export type MobileNetwork = "All" | "EE" | "O2" | "Vodafone" | "Three";
export type MobileTechnology = "4G" | "5G";
