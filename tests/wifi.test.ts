import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyWiFiAccess, normaliseWiFi } from "../src/lib/wifi";
import { distanceMetres, validCoordinates } from "../src/lib/geo";
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
