import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseOfcomPostcode, buildOfcomRequest, fetchOfcomRawPostcode, OfcomConfigurationError, OfcomUpstreamError } from "../src/lib/ofcom-client";
import { coverageDescription, normaliseOfcomCoverage } from "../src/lib/ofcom-coverage";

const config = { OFCOM_API_KEY: "synthetic-test-key" };
test("postcodes are canonicalised", () => {
  assert.equal(normaliseOfcomPostcode(" dl56la "), "DL5 6LA");
  assert.equal(normaliseOfcomPostcode("SW1A1AA"), "SW1A 1AA");
  assert.equal(normaliseOfcomPostcode("nope"), null);
});
test("server request uses exact replacement API and private auth header", () => {
  const req = buildOfcomRequest("DL5 6LA", config);
  assert.equal(req.url.href, "https://apim-cnapi-shared-prod.azure-api.net/mobilechecker/UPRN/DL56LA");
  assert.equal(req.init.headers["Ocp-Apim-Subscription-Key"], config.OFCOM_API_KEY);
  assert.equal(req.url.href.includes(config.OFCOM_API_KEY), false);
  assert.equal(req.init.cache, "no-store");
  assert.throws(() => buildOfcomRequest("DL5 6LA", {}), OfcomConfigurationError);
  assert.throws(() => buildOfcomRequest("nope", config), RangeError);
});
test("parser honours property-level scores including zero and unknown values", () => {
  const result = normaliseOfcomCoverage([{
    PostCode: "DL5 6LA",
    Availability: [
      { uprn: "111", address_short_description: "Library", Mc_EE: 4, Mc_TH: 3, Mc_O2: 0, Mc_VO: 2, creation_date: "2026-06-01" },
      { uprn: "222", address_short_description: "School", Mc_EE: 1, Mc_TH: 2, Mc_O2: 3, Mc_VO: 9 }
    ]
  }], "DL5 6LA");
  assert.equal(result.properties.length, 2);
  assert.deepEqual(result.properties[0].ratings, { EE: 4, Three: 3, O2: 0, Vodafone: 2 });
  assert.equal(result.properties[1].ratings.Vodafone, null);
  assert.equal(result.properties[0].createdAt, "2026-06-01");
  assert.equal(JSON.stringify(result).includes("111"), false);
  assert.equal(coverageDescription(0), "Poor to no outdoor coverage");
  assert.equal(coverageDescription(4), "Good outdoor and in-home");
  assert.equal(result.technology, "combined-4g-5g");
});
test("unrecognised API response fails closed instead of displaying fabricated zero", () => {
  assert.throws(() => normaliseOfcomCoverage({}, "DL5 6LA"), /Unrecognised/);
  assert.equal(normaliseOfcomCoverage([{ PostCode: "DL5 6LA", Availability: [] }], "DL5 6LA").properties.length, 0);
});
test("key stays in server-side header and transport preserves raw JSON", async () => {
  const data = [{ PostCode: "DL5 6LA", Availability: [] }];
  const mock = (async (_url: URL | RequestInfo, init?: RequestInit) => {
    assert.equal((init?.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"], config.OFCOM_API_KEY);
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  assert.deepEqual(await fetchOfcomRawPostcode("DL5 6LA", config, mock), data);
});
test("upstream errors do not leak the subscription key", async () => {
  const mock = (async () => new Response("", { status: 401 })) as typeof fetch;
  await assert.rejects(fetchOfcomRawPostcode("DL5 6LA", config, mock), (err: unknown) =>
    err instanceof OfcomUpstreamError && err.status === 401 && !err.message.includes(config.OFCOM_API_KEY));
});
