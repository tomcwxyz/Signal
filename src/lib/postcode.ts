/** Pure utility shared by the Ofcom transport and public postcode API. */
export function normaliseOfcomPostcode(input: string): string | null {
  const compact = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^(GIR0AA|[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2})$/.test(compact)) return null;
  return compact.slice(0, -3) + " " + compact.slice(-3);
}
