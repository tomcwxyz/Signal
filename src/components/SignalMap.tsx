"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { googleMapsDirectionsUrl } from "@/lib/directions";
import type * as Leaflet from "leaflet";
import type { LatLon, WiFiPlace } from "@/lib/types";
import type { LocalCoverageSample } from "@/lib/local-coverage";
import type { CoverageView } from "@/lib/coverage-visual";
import { sampleVisual } from "@/lib/coverage-visual";
import CoverageHeatLayer from "./CoverageHeatLayer";

type Focus = LatLon & { zoom: number; version: number };
type Props = {
  focus: Focus;
  places: WiFiPlace[];
  selectedId: string | null;
  showWiFi: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelect: (id: string) => void;
  onViewChange: (centre: LatLon, zoom: number) => void;
  wifiStatus: "ready" | "loading" | "error" | "offline" | "zoom";
  wifiCount: number;
  freeCount: number;
  onShowConnections: () => void;
  coverageSamples: LocalCoverageSample[];
  coverageOperator: CoverageView;
  showHeat: boolean;
  selectedCoveragePostcode: string | null;
  onSelectCoverage: (postcode: string) => void;
};

const BASEMAP_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
const MARKER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 9a15 15 0 0 1 18 0M6.5 12.5a10 10 0 0 1 11 0M10 16a4 4 0 0 1 4 0"/><circle cx="12" cy="19.5" r="1.4" fill="currentColor" stroke="none"/></svg>';

