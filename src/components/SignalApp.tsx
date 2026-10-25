"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, BookmarkPlus, Compass, Download, ExternalLink, LocateFixed, MapPin, Search, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import SignalMap from "./SignalMap";
import SavedView from "./SavedView";
import { DEFAULT_CENTRE, FETCH_RADIUS_METRES, distanceMetres, prettyDistance, sortByDistance, validCoordinates } from "@/lib/geo";
import { getCoverageState } from "@/lib/coverage";
import { listAreas, removeArea, saveArea } from "@/lib/saved-areas";
import type { LatLon, MobileNetwork, MobileTechnology, SavedArea, WiFiPlace, WiFiResult } from "@/lib/types";
type Tab = "here" | "plan" | "saved";
const NETWORKS: MobileNetwork[] = ["All", "EE", "O2", "Vodafone", "Three"];
const ACCESS: Record<WiFiPlace["access"], string> = { free: "Tagged free", unknown: "Access unconfirmed", customers: "Customers only", paid: "Paid access" };
export default function SignalApp() {
  const [tab, setTab] = useState<Tab>("here");
  const [centre, setCentre] = useState<LatLon>(DEFAULT_CENTRE);
  const [zoom, setZoom] = useState(12.5);
  const [focus, setFocus] = useState({ ...DEFAULT_CENTRE, zoom: 12.5, version: 0 });
  const [areaLabel, setAreaLabel] = useState("North-east England");
  const [postcode, setPostcode] = useState("");
  const [searching, setSearching] = useState(false);
  const [network, setNetwork] = useState<MobileNetwork>("All");
  const [technology, setTechnology] = useState<MobileTechnology>("4G");
  const [showWiFi, setShowWiFi] = useState(true);
  const [includeRestricted, setIncludeRestricted] = useState(false);
  const [result, setResult] = useState<WiFiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [areas, setAreas] = useState<SavedArea[]>([]);
  const [openSavedId, setOpenSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [geolocating, setGeolocating] = useState(false);
  const coverage = getCoverageState(network, technology);
  const refreshAreas = useCallback(async () => {
    try { setAreas(await listAreas()); } catch { setNotice("Offline storage is unavailable in this browser."); }
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
    fetch("/api/wifi?" + params, { signal: abort.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Wi-Fi look-up unavailable");
      return data as WiFiResult;
    }).then(data => { setResult(data); setSelectedId(null); })
      .catch(error => { if (!abort.signal.aborted) { setFetchError(error instanceof Error ? error.message : "Unable to load Wi-Fi spots"); setResult(null); } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [centre.lat, centre.lon, zoom, online, tab]);
  const visible = useMemo(() => sortByDistance(result?.places.filter(place => includeRestricted || place.access === "free" || place.access === "unknown") ?? [], centre), [result, includeRestricted, centre]);
  const selected = visible.find(place => place.id === selectedId) ?? visible[0];
  const focusOn = (location: LatLon, label: string, level = 13) => {
    setCentre(location); setZoom(level); setFocus(previous => ({ ...location, zoom: level, version: previous.version + 1 })); setAreaLabel(label); setSelectedId(null);
  };
  const handleViewChange = useCallback((location: LatLon, level: number) => {
    // Map zoom/panning must not update the app for tiny pixel changes.
    setCentre(old => (old.lat.toFixed(2) === location.lat.toFixed(2) && old.lon.toFixed(2) === location.lon.toFixed(2) ? old : location));
    setZoom(old => Math.floor(old) === Math.floor(level) ? old : level);
  }, []);
  const useLocation = () => {
    if (!navigator.geolocation) { setNotice("This browser doesn't support location services."); return; }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const here = { lat: position.coords.latitude, lon: position.coords.longitude };
      setGeolocating(false);
      if (!validCoordinates(here)) { setNotice("Signal currently covers the UK only."); return; }
      focusOn(here, "Near your location", 14); setTab("here");
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
    } catch (error) { setNotice(error instanceof Error ? error.message : "Postcode unavailable"); }
    finally { setSearching(false); }
  };
  const storeArea = async () => {
    if (!result || !online || zoom < 11) { setNotice("Load Wi-Fi locations before saving an area."); return; }
    setSaving(true);
    try {
      const area: SavedArea = {
        id: crypto.randomUUID(), label: areaLabel, centre, places: result.places,
        savedAt: new Date().toISOString(), radiusMetres: FETCH_RADIUS_METRES
      };
      await saveArea(area); await refreshAreas(); setNotice("Saved " + area.places.length + " Wi-Fi locations for offline use. Street map not included.");
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
    {tab === "saved" ? <SavedView areas={areas} openId={openSavedId} setOpenId={setOpenSavedId} onDelete={deleteArea} online={online}/> :
      <>
        {tab === "plan" && <form className="plan-bar" onSubmit={searchPostcode}><Search size={18}/><input aria-label="Enter a UK postcode" value={postcode} onChange={event => setPostcode(event.target.value)} placeholder="Plan ahead — enter a UK postcode" autoComplete="postal-code"/><button className="small-primary" type="submit" disabled={searching}>{searching ? "Finding…" : "Find"} <ArrowRight size={15}/></button></form>}
        <div className="explorer">
          <div className="map-column">
            <SignalMap focus={focus} places={visible} selectedId={selected?.id ?? null} showWiFi={showWiFi} onSelect={setSelectedId} onViewChange={handleViewChange}/>
            <div className="map-action"><button className="location-button" onClick={useLocation} disabled={geolocating}><LocateFixed size={18}/>{geolocating ? "Locating…" : "Use my location"}</button></div>
          </div>
          <section className="info-column">
            <div className="section-lead"><span className="eyebrow">{tab === "here" ? "EXPLORE NEARBY" : "PLAN YOUR CONNECTION"}</span><h1>{tab === "here" ? "Stay connected." : "Know before you go."}</h1><p><MapPin size={15}/>{areaLabel}</p></div>
            <div className="filter-head"><span className="eyebrow">MOBILE COVERAGE</span><span className="coming-soon">Not connected yet</span></div>
            <div className="network-pills" aria-label="Select mobile network">
              {NETWORKS.map(value => <button key={value} aria-pressed={network === value} className={"network-pill" + (network === value ? " current" : "")} onClick={() => setNetwork(value)}>{value === "All" ? "All networks" : value}</button>)}
            </div>
            <div className="data-options"><div className="tech-pills"><button className={technology === "4G" ? "chosen" : ""} aria-pressed={technology === "4G"} onClick={() => setTechnology("4G")}>4G</button><button className={technology === "5G" ? "chosen" : ""} aria-pressed={technology === "5G"} onClick={() => setTechnology("5G")}>5G</button></div><label className="wifi-toggle"><input type="checkbox" checked={showWiFi} onChange={e => setShowWiFi(e.target.checked)}/><Wifi size={16}/> Wi-Fi pins</label></div>
            <div className="coverage-note"><ShieldAlert size={17}/><p><strong>No signal prediction displayed.</strong> {coverage.network} {coverage.technology} coverage needs an authorised Ofcom feed. <a href="https://www.ofcom.org.uk/phones-and-broadband/coverage-and-speeds/ofcom-checker" target="_blank" rel="noopener noreferrer">Check at Ofcom <ExternalLink size={12}/></a></p></div>
            <div className="wifi-heading"><div><span className="eyebrow">PUBLIC WI-FI</span><h2>Connections nearby</h2></div><span className="results-count">{loading ? "Looking…" : zoom < 11 ? "Zoom in" : result ? visible.length + " found" : "—"}</span></div>
            <div className="filter-row"><label><input type="checkbox" checked={includeRestricted} onChange={event => setIncludeRestricted(event.target.checked)}/> Include customer-only & paid</label><span>OSM data · not tested</span></div>
            {zoom < 11 ? <p className="list-message">Zoom in or search a postcode to look for Wi-Fi locations within 3 km.</p> : !online ? <p className="list-message">You're offline. Your saved Wi-Fi lists are in <button className="inline-action" onClick={() => setTab("saved")}>Saved</button>.</p> :
              loading ? <div className="list-message loading-indicator">Looking for mapped Wi-Fi around this area…</div> :
              fetchError ? <p className="list-message error">{fetchError} <button className="inline-action" onClick={() => focusOn(centre, areaLabel, zoom)}>Try again</button></p> :
              visible.length === 0 ? <p className="list-message">No matching Wi-Fi locations were found in OpenStreetMap around here. That doesn't mean none exist. Try another area or include restricted hotspots.</p> :
              <div className="places-list">{visible.slice(0, 12).map(place => <button key={place.id} className={"place-row" + (selected?.id === place.id ? " selected" : "")} onClick={() => setSelectedId(place.id)}>
                <span className="wifi-icon"><Wifi size={19}/></span><span className="place-info"><strong>{place.name}</strong><small>{place.kind} · {prettyDistance(distanceMetres(centre, place))}</small></span><span className={"access-tag " + place.access}>{ACCESS[place.access]}</span>
              </button>)}{visible.length > 12 && <p className="list-message">Showing 12 nearest of {visible.length} mapped places.</p>}</div>}
            {selected && showWiFi && zoom >= 11 && online && !fetchError && <div className="place-detail"><span className="eyebrow">SELECTED CONNECTION</span><h3>{selected.name}</h3><div className="detail-access"><span className={"access-tag " + selected.access}>{ACCESS[selected.access]}</span><span>{prettyDistance(distanceMetres(centre, selected))} away</span></div><p>Opening hours: {selected.openingHours ?? "Not recorded"}. Availability and security have not been verified.</p><div className="detail-actions"><a target="_blank" rel="noopener noreferrer" href={selected.osmUrl}>View OSM record <ExternalLink size={14}/></a>{selected.website && <a target="_blank" rel="noopener noreferrer" href={selected.website}>Website <ExternalLink size={14}/></a>}</div></div>}
            <button className="save-button" onClick={storeArea} disabled={saving || !online || !result || loading || zoom < 11}><BookmarkPlus size={19}/>{saving ? "Saving…" : "Save Wi-Fi list for offline use"}</button>
            <p className="save-explainer">Saves Wi-Fi place information on this device. Does not download map tiles or mobile coverage.</p>
          </section>
        </div>
      </>}
    <footer className="footer"><span>Signal · Alpha 1</span><span>Map and Wi-Fi © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Improve OSM data</a></span></footer>
  </div>;
}
