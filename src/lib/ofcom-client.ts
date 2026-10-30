/**
 * Server-side transport for Ofcom's replacement 4G/5G postcode API.
 *
 * Intentionally NOT exposed through an API route yet: the replacement
 * response schema and its exact gateway URL must be verified against
 * the subscriber documentation before any results are shown to users.
 * Never import this module from a Client Component.
 */
export type OfcomEnvironment = {
  OFCOM_API_KEY?: string;
  OFCOM_4G5G_POSTCODE_URL?: string;
  OFCOM_API_KEY_HEADER?: string;
};

export class OfcomConfigurationError extends Error {
  constructor(message = "Ofcom coverage is not configured.") {
    super(message);
    this.name = "OfcomConfigurationError";
  }
}

export class OfcomUpstreamError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("Ofcom coverage lookup could not be completed.");
    this.name = "OfcomUpstreamError";
    this.status = status;
  }
}

/** The browser and server must reject incomplete/invalid UK postcodes. */
export function normaliseOfcomPostcode(input: string): string | null {
  const compact = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^(GIR0AA|[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2})$/.test(compact)) {
    return null;
  }
  return compact.slice(0, -3) + " " + compact.slice(-3);
}

/**
 * The gateway URI is deliberately configured, not guessed from the retired
 * /mobile/coverage legacy API. It must include one {postcode} placeholder.
 */
export function buildOfcomRequest(postcodeInput: string, environment: OfcomEnvironment) {
  const postcode = normaliseOfcomPostcode(postcodeInput);
  if (!postcode) throw new RangeError("Enter a valid full UK postcode.");

  const key = environment.OFCOM_API_KEY?.trim();
  const template = environment.OFCOM_4G5G_POSTCODE_URL?.trim();
  if (!key || !template) throw new OfcomConfigurationError();
  if (template.split("{postcode}").length !== 2) {
    throw new OfcomConfigurationError("The Ofcom postcode API URL is invalid.");
  }

  let url: URL;
  try {
    url = new URL(template.replace("{postcode}", encodeURIComponent(postcode)));
  } catch {
    throw new OfcomConfigurationError("The Ofcom postcode API URL is invalid.");
  }
  // The operator-controlled endpoint must be HTTPS and hosted by Ofcom.
  // Recheck the official gateway domain before expanding this allowlist.
  if (url.protocol !== "https:" || !/(^|\.)ofcom\.org\.uk$/i.test(url.hostname) ||
      url.username || url.password || url.hash) {
    throw new OfcomConfigurationError("The Ofcom postcode API URL is not approved.");
  }

  const headerName = environment.OFCOM_API_KEY_HEADER?.trim() || "Ocp-Apim-Subscription-Key";
  if (!/^[A-Za-z0-9-]{1,80}$/.test(headerName)) {
    throw new OfcomConfigurationError("The Ofcom authentication header is invalid.");
  }

  return {
    postcode,
    url,
    init: {
      method: "GET" as const,
      headers: {
        [headerName]: key,
        Accept: "application/json"
      },
      cache: "no-store" as const
    }
  };
}

/**
 * Transport only. Call from a future server adapter which verifies the
 * replacement API schema, preserves Ofcom's labels and suppresses address /
 * UPRN details that users have not requested.
 */
export async function fetchOfcomRawPostcode(
  postcode: string,
  environment: OfcomEnvironment = {
    OFCOM_API_KEY: process.env.OFCOM_API_KEY,
    OFCOM_4G5G_POSTCODE_URL: process.env.OFCOM_4G5G_POSTCODE_URL,
    OFCOM_API_KEY_HEADER: process.env.OFCOM_API_KEY_HEADER
  },
  transport: typeof fetch = fetch
): Promise<unknown> {
  const request = buildOfcomRequest(postcode, environment);
  let response: Response;
  try {
    response = await transport(request.url, {
      ...request.init,
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    throw new OfcomUpstreamError(503);
  }
  if (!response.ok) throw new OfcomUpstreamError(response.status);
  if (!(response.headers.get("content-type") || "").toLowerCase().includes("json")) {
    throw new OfcomUpstreamError(502);
  }
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 2_000_000) throw new OfcomUpstreamError(502);
  try {
    return await response.json() as unknown;
  } catch {
    throw new OfcomUpstreamError(502);
  }
}
