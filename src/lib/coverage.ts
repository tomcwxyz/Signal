import type { MobileNetwork, MobileTechnology } from "./types";
// Intentional: Ofcom's new mobile API requires sign-up and integration verification.
// Never infer or draw colours from an unavailable prediction.
export type CoverageState = {
  status: "not-configured";
  network: MobileNetwork;
  technology: MobileTechnology;
  data: null;
};
export function getCoverageState(network: MobileNetwork, technology: MobileTechnology): CoverageState {
  return { status: "not-configured", network, technology, data: null };
}
