import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageHeatRings } from "../src/lib/coverage-heat-style";
import type { LocalCoverageSample } from "../src/lib/local-coverage";

const sample: LocalCoverageSample = {
  postcode: "DL5 5NG", centre: { lat: 54.617, lon: -1.577 }, propertyCount: 29,
  ratings: { EE: 4, Three: null, O2: null, Vodafone: 3 },
  varies: { EE: false, Three: true, O2: true, Vodafone: false }
};
test("known score creates three visible geo-referenced shaded rings", () => {
  const rings = coverageHeatRings(sample, "EE");
  assert.equal(rings.length, 3);
  assert.deepEqual(rings.map(ring => ring.radiusMetres), [850, 550, 285]);
  assert.ok(rings.every(ring => ring.fillOpacity >= 0.13));
  assert.ok(rings.every(ring => ring.strokeOpacity === 0));
  assert.ok(rings.every(ring => ring.colour.startsWith("rgb(")));
});
test("mixed property results are unambiguously shown as uncertain, not zero", () => {
  const rings = coverageHeatRings(sample, "O2");
  assert.equal(rings.length, 1);
  assert.equal(rings[0].fillOpacity, 0);
  assert.ok(rings[0].dashArray);
  assert.equal(rings[0].colour, "#60798b");
});
test("all network comparison remains a derived lower bound and not another Ofcom score", () => {
  const rings = coverageHeatRings(sample, "All");
  assert.equal(rings.length, 3);
  assert.notEqual(rings[0].colour, "#60798b");
});
test("empty property prediction has no coloured shading", () => {
  const rings = coverageHeatRings({ ...sample, propertyCount: 0 }, "EE");
  assert.equal(rings.length, 1);
  assert.equal(rings[0].fillOpacity, 0);
});
