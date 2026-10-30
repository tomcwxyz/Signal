import { test } from "node:test";
import assert from "node:assert/strict";
import { googleMapsDirectionsUrl } from "../src/lib/directions";

test("directions use exact hotspot coordinates and walking by default", () => {
  const url = new URL(googleMapsDirectionsUrl({ lat: 54.617, lon: -1.577 }));
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.pathname, "/maps/dir/");
  assert.equal(url.searchParams.get("api"), "1");
  assert.equal(url.searchParams.get("destination"), "54.617000,-1.577000");
  assert.equal(url.searchParams.get("travelmode"), "walking");
  assert.equal(url.searchParams.has("origin"), false);
});
test("cycling and driving modes are supported on same coordinates", () => {
  for (const mode of ["driving", "bicycling"] as const) {
    const url = new URL(googleMapsDirectionsUrl({ lat: 51.50735, lon: -0.12775 }, mode));
    assert.equal(url.searchParams.get("travelmode"), mode);
    assert.equal(url.searchParams.get("destination"), "51.507350,-0.127750");
  }
});
test("invalid coordinates and unsupported modes cannot yield external URLs", () => {
  for (const target of [
    { lat: NaN, lon: 0 }, { lat: 95, lon: 1 }, { lat: 50, lon: Infinity }, { lat: 50, lon: 181 }
  ]) assert.throws(() => googleMapsDirectionsUrl(target), RangeError);
  assert.throws(() => googleMapsDirectionsUrl({ lat: 51, lon: -1 }, "flying" as "walking"), RangeError);
});
