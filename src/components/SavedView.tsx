"use client";
import { Download, MapPin, Trash2, WifiOff } from "lucide-react";
import type { SavedArea } from "@/lib/types";
import { distanceMetres, prettyDistance, sortByDistance } from "@/lib/geo";
import OfflineDiagram from "./OfflineDiagram";
type Props = {
  areas: SavedArea[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onDelete: (id: string) => Promise<void>;
  online: boolean;
};
export default function SavedView({ areas, openId, setOpenId, onDelete, online }: Props) {
  const open = areas.find(area => area.id === openId);
  return <section className="saved-view" aria-label="Saved areas">
    <div className="saved-heading"><span className="eyebrow">YOUR OFFLINE POCKET</span><h1>Saved areas</h1>
      <p>Keep useful Wi-Fi locations and coordinates for when the signal disappears.</p>
    </div>
    <div className="truth-note"><WifiOff size={19}/><p><strong>What works offline:</strong> this place list, opening details and a simple hotspot locator. Street maps and fresh coverage data are not included.</p></div>
    {areas.length === 0 ? <div className="saved-empty"><Download size={34}/><h2>Nothing saved yet</h2><p>Go to Here or Plan, explore a place, then choose <strong>Save Wi-Fi list</strong>.</p></div> :
      <div className="saved-layout"><div className="saved-cards">{areas.map(area => <article key={area.id} className={"area-card" + (open?.id === area.id ? " active" : "")}>
        <button className="area-open" onClick={() => setOpenId(open?.id === area.id ? null : area.id)}>
          <MapPin size={20}/><span><strong>{area.label}</strong><small>{area.places.length} Wi-Fi places · Saved {new Date(area.savedAt).toLocaleDateString("en-GB")}</small></span>
        </button>
        <button className="icon-button delete-area" onClick={() => onDelete(area.id)} aria-label={"Remove " + area.label}><Trash2 size={17}/></button>
      </article>)}</div>
      {open && <div className="saved-detail"><OfflineDiagram area={open}/>
        <h2>Places in {open.label}</h2>
        <p className="muted text-small">Saved {new Date(open.savedAt).toLocaleString("en-GB")} · {online ? "You're online, but this is your saved snapshot." : "Currently offline"}</p>
        {open.places.length === 0 ? <p>No Wi-Fi locations were in this saved snapshot.</p> :
        <ol className="saved-places">{sortByDistance(open.places, open.centre).slice(0, 60).map(place => <li key={place.id}>
          <div><strong>{place.name}</strong><small>{place.access === "free" ? "Tagged free" : place.access === "unknown" ? "Cost unconfirmed" : place.access === "customers" ? "Customers only" : "Paid"} · {prettyDistance(distanceMetres(open.centre, place))} from centre</small><small>{place.lat.toFixed(5)}, {place.lon.toFixed(5)}</small></div>
          <a href={place.osmUrl} target="_blank" rel="noopener noreferrer" aria-label={"Open " + place.name + " on OpenStreetMap (requires connection)"}>OSM ↗</a>
        </li>)}</ol>}
      </div>}</div>}
  </section>;
}
