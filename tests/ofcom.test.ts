import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normaliseOfcomPostcode,
  buildOfcomRequest,
  fetchOfcomRawPostcode,
  OfcomConfigurationError,
  OfcomUpstreamError
} from "../src/lib/ofcom-client";

const config = {
  OFCOM_API_KEY: "test-private-key-do-not-publish",
  OFCOM_4G5G_POSTCODE_URL: "https://api.ofcom.org.uk/4g5g/coverage/{postcode}"
};

test("Ofcom postcodes are canonicalised and invalid inputs rejected", () => {
  assert.equal(normaliseOfcomPostcode(" dl56la "), "DL5 6LA");
  assert.equal(normaliseOfcomPostcode("EC1A1BB"), "EC1A 1BB");
  assert.equal(normaliseOfcomPostcode("GIR0AA"), "GIR 0AA");
  assert.equal(normaliseOfcomPostcode("invalid"), null);
  assert.equal(normaliseOfcomPostcode(""), null);
});

test("request builder passes the key in a header, not the URI", () => {
  const request = buildOfcomRequest("DL5 6LA", config);
  assert.equal(request.url.toString(), "https://api.ofcom.org.uk/4g5g/coverage/DL5%206LA");
  assert.equal(request.init.headers["Ocp-Apim-Subscription-Key"], config.OFCOM_API_KEY);
  assert.equal(request.url.toString().includes(config.OFCOM_API_KEY), false);
  assert.equal(request.init.cache, "no-store");
});

test("missing configuration and unapproved hosts fail closed", () => {
  assert.throws(() => buildOfcomRequest("DL5 6LA", { OFCOM_API_KEY: "test" }), OfcomConfigurationError);
  assert.throws(() => buildOfcomRequest("DL5 6LA", {
    ...config, OFCOM_4G5G_POSTCODE_URL: "http://api.ofcom.org.uk/coverage/{postcode}"
  }), OfcomConfigurationError);
  assert.throws(() => buildOfcomRequest("DL5 6LA", {
    ...config, OFCOM_4G5G_POSTCODE_URL: "https://api.ofcom.org.uk.attacker.example/coverage/{postcode}"
  }), OfcomConfigurationError);
  assert.throws(() => buildOfcomRequest("DL5 6LA", {
    ...config, OFCOM_4G5G_POSTCODE_URL: "https://api.ofcom.org.uk/coverage/DL5"
  }), OfcomConfigurationError);
  assert.throws(() => buildOfcomRequest("wrong", config), RangeError);
});

test("transport returns unmodified JSON to server adapter, never changes coverage scores", async () => {
  const raw = { sample: [{ score: 4 }] };
  const fakeFetch = (async (_url: URL | RequestInfo, init?: RequestInit) => {
    assert.equal((init?.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"], config.OFCOM_API_KEY);
    return new Response(JSON.stringify(raw), { headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  assert.deepEqual(await fetchOfcomRawPostcode("DL5 6LA", config, fakeFetch), raw);
});

test("transport fails clearly for denied requests and invalid response formats", async () => {
  const denied = (async () => new Response("", { status: 401 })) as typeof fetch;
  await assert.rejects(fetchOfcomRawPostcode("DL5 6LA", config, denied), (error: unknown) =>
    error instanceof OfcomUpstreamError && error.status === 401 && !error.message.includes(config.OFCOM_API_KEY));
  const html = (async () => new Response("<html/>", { headers: { "Content-Type": "text/html" } })) as typeof fetch;
  await assert.rejects(fetchOfcomRawPostcode("DL5 6LA", config, html), (error: unknown) =>
    error instanceof OfcomUpstreamError && error.status === 502);
});
