import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleTargets, summariseSample, MAX_LOCAL_SAMPLES } from "../src/lib/local-coverage";
import { distanceMetres } from "../src/lib/geo";
import { type CoverageResponse } from "../src/lib/ofcom-coverage";
const centre = { lat: 54.617, lon: -1.577 };
test("sampling stays local and is explicitly capped", () => {
  const targets = sampleTargets(centre);
  assert.equal(targets.length, MAX_LOCAL_SAMPLES);
  assert.ok(targets.every(location => distanceMetres(location, centre) <= 670));
  assert.deepEqual(sampleTargets({ lat: 0, lon: 0 }), []);
});
test("identical property ratings can be shown, not inferred area-wide", () => {
  const data: CoverageResponse = {
    postcode: "DL5 6LA", source: "Ofcom", technology: "combined-4g-5g",
    properties: [
      { id: "a", address: "A", createdAt: null, ratings: { EE: 4, Three: 1, O2: 0, Vodafone: null } },
      { id: "b", address: "B", createdAt: null, ratings: { EE: 4, Three: 3, O2: 0, Vodafone: null } }
    ]
  };
  const sample = summariseSample(data, centre);
  assert.equal(sample.propertyCount, 2);
  assert.equal(sample.ratings.EE, 4);
  assert.equal(sample.ratings.O2, 0);
  assert.equal(sample.ratings.Three, null);
  assert.equal(sample.varies.Three, true);
  assert.equal(sample.ratings.Vodafone, null);
  assert.equal(sample.varies.Vodafone, false);
});
test("no property predictions must never be interpreted as no coverage", () => {
  const empty: CoverageResponse = { postcode: "DL5 6LA", source: "Ofcom", technology: "combined-4g-5g", properties: [] };
  const result = summariseSample(empty, centre);
  assert.deepEqual(Object.values(result.ratings), [null, null, null, null]);
  assert.deepEqual(Object.values(result.varies), [false, false, false, false]);
});
