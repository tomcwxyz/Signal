"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BookmarkPlus, Compass, Download, ExternalLink, LocateFixed, MapPin, Search, Share2, Wifi, WifiOff } from "lucide-react";
import SignalMap from "./SignalMap";
import SavedView from "./SavedView";
import { DEFAULT_CENTRE, FETCH_RADIUS_METRES, distanceMetres, prettyDistance, snapshotCovers, sortByDistance, validCoordinates } from "@/lib/geo";
import CoveragePanel from "./CoveragePanel";
import LocalCoveragePanel from "./LocalCoveragePanel";
import type { LocalCoverageResult } from "@/lib/local-coverage";
import type { CoverageView } from "@/lib/coverage-visual";
import { parseSharedMap, sharedMapPath } from "@/lib/shared-map";
import { listAreas, removeArea, saveArea } from "@/lib/saved-areas";
import type { LatLon, SavedArea, WiFiPlace, WiFiResult } from "@/lib/types";
type Tab = "here" | "plan" | "saved";
const ACCESS: Record<WiFiPlace["access"], string> = { free: "Tagged free", unknown: "Access unconfirmed", customers: "Customers only", paid: "Paid access" };
export default function SignalApp() {
  const [tab, setTab] = useState<Tab>("here");
  const [centre, setCentre] = useState<LatLon>(DEFAULT_CENTRE);
  const [zoom, setZoom] = useState(12.5);
  const [focus, setFocus] = useState({ ...DEFAULT_CENTRE, zoom: 12.5, version: 0 });
  const [areaLabel, setAreaLabel] = useState("North-east England");
  const [postcode, setPostcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [coveragePostcode, setCoveragePostcode] = useState("");
  const [localCoverage, setLocalCoverage] = useState<LocalCoverageResult | null>(null);
  const [localOperator, setLocalOperator] = useState<CoverageView>("All");
  const [localEnabled, setLocalEnabled] = useState(false);
  const [showHeat, setShowHeat] = useState(true);
  const localRequest = useRef<AbortController | null>(null);
  const lastLocalRequestAt = useRef(0);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [selectedLocalPostcode, setSelectedLocalPostcode] = useState<string | null>(null);
  const [showWiFi, setShowWiFi] = useState(true);
  const [includeRestricted, setIncludeRestricted] = useState(false);
  const [result, setResult] = useState<WiFiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [areas, setAreas] = useState<SavedArea[]>([]);
  const [openSavedId, setOpenSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [geolocating, setGeolocating] = useState(false);
  const refreshAreas = useCallback(async () => {
    try { setAreas(await listAreas()); } catch { setNotice("Offline storage is unavailable in this browser."); }
  }, []);
  useEffect(() => {
    const shared = parseSharedMap(new URLSearchParams(window.location.search));
    if (shared) {
      setCentre(shared.centre);
      setZoom(shared.zoom);
      setFocus(previous => ({ ...shared.centre, zoom: shared.zoom, version: previous.version + 1 }));
      setAreaLabel("Shared map area");
      setTab("plan");
    }
  }, []);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    void refreshAreas();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* no offline shell on unsupported browsers */ });
    }
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, [refreshAreas]);
  useEffect(() => {
    if (tab === "saved" || zoom < 11 || !online) {
      setLoading(false);
      if (!online) setFetchError("You're offline. Open Saved for downloaded Wi-Fi details.");
      return;
    }
    const abort = new AbortController();
    setLoading(true); setFetchError("");
    const params = new URLSearchParams({ lat: centre.lat.toFixed(2), lon: centre.lon.toFixed(2) });
    // Debounce map movement so panning does not overload shared OpenStreetMap servers.
    const timeout = setTimeout(() => fetch("/api/wifi?" + params, { signal: abort.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Wi-Fi look-up unavailable");
      return data as WiFiResult;
    }).then(data => { setResult(data); setSelectedId(null); })
      .catch(error => { if (!abort.signal.aborted) { setFetchError(error instanceof Error ? error.message : "Unable to load Wi-Fi spots"); setResult(null); } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); }), 650);
    return () => { clearTimeout(timeout); abort.abort(); };
  }, [centre.lat, centre.lon, zoom, online, tab, refreshToken]);
  const localDistance = localCoverage ? distanceMetres(centre, localCoverage.centre) : Infinity;
  const localIsCurrent = localDistance < 380;
  // Retain nearby sampled markers while the next local area is loading.
  const visibleLocal = localEnabled && localDistance < 1250 ? localCoverage?.samples ?? [] : [];
  const requestLocalCoverage = useCallback(async (target: LatLon) => {
    if (!online) { setLocalError("Local estimates need an internet connection."); return; }
    localRequest.current?.abort();
    const controller = new AbortController();
    localRequest.current = controller;
    lastLocalRequestAt.current = Date.now();
    setLocalLoading(true);
    setLocalError("");
    setSelectedLocalPostcode(null);
    try {
      const params = new URLSearchParams({ lat: target.lat.toFixed(5), lon: target.lon.toFixed(5) });
      const response = await fetch("/api/local-coverage?" + params, {
        cache: "no-store", signal: controller.signal
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload ?
        String(payload.error) : "Unable to check this local area.");
      if (!payload || typeof payload !== "object" || !("samples" in payload) ||
          !Array.isArray(payload.samples)) throw new Error("Local coverage returned an invalid response.");
      if (!controller.signal.aborted) setLocalCoverage(payload as LocalCoverageResult);
    } catch (error) {
      if (!controller.signal.aborted) setLocalError(error instanceof Error ? error.message : "Local predictions unavailable.");
    } finally {
      if (localRequest.current === controller) {
        localRequest.current = null;
        setLocalLoading(false);
      }
    }
  }, [online]);
  const enableLocalCoverage = (target: LatLon = centre) => {
    setLocalEnabled(true);
    // Switching back on, using GPS, or searching must not circumvent the
    // same request budget used for pan-triggered queries.
    if (Date.now() - lastLocalRequestAt.current >= 21500) {
      void requestLocalCoverage(target);
    }
    // Otherwise the map-follow effect schedules the new centre automatically.
  };
  const toggleLocalCoverage = () => {
    if (localEnabled) {
      localRequest.current?.abort();
      localRequest.current = null;
      setLocalEnabled(false);
      setLocalLoading(false);
      setLocalCoverage(null);
      setLocalError("");
    } else enableLocalCoverage();
  };
  // Following the map is opt-in. Debounce panning, and enforce a 21.5-second
  // minimum interval to stay below the route's 3-check/minute protection.
  useEffect(() => {
    if (!localEnabled || tab === "saved" || !online || zoom < 11) return;
    if (localCoverage && distanceMetres(centre, localCoverage.centre) < 380) return;
    const elapsed = Date.now() - lastLocalRequestAt.current;
    const delay = Math.max(1350, 21500 - elapsed);
    const timer = setTimeout(() => void requestLocalCoverage(centre), delay);
    return () => clearTimeout(timer);
  }, [localEnabled, tab, online, zoom, centre.lat, centre.lon, localCoverage, requestLocalCoverage]);
  useEffect(() => () => { localRequest.current?.abort(); }, []);
  const refreshSeconds = Math.max(0, Math.ceil((lastLocalRequestAt.current + 21500 - Date.now()) / 1000));
  const openLocalPostcode = (postcode: string) => {
    setSelectedLocalPostcode(postcode);
    setCoveragePostcode(postcode);
    setTab("plan");
    requestAnimationFrame(() => document.getElementById("coverage-title")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const resultIsLocal = Boolean(result && snapshotCovers(centre, result.centre));
  const visible = useMemo(() => sortByDistance(
    result && snapshotCovers(centre, result.centre) ?
      result.places.filter(place => (includeRestricted || place.access === "free" || place.access === "unknown") && (!freeOnly || place.access === "free")) : [], centre
  ), [result, includeRestricted, freeOnly, centre]);
  const freeCount = visible.filter(place => place.access === "free").length;
  const dataStatus = !online ? "offline" : zoom < 11 ? "zoom" : loading ? "loading" : fetchError ? "error" : resultIsLocal ? "ready" : "loading";
  const selected = visible.find(place => place.id === selectedId) ?? visible[0];
  const focusOn = (location: LatLon, label: string, level = 13) => {
    setCentre(location); setZoom(level); setFocus(previous => ({ ...location, zoom: level, version: previous.version + 1 })); setAreaLabel(label); setSelectedId(null);
  };
  const handleViewChange = useCallback((location: LatLon, level: number) => {
    // Map zoom/panning must not update the app for tiny pixel changes.
    setCentre(old => distanceMetres(old, location) < 130 ? old : location);
    setZoom(old => Math.floor(old) === Math.floor(level) ? old : level);
    if (distanceMetres(location, focus) > 1300) setAreaLabel("Map near " + location.lat.toFixed(3) + ", " + location.lon.toFixed(3));
  }, [focus]);
  const retryWiFi = () => { setFetchError(""); setRefreshToken(token => token + 1); };
  const shareLocation = async () => {
    const url = window.location.origin + sharedMapPath(centre, zoom);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Signal map", text: "Find connectivity in this area", url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setNotice("Map link copied. It opens this location in Signal.");
      } else {
        setNotice("Sharing is unavailable in this browser.");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") setNotice("Couldn't share the map link.");
    }
  };
  const useLocation = () => {
    if (!navigator.geolocation) { setNotice("This browser doesn't support location services."); return; }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const here = { lat: position.coords.latitude, lon: position.coords.longitude };
      setGeolocating(false);
      if (!validCoordinates(here)) { setNotice("Signal currently covers the UK only."); return; }
      focusOn(here, "Near your location", 14); setTab("here");
      enableLocalCoverage(here);
      // Look up the nearest postcode so a GPS request can show property-level Ofcom coverage.
      void fetch("/api/nearest-postcode?lat=" + encodeURIComponent(String(here.lat)) + "&lon=" + encodeURIComponent(String(here.lon)))
        .then(response => response.ok ? response.json() : null)
        .then(data => { if (data?.postcode) setCoveragePostcode(data.postcode); })
        .catch(() => { /* The coverage panel still has manual postcode search. */ });
    }, () => { setGeolocating(false); setNotice("Location wasn't available. You can move the map or search a postcode."); }, { enableHighAccuracy: false, timeout: 10000 });
  };
  const searchPostcode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!online) { setNotice("Postcode search requires a connection. Your saved areas are still available."); return; }
    setSearching(true); setNotice("");
    try {
      const response = await fetch("/api/postcode?q=" + encodeURIComponent(postcode));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Postcode unavailable");
      focusOn({ lat: data.lat, lon: data.lon }, data.label, 14);
      setCoveragePostcode(postcode.trim().toUpperCase());
      enableLocalCoverage({ lat: data.lat, lon: data.lon });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Postcode unavailable"); }
    finally { setSearching(false); }
  };
  const storeArea = async () => {
    if (!result || !resultIsLocal || loading || !online || zoom < 11) { setNotice("Load Wi-Fi locations for this map area before saving."); return; }
    setSaving(true);
    try {
      const area: SavedArea = {
        id: crypto.randomUUID(), label: areaLabel.trim() || "Saved map area", centre, places: result.places,
        savedAt: new Date().toISOString(), radiusMetres: FETCH_RADIUS_METRES
      };
      await saveArea(area);
      if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
      await refreshAreas(); setNotice("Saved " + area.places.length + " Wi-Fi locations for offline use. Street map not included.");
    } catch { setNotice("Couldn't save this area. Check your browser's storage settings."); }
    finally { setSaving(false); }
  };
  const deleteArea = async (id: string) => {
    try { await removeArea(id); if (openSavedId === id) setOpenSavedId(null); await refreshAreas(); }
    catch { setNotice("Couldn't remove this saved area."); }
  };
  return <div className="app-frame">
    <header className="site-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span><div><strong>signal<span className="brand-point">.</span></strong><small>Find a connection, wherever you are</small></div></div>
      <div className={"connection-status" + (!online ? " is-offline" : "")}>{online ? <Wifi size={15}/> : <WifiOff size={15}/>}<span>{online ? "Online" : "Offline"}</span></div>
    </header>
    <nav className="tabs" aria-label="Main sections">
      {([{ id: "here", label: "Here", icon: <LocateFixed size={17}/> }, { id: "plan", label: "Plan", icon: <Compass size={17}/> }, { id: "saved", label: "Saved", icon: <Download size={17}/> }] as const).map(item =>
        <button key={item.id} className={"tab" + (tab === item.id ? " active" : "")} onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined}>
          {item.icon}{item.label}{item.id === "saved" && areas.length > 0 && <span className="saved-count">{areas.length}</span>}
        </button>
      )}
    </nav>
    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
    {tab === "saved" ? <SavedView areas={areas} openId={openSavedId} setOpenId={setOpenSavedId} onDelete={deleteArea} online={online} onOpenMap={area => { focusOn(area.centre, area.label, 14); setTab("here"); }}/> :
      <>
        {tab === "plan" && <form className="plan-bar" onSubmit={searchPostcode}><Search size={18}/><input aria-label="Enter a UK postcode" value={postcode} onChange={event => setPostcode(event.target.value)} placeholder="Plan ahead — enter a UK postcode" autoComplete="postal-code"/><button className="small-primary" type="submit" disabled={searching}>{searching ? "Finding…" : "Find"} <ArrowRight size={15}/></button></form>}
        <div className="explorer">
          <div className="map-column">
            <SignalMap focus={focus} places={visible} selectedId={selected?.id ?? null} showWiFi={showWiFi} onSelect={setSelectedId} onViewChange={handleViewChange} wifiStatus={dataStatus} wifiCount={visible.length} freeCount={freeCount} onShowConnections={() => document.getElementById("wifi-results")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              coverageSamples={visibleLocal} coverageOperator={localOperator} showHeat={localEnabled && showHeat}
              selectedCoveragePostcode={selectedLocalPostcode} onSelectCoverage={openLocalPostcode}/>
            <div className="map-action"><button className="location-button" type="button" onClick={toggleLocalCoverage} disabled={!online} title="Toggle local estimated coverage shading">{localLoading ? "Checking coverage…" : localEnabled ? "Hide coverage" : "Show coverage"}</button><button className="location-button" onClick={shareLocation} title="Share this map location"><Share2 size={17}/>Share area</button><button className="location-button" onClick={useLocation} disabled={geolocating}><LocateFixed size={18}/>{geolocating ? "Locating…" : "Use my location"}</button></div>
          </div>
          <section className="info-column">
            <div className="section-lead"><span className="eyebrow">{tab === "here" ? "EXPLORE NEARBY" : "PLAN YOUR CONNECTION"}</span><h1>{tab === "here" ? "Stay connected." : "Know before you go."}</h1><p><MapPin size={15}/>{areaLabel}</p></div>
            <LocalCoveragePanel centreMoved={Boolean(localCoverage && !localIsCurrent)}
              samples={visibleLocal} loading={localLoading} error={localError}
              operator={localOperator} onOperatorChange={setLocalOperator}
              enabled={localEnabled} onToggle={toggleLocalCoverage}
              showHeat={showHeat} onHeatChange={setShowHeat} refreshingInSeconds={refreshSeconds}
              onSample={() => void requestLocalCoverage(centre)} onInspect={openLocalPostcode}
              disabled={!online} failedLookups={localEnabled ? localCoverage?.failedLookups ?? 0 : 0}/>
            <CoveragePanel suggestedPostcode={coveragePostcode}/>
            <div className="data-options"><label className="wifi-toggle"><input type="checkbox" checked={showWiFi} onChange={e => setShowWiFi(e.target.checked)}/><Wifi size={16}/> Show public Wi-Fi pins</label></div>
            <div className="wifi-heading" id="wifi-results"><div><span className="eyebrow">MAPPED WI-FI · WITHIN 5 KM</span><h2>Connections nearby</h2></div><span className="results-count">{loading ? "Looking…" : zoom < 11 ? "Zoom in" : resultIsLocal ? visible.length + " found" : "—"}</span></div>
            <p className="source-explainer">Locations are sourced from OpenStreetMap, not live device scans. Free means tagged free by contributors; availability is not verified.</p><div className="filter-row"><div className="wifi-filters"><label><input type="checkbox" checked={freeOnly} onChange={event => setFreeOnly(event.target.checked)}/> Only tagged free</label><label><input type="checkbox" checked={includeRestricted} onChange={event => setIncludeRestricted(event.target.checked)}/> Include restricted</label></div><span>{resultIsLocal && result ? "OSM data · " + new Date(result.fetchedAt).toLocaleDateString("en-GB") : "OSM · unverified"}</span></div>
            {zoom < 11 ? <p className="list-message">Zoom in or search a postcode to look for Wi-Fi locations within 5 km.</p> : !online ? <p className="list-message">You're offline. Your saved Wi-Fi lists are in <button className="inline-action" onClick={() => setTab("saved")}>Saved</button>.</p> :
              loading ? <div className="list-message loading-indicator">Looking for mapped Wi-Fi around this area…</div> :
              fetchError ? <p className="list-message error">{fetchError} <button className="inline-action" onClick={retryWiFi}>Try again</button></p> :
              !resultIsLocal ? <p className="list-message">Search this area to see available Wi-Fi records.</p> : visible.length === 0 ? <p className="list-message">No matching Wi-Fi locations were found in OpenStreetMap around here. That doesn't mean none exist. Try a different location or include restricted hotspots.</p> :
              <div className="places-list">{visible.slice(0, 12).map(place => <button key={place.id} className={"place-row" + (selected?.id === place.id ? " selected" : "")} onClick={() => setSelectedId(place.id)}>
                <span className="wifi-icon"><Wifi size={19}/></span><span className="place-info"><strong>{place.name}</strong><small>{place.kind} · {prettyDistance(distanceMetres(centre, place))}</small></span><span className={"access-tag " + place.access}>{ACCESS[place.access]}</span>
              </button>)}{visible.length > 12 && <p className="list-message">Showing 12 nearest of {visible.length} mapped places.</p>}</div>}
            {selected && showWiFi && zoom >= 11 && online && !fetchError && <div className="place-detail"><span className="eyebrow">SELECTED CONNECTION</span><h3>{selected.name}</h3><div className="detail-access"><span className={"access-tag " + selected.access}>{ACCESS[selected.access]}</span><span>{prettyDistance(distanceMetres(centre, selected))} away</span></div><p>Opening hours: {selected.openingHours ?? "Not recorded"}. Availability and security have not been verified.</p><div className="detail-actions"><a target="_blank" rel="noopener noreferrer" href={selected.osmUrl}>View OSM record <ExternalLink size={14}/></a>{selected.website && <a target="_blank" rel="noopener noreferrer" href={selected.website}>Website <ExternalLink size={14}/></a>}</div></div>}
            <label className="save-area-label" htmlFor="saved-area-name">Name this saved area</label><input id="saved-area-name" className="save-name-input" maxLength={80} value={areaLabel} onChange={event => setAreaLabel(event.target.value)}/>
            <button className="save-button" onClick={storeArea} disabled={saving || !online || !resultIsLocal || loading || zoom < 11}><BookmarkPlus size={19}/>{saving ? "Saving…" : "Save Wi-Fi list for offline use"}</button>
            <p className="save-explainer">Stored in this browser. Clearing site data removes saved places. No street tiles or mobile coverage are downloaded.</p>
          </section>
        </div>
      </>}
    <footer className="footer"><span>Signal · Alpha 1</span><span>Map and Wi-Fi © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Improve OSM data</a></span></footer>
  </div>;
}
