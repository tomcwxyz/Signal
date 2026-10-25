"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLon, WiFiPlace } from "@/lib/types";
type Focus = LatLon & { zoom: number; version: number };
type Props = {
  focus: Focus;
  places: WiFiPlace[];
  selectedId: string | null;
  showWiFi: boolean;
  onSelect: (id: string) => void;
  onViewChange: (centre: LatLon, zoom: number) => void;
};
const rasterStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' } },
  layers: [{ id: "osm-basemap", type: "raster", source: "osm" }]
};
export default function SignalMap({ focus, places, selectedId, showWiFi, onSelect, onViewChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Marker[]>([]);
  const onViewChangeRef = useRef(onViewChange);
  const [failed, setFailed] = useState(false);
  useEffect(() => { onViewChangeRef.current = onViewChange; }, [onViewChange]);
  useEffect(() => {
    if (!container.current || map.current) return;
    try {
      const instance = new maplibregl.Map({
        container: container.current, style: rasterStyle,
        center: [focus.lon, focus.lat], zoom: focus.zoom,
        maxBounds: [[-12, 48], [4, 62.5]],
        attributionControl: false
      });
      instance.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      instance.on("moveend", () => {
        const centre = instance.getCenter();
        onViewChangeRef.current({ lat: centre.lat, lon: centre.lng }, instance.getZoom());
      });
      instance.on("error", () => { /* Map tiles may fail independently; listings remain usable. */ });
      map.current = instance;
      return () => { markers.current.forEach(marker => marker.remove()); markers.current = []; instance.remove(); map.current = null; };
    } catch { setFailed(true); }
    // Only build/destroy the map on mount. Subsequent centres are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (focus.version > 0 && map.current) {
      map.current.flyTo({ center: [focus.lon, focus.lat], zoom: focus.zoom, essential: true });
    }
  }, [focus]);
  useEffect(() => {
    markers.current.forEach(marker => marker.remove());
    markers.current = [];
    if (!map.current || !showWiFi) return;
    for (const place of places) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-wifi-marker" + (place.id === selectedId ? " selected" : "") + (place.access === "customers" || place.access === "paid" ? " restricted" : "");
      button.setAttribute("aria-label", "Show " + place.name + ", " + place.access + " Wi-Fi");
      button.title = place.name;
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 9a15 15 0 0 1 18 0M6.5 12.5a10 10 0 0 1 11 0M10 16a4 4 0 0 1 4 0"/><circle cx="12" cy="19.5" r="1.4" fill="currentColor" stroke="none"/></svg>';
      button.addEventListener("click", () => onSelect(place.id));
      markers.current.push(new maplibregl.Marker({ element: button, anchor: "bottom" }).setLngLat([place.lon, place.lat]).addTo(map.current));
    }
    return () => { markers.current.forEach(marker => marker.remove()); markers.current = []; };
  }, [places, selectedId, showWiFi, onSelect]);
  return <div className="map-panel">
    <div ref={container} className="map-canvas" aria-label="Interactive map of Wi-Fi hotspots in the selected area" role="region" />
    {failed && <div className="map-error"><strong>Map unavailable on this device</strong><p>Use the Wi-Fi list below. Saved lists still work offline.</p></div>}
    <div className="map-overlay"><span className="live-dot" /> Wi-Fi from OpenStreetMap <span className="overlay-extra">· No coverage prediction</span></div>
  </div>;
}
