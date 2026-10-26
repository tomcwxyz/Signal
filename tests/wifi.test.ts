import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyWiFiAccess, normaliseWiFi } from "../src/lib/wifi";
import { distanceMetres, snapshotCovers, validCoordinates } from "../src/lib/geo";
import { parseSharedMap, sharedMapPath } from "../src/lib/shared-map";
import { ageInDays } from "../src/lib/snapshot";
test("never represents unknown fees as free", () => {
  assert.equal(classifyWiFiAccess({ internet_access: "wlan" }), "unknown");
  assert.equal(classifyWiFiAccess({ "internet_access:fee": "no" }), "free");
  assert.equal(classifyWiFiAccess({ "internet_access:fee": "customers" }), "customers");
  assert.equal(classifyWiFiAccess({ "internet_access:fee": "yes" }), "paid");
});
test("ways use their returned centre and unsafe websites are stripped", () => {
  const place = normaliseWiFi({ type: "way", id: 42, center: { lat: 54.6, lon: -1.6 }, tags: { name: "Library", website: "javascript:alert(1)" } });
  assert.equal(place?.name, "Library");
  assert.equal(place?.website, undefined);
  assert.equal(place?.osmUrl, "https://www.openstreetmap.org/way/42");
});
test("coordinates validate UK and distance is reasonable", () => {
  assert.equal(validCoordinates({ lat: 54.6, lon: -1.6 }), true);
  assert.equal(validCoordinates({ lat: 0, lon: 0 }), false);
  assert.ok(distanceMetres({ lat: 54.6, lon: -1.6 }, { lat: 54.61, lon: -1.6 }) > 1000);
});

test("saved Wi-Fi list cannot be used as if it were fetched for a distant town", () => {
  assert.equal(snapshotCovers({ lat: 54.6, lon: -1.6 }, { lat: 54.601, lon: -1.601 }), true);
  assert.equal(snapshotCovers({ lat: 54.6, lon: -1.6 }, { lat: 55.9, lon: -1.6 }), false);
});
test("customer access takes precedence even if a no-fee tag is present", () => {
  assert.equal(classifyWiFiAccess({ access: "customers", "internet_access:fee": "no" }), "customers");
});

test("shareable map link round-trips a UK location without sharing precise user location implicitly", () => {
  const original = { lat: 54.617, lon: -1.577 };
  const path = sharedMapPath(original, 12.5);
  const result = parseSharedMap(new URL("https://example.org" + path).searchParams);
  assert.equal(result?.centre.lat, original.lat);
  assert.equal(result?.centre.lon, original.lon);
  assert.equal(result?.zoom, 13);
});
test("invalid or overseas deep links do not change map position", () => {
  assert.equal(parseSharedMap(new URLSearchParams("lat=0&lon=0")), null);
  assert.equal(parseSharedMap(new URLSearchParams("lat=a&lon=b")), null);
});

test("offline snapshots retain a sensible age for user warnings", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  assert.equal(ageInDays("2026-10-01T12:00:00Z", now), 25);
  assert.equal(ageInDays("invalid", now), null);
});
