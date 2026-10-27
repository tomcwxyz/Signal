"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { LatLon, WiFiPlace } from "@/lib/types";

type Focus = LatLon & { zoom: number; version: number };
type Props = {
  focus: Focus;
  places: WiFiPlace[];
  selectedId: string | null;
  showWiFi: boolean;
  onSelect: (id: string) => void;
  onViewChange: (centre: LatLon, zoom: number) => void;
  wifiStatus: "ready" | "loading" | "error" | "offline" | "zoom";
  wifiCount: number;
  freeCount: number;
  onShowConnections: () => void;
};

const BASEMAP_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
const MARKER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 9a15 15 0 0 1 18 0M6.5 12.5a10 10 0 0 1 11 0M10 16a4 4 0 0 1 4 0"/><circle cx="12" cy="19.5" r="1.4" fill="currentColor" stroke="none"/></svg>';

/** A deliberately lightweight raster map. No MapLibre/WebGL dependency. */
export default function SignalMap({ focus, places, selectedId, showWiFi, onSelect, onViewChange, wifiStatus, wifiCount, freeCount, onShowConnections }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const viewChanged = useRef(onViewChange);
  const selected = useRef(onSelect);
  const lastFocus = useRef(focus);
  const [attempt, setAttempt] = useState(0);
  const [renderVersion, setRenderVersion] = useState(0);
  const [tileStatus, setTileStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => { viewChanged.current = onViewChange; }, [onViewChange]);
  useEffect(() => { selected.current = onSelect; }, [onSelect]);
  lastFocus.current = focus;

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setTileStatus("loading");
    void import("leaflet").then(leaflet => {
      if (disposed || !container.current) return;
      leafletRef.current = leaflet;
      const point = lastFocus.current;
      // Tile layer is mounted only after the map element has non-zero dimensions.
      const instance = leaflet.map(container.current, {
        zoomControl: false, attributionControl: true,
        zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 5, maxZoom: 19,
        maxBounds: [[48, -12], [62.5, 4]]
      }).setView([point.lat, point.lon], point.zoom);
      mapRef.current = instance;
      const markers = leaflet.layerGroup().addTo(instance);
      markersRef.current = markers;
      const tileLayer = leaflet.tileLayer(BASEMAP_TILES, {
        maxZoom: 19, minZoom: 5, tileSize: 256,
        attribution: MAP_ATTRIBUTION,
        crossOrigin: false,
        updateWhenIdle: true
      }).addTo(instance);
      leaflet.control.zoom({ position: "bottomright" }).addTo(instance);

      let loaded = false;
      let errors = 0;
      tileLayer.on("tileload", () => {
        loaded = true;
        if (!disposed) setTileStatus("ready");
      });
      tileLayer.on("tileerror", () => {
        errors += 1;
        if (!loaded && errors >= 3 && !disposed) setTileStatus("failed");
      });
      timer = setTimeout(() => {
        if (!loaded && !disposed) setTileStatus("failed");
      }, 11000);

      instance.on("moveend", () => {
        if (disposed) return;
        const centre = instance.getCenter();
        viewChanged.current({ lat: centre.lat, lon: centre.lng }, instance.getZoom());
      });
      // Invalidate once layout and browser chrome settle on mobile browsers.
      requestAnimationFrame(() => { if (!disposed) instance.invalidateSize({ pan: false }); });
      setRenderVersion(version => version + 1);
    }).catch(() => { if (!disposed) setTileStatus("failed"); });

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      markersRef.current = null;
      const oldMap = mapRef.current;
      mapRef.current = null;
      if (oldMap) oldMap.remove();
      leafletRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (mapRef.current && focus.version > 0) {
      mapRef.current.setView([focus.lat, focus.lon], focus.zoom, { animate: true });
    }
  }, [focus]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const markers = markersRef.current;
    if (!leaflet || !markers) return;
    markers.clearLayers();
    if (!showWiFi) return;
    for (const place of places.slice(0, 300)) {
      const classes = [
        "signal-leaflet-marker",
        place.id === selectedId ? "selected" : "",
        place.access === "free" ? "free" : "",
        place.access === "customers" || place.access === "paid" ? "restricted" : ""
      ].filter(Boolean).join(" ");
      const icon = leaflet.divIcon({
        className: classes,
        html: '<span class="signal-marker-inner">' + MARKER_SVG + '</span>',
        iconSize: [37, 37],
        iconAnchor: [18, 37],
      });
      const marker = leaflet.marker([place.lat, place.lon], {
        icon, title: place.name, keyboard: true, alt: place.name
      });
      marker.on("click", () => selected.current(place.id));
      marker.addTo(markers);
    }
  }, [places, selectedId, showWiFi, renderVersion]);

  const osmLink = "https://www.openstreetmap.org/#map/" + Math.round(focus.zoom) + "/" + focus.lat.toFixed(5) + "/" + focus.lon.toFixed(5);
  return <div className="map-panel">
    <div ref={container} className="map-canvas" aria-label="Interactive map of nearby Wi-Fi hotspots" role="region" />
    {tileStatus === "loading" && <div className="map-loading" role="status">Loading street map…</div>}
    {tileStatus === "failed" && <div className="map-error" role="alert">
      <strong>The street map couldn't load</strong>
      <p>Your browser or connection couldn't load map tiles. You can still browse Wi-Fi locations below.</p>
      <div className="map-error-actions">
        <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry map</button>
        <a target="_blank" rel="noopener noreferrer" href={osmLink}>Open in OpenStreetMap ↗</a>
      </div>
    </div>}
    <div className="map-overlay"><span className="live-dot" /> OpenStreetMap <span className="overlay-extra">· Mapped Wi-Fi only</span></div>
    <button type="button" className="map-data-count" onClick={onShowConnections} aria-label="View Wi-Fi results">
      {wifiStatus === "ready" ? <><strong>{wifiCount} Wi-Fi places</strong><small>{freeCount} tagged free · View list ↓</small></> :
       wifiStatus === "loading" ? <><strong>Finding Wi-Fi…</strong><small>Checking OpenStreetMap records</small></> :
       wifiStatus === "error" ? <><strong>Wi-Fi feed unavailable</strong><small>See error and retry below ↓</small></> :
       wifiStatus === "offline" ? <><strong>Offline</strong><small>Open Saved for saved locations</small></> :
       <><strong>Zoom in for Wi-Fi</strong><small>See mapped places nearby</small></>}
    </button>
    {showWiFi && wifiStatus === "ready" && wifiCount > 0 && <div className="map-legend" aria-label="Wi-Fi marker legend">
      <span><i className="legend-dot free"/> Tagged free</span><span><i className="legend-dot unknown"/> Unconfirmed</span>
    </div>}
  </div>;
}
