import { test } from "node:test";
import assert from "node:assert/strict";
import { readWiFiResponse } from "../src/lib/wifi-client";

test("returns a valid Wi-Fi response", async () => {
  const data = { places: [], centre: { lat: 54.62, lon: -1.58 }, matches: 0, limited: false,
    fetchedAt: new Date().toISOString(), osmDataAt: null, radiusMetres: 5000, source: "OpenStreetMap" };
  assert.deepEqual(await readWiFiResponse(Response.json(data)), data);
});

test("preserves an informative JSON API error", async () => {
  const response = Response.json({ error: "The live OpenStreetMap Wi-Fi feed is not responding." }, { status: 503 });
  await assert.rejects(readWiFiResponse(response), /OpenStreetMap Wi-Fi feed/);
});

test("handles non-JSON Vercel gateway text without a JSON parsing error", async () => {
  const response = new Response("An error occurred with your deployment", {
    status: 504, headers: { "Content-Type": "text/plain" }
  });
  await assert.rejects(readWiFiResponse(response), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /timed out/);
    assert.doesNotMatch(error.message, /Unexpected token|JSON/);
    return true;
  });
});

test("rejects malformed successful results rather than reporting no places", async () => {
  await assert.rejects(readWiFiResponse(Response.json({ message: "OK" })),
    /invalid response/);
});
