import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleVisual, COVERAGE_VIEWS } from "../src/lib/coverage-visual";
import type { LocalCoverageSample } from "../src/lib/local-coverage";
const base: LocalCoverageSample = {
  postcode: "DL5 5NG", centre: { lat: 54.617, lon: -1.577 }, propertyCount: 29,
  ratings: { EE: 4, Three: null, O2: null, Vodafone: 3 },
  varies: { EE: false, Three: true, O2: true, Vodafone: false }
};
test("all networks shows minimum confirmed in-home count without inventing uncertain ratings", () => {
  const result = sampleVisual(base, "All");
  assert.equal(result.label, "2+");
  assert.equal(result.level, 2);
  assert.match(result.details, /At least 2/);
});
test("operator switch uses exact Ofcom score, never an interpolated score", () => {
  assert.equal(sampleVisual(base, "EE").label, "4");
  assert.equal(sampleVisual(base, "Vodafone").label, "3");
  assert.equal(sampleVisual(base, "Three").label, "≠");
  assert.equal(sampleVisual(base, "Three").level, null);
});
test("all unknown is not zero coverage", () => {
  const input: LocalCoverageSample = {
    ...base, ratings: { EE: null, Three: null, O2: null, Vodafone: null },
    varies: { EE: true, Three: true, O2: true, Vodafone: true }
  };
  assert.equal(sampleVisual(input, "All").level, null);
  assert.equal(sampleVisual({ ...base, propertyCount: 0 }, "EE").label, "?");
});
test("four known operators distinguish 0/4 from missing data", () => {
  const input: LocalCoverageSample = {
    ...base, ratings: { EE: 1, O2: 0, Three: 2, Vodafone: 2 },
    varies: { EE: false, O2: false, Three: false, Vodafone: false }
  };
  assert.equal(sampleVisual(input, "All").label, "0");
  assert.equal(sampleVisual(input, "All").level, 0);
  assert.deepEqual(COVERAGE_VIEWS, ["All", "EE", "Three", "O2", "Vodafone"]);
});
