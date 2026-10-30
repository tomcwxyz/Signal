/** Client-safe, property-level Ofcom coverage model (no keys or UPRNs exposed). */
export const COVERAGE_OPERATORS = ["EE", "Three", "O2", "Vodafone"] as const;
export type CoverageOperator = typeof COVERAGE_OPERATORS[number];
export type CoverageRating = 0 | 1 | 2 | 3 | 4 | null;
export type CoverageProperty = {
  id: string;
  address: string;
  createdAt: string | null;
  ratings: Record<CoverageOperator, CoverageRating>;
};
export type CoverageResponse = {
  postcode: string;
  source: "Ofcom";
  technology: "combined-4g-5g";
  properties: CoverageProperty[];
};

const FIELD_NAMES: Record<CoverageOperator, string> = {
  EE: "Mc_EE", Three: "Mc_TH", O2: "Mc_O2", Vodafone: "Mc_VO"
};
const DESCRIPTIONS: Record<Exclude<CoverageRating, null>, string> = {
  0: "Poor to no outdoor coverage",
  1: "Variable outdoor coverage",
  2: "Good outdoor coverage",
  3: "Good outdoor, variable in-home",
  4: "Good outdoor and in-home"
};
export function coverageDescription(value: CoverageRating): string {
  return value === null ? "Not reported" : DESCRIPTIONS[value];
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function getField(object: Record<string, unknown>, key: string): unknown {
  const actual = Object.keys(object).find(item => item.trim().toLowerCase() === key.toLowerCase());
  return actual ? object[actual] : undefined;
}
function rating(value: unknown): CoverageRating {
  // Only exact integers can be translated into Ofcom's 0–4 level.
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 4
    ? value as Exclude<CoverageRating, null> : null;
}
/** Ofcom 4G/5G postcode response: [{ PostCode, Availability: [{... Mc_EE ...}] }]. */
export function normaliseOfcomCoverage(raw: unknown, requestedPostcode: string): CoverageResponse {
  const wrappers = Array.isArray(raw) ? raw : [raw];
  const items = wrappers.flatMap(wrapper => {
    const root = record(wrapper);
    if (!root) return [];
    const availability = getField(root, "Availability");
    return Array.isArray(availability) ? availability : [];
  });
  // Fail closed if Ofcom changes its contract rather than reporting 'no signal'.
  if (wrappers.length === 0 || !wrappers.some(wrapper => {
    const root = record(wrapper);
    return root && Array.isArray(getField(root, "Availability"));
  })) throw new Error("Unrecognised Ofcom coverage response.");

  const properties = items.slice(0, 500).flatMap((item, index) => {
    const fields = record(item);
    if (!fields) return [];
    const addr = getField(fields, "address_short_description");
    const created = getField(fields, "creation_date");
    const address = typeof addr === "string" && addr.trim() ? addr.trim().slice(0, 180) : "Property " + (index + 1);
    const ratings = {} as Record<CoverageOperator, CoverageRating>;
    for (const operator of COVERAGE_OPERATORS) ratings[operator] = rating(getField(fields, FIELD_NAMES[operator]));
    return [{ id: String(index), address, createdAt: typeof created === "string" ? created.slice(0, 10) : null, ratings }];
  });
  return { postcode: requestedPostcode, source: "Ofcom", technology: "combined-4g-5g", properties };
}
