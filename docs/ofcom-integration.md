# Signal: Ofcom 4G/5G coverage integration

Status: transport and tests prepared. **No live coverage is shown yet.**

## Why postcode first?

Ofcom's replacement 4G/5G APIs supply predictions at postcode and UPRN
(property) level. They are **not** a licence to crawl UK postcodes and
manufacture a cached nationwide coverage raster. Signal's first mobile
coverage release should let people check a chosen postcode, select a
network, inspect 4G/5G and relevant indoor/outdoor predictions, and see
when the response was retrieved. Wi-Fi pins remain a separate OSM feed.

## Current configuration

The Vercel project `signal` has `OFCOM_API_KEY` set for **production**.
Never create `NEXT_PUBLIC_OFCOM_API_KEY` or send this secret to the browser.
The current app's coverage UI correctly says no predictions are available.

The module `src/lib/ofcom-client.ts` is deliberately **server-side only**.
It validates UK postcodes, sends an Ofcom Azure APIM subscription key as a
header, rejects unapproved/non-HTTPS gateways, times out and does not
cache responses. It has no browser imports and no public route yet.
The tests use a placeholder URL and a dummy key: **neither is a real endpoint
or credential**.

## Before enabling the route

1. Confirm the key is subscribed to the **replacement 4G/5G API**, not
   the legacy Ofcom Connected Nations Mobile API (retiring 30 November 2026).
2. Read the replacement API's subscribed developer docs and copy its
   verified HTTPS postcode operation URL into
   `OFCOM_4G5G_POSTCODE_URL` on Vercel, using a `{postcode}` placeholder.
   Do not rely on the example URL in the unit tests.
3. Confirm authentication method. The server defaults to the
   `Ocp-Apim-Subscription-Key` header; if the new contract specifies
   another header, set `OFCOM_API_KEY_HEADER` to its exact name.
   Confirm the gateway's real host is an Ofcom-controlled domain
   before adding it to the server allowlist.
4. Give the key and matching endpoint to the **preview** environment
   securely if we are to test preview deployments; production-only
   credentials do not appear in preview serverless functions.
5. Run an authenticated test request on the server using an example
   UK postcode, inspect **schema and status only**, without publishing
   response bodies, keys, or addresses in logs.
6. Create a strict `OfcomCoverageResult` parser using the **replacement**
   response schema and test operator, 4G/5G, indoor/outdoor and
   unknown/unavailable values. Unknown must never be drawn as 'none'.
7. Add a minimal rate-limited `/api/coverage?postcode=...` route after
   parsing is verified, return only fields needed by the requesting
   visitor, and show clear errors for 401/403, 429, missing data and
   upstream timeouts. Use a short performance cache only if permitted.
8. Connect Plan postcode search and selection controls to those verified
   results. Do not colour the wider map without appropriate licensed
   geospatial data.

## Licence and visual requirements

Review Ofcom's current agreement at:
https://www.ofcom.org.uk/siteassets/ofcom/phones-telecoms-and-internet/advice-for-consumers-/broadband-and-mobile-coverage-checker/ofcom-api-terms-of-use-2025.pdf

Its 2025 terms specify the Powered by Ofcom API logo, the accompanying
coverage disclaimer in reasonable proximity to results, preservation
of Ofcom's descriptors/colours, and a prohibition on accumulating
requests to build a separate partial/full dataset. Performance caches
must not retain responses for longer than one month. Confirm whether
replacement-API subscriber terms add or supersede those conditions.

## Deployment safety

The current production Vercel deployment is a **redeploy of commit
`a97c9935e59ab3311258c2a82ce6d529cf6957b2`**, with an older
MapLibre map. The open alpha PR's head
`0972ff12e81521aa54a9964736dccd0a2b8a8c95` has the newer
Leaflet map, count/legend, sharing and map error handling. Restore
and smoke-test the latest alpha code before releasing Ofcom features.

Do not merge this branch into `main` ahead of the alpha PR. It is
based on `feat/alpha-one-connectivity-map` and should be reviewed
against that branch first.

## Tests

```bash
npm install
npm run typecheck
npm test
npm run build
```

Only synthetic test data is used. No Ofcom credentials are ever required
to run CI. Live authenticated integration still requires the documented
endpoint and a controlled deployment.