/** A deliberately lightweight raster map. No MapLibre/WebGL dependency. */
export default function SignalMap({ focus, places, selectedId, showWiFi, expanded, onToggleExpanded, onSelect, onViewChange, wifiStatus, wifiCount, freeCount, onShowConnections, coverageSamples, coverageOperator, showHeat, selectedCoveragePostcode, onSelectCoverage }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Leaflet.LayerGroup | null>(null);
  const wifiMarkerElements = useRef<Map<string, Leaflet.Marker>>(new Map());
  const coverageMarkersRef = useRef<Leaflet.LayerGroup | null>(null);
  const selectCoverageRef = useRef(onSelectCoverage);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const viewChanged = useRef(onViewChange);
  const selected = useRef(onSelect);
  const lastFocus = useRef(focus);
  const [attempt, setAttempt] = useState(0);
  const [renderVersion, setRenderVersion] = useState(0);
  const [tileStatus, setTileStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => { viewChanged.current = onViewChange; }, [onViewChange]);
  useEffect(() => { selected.current = onSelect; }, [onSelect]);
  useEffect(() => { selectCoverageRef.current = onSelectCoverage; }, [onSelectCoverage]);
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
      coverageMarkersRef.current = leaflet.layerGroup().addTo(instance);
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
      wifiMarkerElements.current.clear();
      coverageMarkersRef.current = null;
      const oldMap = mapRef.current;
      mapRef.current = null;
      if (oldMap) oldMap.remove();
      leafletRef.current = null;
    };
  }, [attempt]);

  // Expanding changes the map dimensions without replacing the Leaflet instance.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    const later = setTimeout(() => map.invalidateSize({ pan: false }), 200);
    return () => { cancelAnimationFrame(frame); clearTimeout(later); };
  }, [expanded, renderVersion]);

  useEffect(() => {
    if (mapRef.current && focus.version > 0) {
      mapRef.current.setView([focus.lat, focus.lon], focus.zoom, { animate: true });
    }
  }, [focus]);

  // Keep markers mounted while selecting one: rebuilding would close its popup.
  useEffect(() => {
    const leaflet = leafletRef.current;
    const markers = markersRef.current;
    if (!leaflet || !markers) return;
    markers.clearLayers();
    wifiMarkerElements.current.clear();
    if (!showWiFi) return;
    for (const place of places.slice(0, 300)) {
      const classes = [
        "signal-leaflet-marker",
        place.access === "free" ? "free" : "",
        place.access === "customers" || place.access === "paid" ? "restricted" : ""
      ].filter(Boolean).join(" ");
      const icon = leaflet.divIcon({
        className: classes,
        html: '<span class="signal-marker-inner">' + MARKER_SVG + '</span>',
        iconSize: [37, 37], iconAnchor: [18, 37]
      });
      const marker = leaflet.marker([place.lat, place.lon], {
        icon, title: place.name, keyboard: true, alt: place.name
      });
      // OSM text is inserted safely; no untrusted HTML is interpolated.
      const popup = document.createElement("div");
      popup.className = "signal-wifi-popup";
      const name = document.createElement("strong");
      name.textContent = place.name;
      const detail = document.createElement("small");
      detail.textContent = place.kind + " · " +
        (place.access === "free" ? "Tagged free" : place.access === "unknown" ? "Access unconfirmed" :
          place.access === "customers" ? "Customers only" : "Paid access");
      const link = document.createElement("a");
      link.textContent = "Walking directions in Google Maps ↗";
      link.href = googleMapsDirectionsUrl(place, "walking");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      popup.append(name, detail, link);
      marker.bindPopup(popup, { maxWidth: 260, minWidth: 195, autoPan: true, closeButton: true });
      marker.on("click", () => selected.current(place.id));
      marker.addTo(markers);
      wifiMarkerElements.current.set(place.id, marker);
    }
  }, [places, showWiFi, renderVersion]);

  useEffect(() => {
    for (const [id, marker] of wifiMarkerElements.current) {
      marker.getElement()?.classList.toggle("selected", id === selectedId);
    }
  }, [selectedId, places, showWiFi, renderVersion]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const group = coverageMarkersRef.current;
    if (!leaflet || !group) return;
    group.clearLayers();
    for (const point of coverageSamples) {
      const visual = sampleVisual(point, coverageOperator);
      const value = visual.level;
      const label = visual.label;
      const chosen = selectedCoveragePostcode === point.postcode;
      // All dynamic map markup is an integer, ?, or a static symbol.
      const icon = leaflet.divIcon({
        className: "signal-coverage-marker" + (chosen ? " selected" : ""),
        html: '<span class="coverage-map-score score-' + (value === null ? "missing" : value) +
          (value === null ? ' is-varied' : '') + '">' + label + "</span>",
        iconSize: [40, 40], iconAnchor: [20, 20]
      });
      leaflet.marker([point.centre.lat, point.centre.lon], {
        icon, title: point.postcode + " · " + visual.details + " · postcode centre",
        keyboard: true, alt: point.postcode + " " + visual.details
      }).on("click", () => selectCoverageRef.current(point.postcode)).addTo(group);
    }
  }, [coverageSamples, coverageOperator, selectedCoveragePostcode, renderVersion]);

  const osmLink = "https://www.openstreetmap.org/#map/" + Math.round(focus.zoom) + "/" + focus.lat.toFixed(5) + "/" + focus.lon.toFixed(5);
  return <div className="map-panel">
    <div ref={container} className="map-canvas" aria-label="Interactive map of mobile coverage estimates and Wi-Fi locations" role="region" />
    <button type="button" className="map-expand-toggle" aria-pressed={expanded}
      aria-label={expanded ? "Close expanded map" : "Expand map to fill the screen"}
      title={expanded ? "Close map" : "Expand map"} onClick={onToggleExpanded}>
      {expanded ? <Minimize2 size={18} aria-hidden="true"/> : <Maximize2 size={18} aria-hidden="true"/>}
      <span>{expanded ? "Close map" : "Expand map"}</span>
    </button>
    <CoverageHeatLayer map={mapRef.current} leaflet={leafletRef.current} samples={coverageSamples}
      view={coverageOperator} visible={showHeat && renderVersion > 0}/>
    {tileStatus === "loading" && <div className="map-loading" role="status">Loading street map…</div>}
    {tileStatus === "failed" && <div className="map-error" role="alert">
      <strong>The street map couldn't load</strong>
      <p>Your browser or connection couldn't load map tiles. You can still browse Wi-Fi locations below.</p>
      <div className="map-error-actions">
        <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry map</button>
        <a target="_blank" rel="noopener noreferrer" href={osmLink}>Open in OpenStreetMap ↗</a>
      </div>
    </div>}
    <div className="map-overlay"><span className="live-dot" /> OpenStreetMap
      <span className="overlay-extra">{coverageSamples.length ? " · Ofcom postcode samples" : " · Wi-Fi"}</span>
    </div>
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
