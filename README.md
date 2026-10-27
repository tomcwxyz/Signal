# Signal

**Find a connection, wherever you are.**

Signal is an open, mobile-first UK connectivity map. Its first alpha focuses on real public Wi-Fi records, postcode-based planning and genuinely usable saved Wi-Fi lists when offline. No account is required.

## Alpha 1

**Map renderer:** Leaflet with OSM raster tiles, requiring no WebGL. Tile failures/timeouts produce a visible retry and OSM fallback link rather than a blank panel. This was changed after a mobile WebView rendered a blank MapLibre canvas.

- **Here:** Explore the map, find public Wi-Fi locations from OpenStreetMap, inspect access conditions and share a link to a selected area.
- **Plan:** Search a UK postcode, move the map, filter by Wi-Fi access and save a named snapshot of nearby Wi-Fi locations.
- **Saved:** Read saved Wi-Fi locations and their coordinates without an internet connection, including an offline schematic locator (not a street map). Reopen a saved area in the live map when online.
- **Coverage:** The interface includes 4G/5G and operator choices, but **does not show or invent coverage predictions until an authorised Ofcom source is connected**.

Data is incomplete and user-contributed; Signal queries both `internet_access=wlan` and `wifi=yes/free` tags within a 5 km radius, and uses a backup public Overpass endpoint if the primary fails. *Unknown* does not mean free, and *mapped* does not mean recently tested. Wi-Fi records are sourced from OSM through an Overpass API query. Signal does not claim Wi-Fi is working or that it's suitable to use securely.

## Develop

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Visit http://localhost:3000. Run `npm run typecheck`, `npm test` and `npm run build` before releasing.

Deploy on Vercel with the normal Next.js framework preset. No credentials are needed for this alpha. The Overpass responses are cached for 15 minutes and map movement requests are debounced. Overpass and postcodes.io are external dependencies; public endpoint use should be replaced with an appropriate hosted/cache-backed source as traffic grows.

## Data and offline limitations

- The live base map uses OpenStreetMap's standard interactive **online** raster tiles. Signal never prefetches those tiles for offline use. OSM's [tile policy](https://operations.osmfoundation.org/policies/tiles/) prohibits such downloads.
- Saving an area stores its currently fetched Wi-Fi place list locally in IndexedDB. It does **not** download street maps or predicted mobile coverage. Saved records have a timestamp and may become stale.
- Offline area diagrams show relative hotspot positions, not streets, road access or directions. The service worker precaches the initial application shell and locally served Next.js assets; it does not cache external tiles. GPS may work offline on some devices but is not guaranteed.
- Ofcom's replacement mobile coverage APIs require developer access. Integration is deliberately deferred until response schemas, terms and credentials are verified.
- Location is requested only when the user taps "Use my location"; Signal does not store location on a server.

## Planned next steps

1. Get a hosted mobile preview working and test accessibility/performance.
2. Add licensed offline vector map packs (PMTiles or equivalent); never bulk-download OSM community tile servers.
3. Implement Ofcom's replacement mobile data API and accurately labelled, postcode-level predicted coverage.
4. Improve source completeness and reliability through imports and (later) moderated community contributions.

## Attribution

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Wi-Fi features retain their original OSM references. This repository currently has no software licence attached; permission to reuse code is not implied by the repository being public.

## Offline data safety

Offline saves live in this device's browser storage. Signal asks the browser to keep the storage persistent where supported; the browser can still clear data, and users should not assume saved spots are permanent. The Saved screen flags snapshots older than 30 days for review. No Wi-Fi logins, credentials or exact location histories are collected.

## Wi-Fi provenance

The map queries publicly tagged Wi-Fi features via OpenStreetMap Overpass, using both `internet_access=wlan` and `wifi=yes/free` conventions. Each pin links to the original OSM object. Green pins explicitly have free-access tags, blue pins have unconfirmed access conditions; paid/customer-only venues are opt-in. The displayed date is when Signal fetched the record, not the last time a person tested it.

Public Overpass sources are best-effort. Request errors are not represented as zero Wi-Fi hotspots; a retry is offered. Before scaling usage we need a cached UK feed.

**October 2026 verification:** The Britain-and-Ireland Overpass instance at `overpass.atownsend.org.uk` is used first. A live data test returned three OSM Wi-Fi records within 5 km of Newton Aycliffe and 104 within 5 km of Newcastle centre. Those counts are snapshots of mapped tags, not measured connectivity, and will change as contributors edit OSM. The other global endpoints are fallbacks only.
