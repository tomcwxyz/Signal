import type { WiFiResult } from "./types";

/**
 * An upstream timeout can cause Vercel to return a plain-text gateway error
 * instead of our normal JSON envelope. Never expose JSON.parse errors to users.
 */
export async function readWiFiResponse(response: Response): Promise<WiFiResult> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      response.status === 502 || response.status === 504
        ? "The live Wi-Fi lookup timed out. Please try again shortly."
        : "Wi-Fi locations are temporarily unavailable. Please try again shortly."
    );
  }

  if (!response.ok) {
    if (payload && typeof payload === "object" && "error" in payload &&
        typeof payload.error === "string") {
      throw new Error(payload.error);
    }
    throw new Error("Wi-Fi locations are temporarily unavailable. Please try again shortly.");
  }

  if (!payload || typeof payload !== "object" ||
      !("places" in payload) || !Array.isArray(payload.places) ||
      !("centre" in payload) || !payload.centre || typeof payload.centre !== "object") {
    throw new Error("Wi-Fi locations returned an invalid response. Please try again shortly.");
  }

  return payload as WiFiResult;
}
