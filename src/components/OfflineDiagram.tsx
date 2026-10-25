import type { SavedArea } from "@/lib/types";
import { distanceMetres } from "@/lib/geo";
export default function OfflineDiagram({ area }: { area: SavedArea }) {
  // Coordinate plot, intentionally NOT represented as a street map.
  const radius = area.radiusMetres;
  const points = area.places.filter(place => distanceMetres(area.centre, place) <= radius).slice(0, 60);
  const xy = (lat: number, lon: number) => ({
    x: Math.max(12, Math.min(288, 150 + (lon - area.centre.lon) * 111320 * Math.cos(area.centre.lat * Math.PI / 180) * 140 / radius)),
    y: Math.max(12, Math.min(288, 150 - (lat - area.centre.lat) * 111320 * 140 / radius))
  });
  return <div className="offline-diagram">
    <div className="diagram-top"><strong>Offline hotspot locator</strong><span>North ↑</span></div>
    <svg viewBox="0 0 300 300" role="img" aria-label="Schematic positions of saved Wi-Fi spots relative to the centre, without streets">
      <rect width="300" height="300" rx="20" fill="#eaf3f2" />
      <path d="M0 75H300M0 150H300M0 225H300M75 0V300M150 0V300M225 0V300" stroke="#d2e2df" strokeWidth="1" />
      <circle cx="150" cy="150" r="140" fill="none" stroke="#b0ceca" strokeDasharray="5 6"/>
      <circle cx="150" cy="150" r="6" fill="#173d4b" stroke="white" strokeWidth="2"/>
      {points.map((place, index) => {
        const p = xy(place.lat, place.lon);
        return <g key={place.id}><circle cx={p.x} cy={p.y} r="10" fill={place.access === "free" ? "#138b74" : "#3276c5"} stroke="white" strokeWidth="2"/><text x={p.x} y={p.y + 3.5} fill="#fff" textAnchor="middle" fontSize="9" fontWeight="700">{index + 1}</text></g>;
      })}
    </svg>
    <p className="diagram-note">Positions only, not a street map. Approximate area radius {Math.round(radius / 1000)} km. Numbered locations match the list.</p>
  </div>;
}
