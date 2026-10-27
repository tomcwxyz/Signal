import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyWiFiAccess, hasWiFiEvidence, normaliseWiFi } from "../src/lib/wifi";
import { normaliseOverpassResults, overpassQuery, WIFI_SEARCH_RADIUS_METRES } from "../src/lib/wifi-query";

const centre = { lat: 54.62, lon: -1.58 };
test("queries both accepted Wi-Fi mapping conventions and includes ways", () => {
  const query = overpassQuery(centre);
  assert.match(query, /internet_access/);
  assert.match(query, /\["wifi"/);
  assert.match(query, /nwr\(around:5000,54.62,-1.58\)/);
  assert.match(query, /out center tags qt/);
});
test("wifi=yes and wifi=free are recognised; private or wifi=no are excluded", () => {
  assert.equal(hasWiFiEvidence({ wifi: "yes" }), true);
  assert.equal(hasWiFiEvidence({ wifi: "free" }), true);
  assert.equal(hasWiFiEvidence({ internet_access: "wlan;terminal" }), true);
  assert.equal(hasWiFiEvidence({ wifi: "no", internet_access: "wlan" }), false);
  assert.equal(hasWiFiEvidence({ wifi: "yes", access: "private" }), false);
  assert.equal(hasWiFiEvidence({ internet_access: "terminal" }), false);
});
test("explicitly tagged free is free, but venue entry fee is not Wi-Fi fee", () => {
  assert.equal(classifyWiFiAccess({ wifi: "free" }), "free");
  assert.equal(classifyWiFiAccess({ wifi: "yes", fee: "no" }), "unknown");
  assert.equal(classifyWiFiAccess({ wifi: "yes", "internet_access:fee": "customers" }), "customers");
  assert.equal(classifyWiFiAccess({ wifi: "yes", "internet_access:fee": "no" }), "free");
});
test("normalise keeps real OSM provenance and rejects unsupported objects", () => {
  const place = normaliseWiFi({ type: "node", id: 12, lat: centre.lat, lon: centre.lon, tags: { wifi: "free", name: "Test spot" } });
  assert.equal(place?.osmUrl, "https://www.openstreetmap.org/node/12");
  assert.equal(normaliseWiFi({ type: "node", id: 13, lat: centre.lat, lon: centre.lon, tags: { amenity: "library" } }), null);
});
test("deduplicates results, ignores points outside radius, and sorts closest first", () => {
  const elements = [
    { type: "node" as const, id: 2, lat: 54.64, lon: -1.58, tags: { wifi: "yes" } },
    { type: "node" as const, id: 1, lat: 54.62, lon: -1.58, tags: { wifi: "free" } },
    { type: "node" as const, id: 1, lat: 54.62, lon: -1.58, tags: { wifi: "free" } },
    { type: "node" as const, id: 3, lat: 55.62, lon: -1.58, tags: { wifi: "free" } }
  ];
  const result = normaliseOverpassResults(elements, centre);
  assert.equal(result.places.length, 2);
  assert.equal(result.places[0].id, "node/1");
  assert.equal(result.matches, 2);
  assert.equal(result.limited, false);
  assert.equal(WIFI_SEARCH_RADIUS_METRES, 5000);
});
