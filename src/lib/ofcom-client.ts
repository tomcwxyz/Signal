/** Server-only Ofcom 4G/5G API transport. Never import into Client Components. */
import { normaliseOfcomPostcode } from "./postcode";

export { normaliseOfcomPostcode } from "./postcode";

export class OfcomConfigurationError extends Error {
  constructor() { super("Ofcom API key not configured."); this.name = "OfcomConfigurationError"; }
}
export class OfcomUpstreamError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("Ofcom coverage lookup could not be completed.");
    this.name = "OfcomUpstreamError";
    this.status = status;
  }
}
const ENDPOINT = "https://apim-cnapi-shared-prod.azure-api.net/mobilechecker/UPRN/";
export function buildOfcomRequest(postcodeInput: string, environment: { OFCOM_API_KEY?: string }) {
  const postcode = normaliseOfcomPostcode(postcodeInput);
  if (!postcode) throw new RangeError("Enter a valid full UK postcode.");
  const key = environment.OFCOM_API_KEY?.trim();
  if (!key) throw new OfcomConfigurationError();
  // Exact replacement gateway URL supplied by the Ofcom subscribed API portal.
  const url = new URL(ENDPOINT + encodeURIComponent(postcode.replace(/\s/g, "")));
  return { postcode, url, init: {
    method: "GET" as const,
    headers: { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" },
    cache: "no-store" as const
  } };
}
export async function fetchOfcomRawPostcode(
  postcode: string,
  environment: { OFCOM_API_KEY?: string } = { OFCOM_API_KEY: process.env.OFCOM_API_KEY },
  transport: typeof fetch = fetch
): Promise<unknown> {
  const request = buildOfcomRequest(postcode, environment);
  let response: Response;
  try {
    response = await transport(request.url, { ...request.init, signal: AbortSignal.timeout(9000) });
  } catch { throw new OfcomUpstreamError(503); }
  if (!response.ok) throw new OfcomUpstreamError(response.status);
  if (!(response.headers.get("content-type") || "").toLowerCase().includes("json")) {
    throw new OfcomUpstreamError(502);
  }
  if (Number(response.headers.get("content-length") || 0) > 4_000_000) throw new OfcomUpstreamError(502);
  try { return await response.json() as unknown; } catch { throw new OfcomUpstreamError(502); }
}
