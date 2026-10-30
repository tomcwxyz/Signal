"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Search } from "lucide-react";
import type { CoverageResponse, CoverageRating, CoverageOperator } from "@/lib/ofcom-coverage";
import { coverageDescription, COVERAGE_OPERATORS } from "@/lib/ofcom-coverage";

type Props = { suggestedPostcode: string };
type OperatorChoice = "All" | CoverageOperator;

export default function CoveragePanel({ suggestedPostcode }: Props) {
  const [input, setInput] = useState("");
  const [requested, setRequested] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [selected, setSelected] = useState("");
  const [operator, setOperator] = useState<OperatorChoice>("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (suggestedPostcode.trim()) {
      setInput(suggestedPostcode);
      setRequested(suggestedPostcode.trim().toUpperCase());
      setRefresh(value => value + 1);
    }
  }, [suggestedPostcode]);

  useEffect(() => {
    if (!requested) return;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    setSelected("");
    void fetch("/api/coverage?postcode=" + encodeURIComponent(requested), {
      signal: abort.signal,
      cache: "no-store"
    }).then(async response => {
      const payload: unknown = await response.json();
      if (!response.ok) {
        const error = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Coverage lookup failed.";
        throw new Error(error);
      }
      return payload as CoverageResponse;
    }).then(result => {
      if (abort.signal.aborted) return;
      setData(result);
      if (result.properties.length === 1) setSelected("0");
    }).catch(reason => {
      if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "Coverage lookup unavailable.");
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [requested, refresh]);

  const submit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim().toUpperCase();
    if (!value) { setError("Enter a UK postcode to check coverage."); return; }
    setRequested(value);
    setRefresh(value => value + 1);
  }, [input]);

  const property = data && selected !== "" ? data.properties[Number(selected)] : null;
  const operators = operator === "All" ? COVERAGE_OPERATORS : [operator];
  return <section className="coverage-widget" aria-labelledby="coverage-title">
    <div className="filter-head">
      <span className="eyebrow" id="coverage-title">OFCOM MOBILE COVERAGE</span>
      <span className="coverage-source">Predicted 4G/5G</span>
    </div>
    <form className="coverage-search" onSubmit={submit}>
      <input aria-label="UK postcode for mobile coverage" autoComplete="postal-code" value={input}
        placeholder="Enter a postcode" onChange={e => setInput(e.target.value)} />
      <button type="submit" disabled={loading}><Search size={15} />{loading ? "Checking…" : "Check"}</button>
    </form>
    {loading && <p role="status" className="coverage-message">Checking Ofcom predictions for properties in this postcode…</p>}
    {error && <p role="alert" className="coverage-error">{error} <button type="button" className="inline-action" onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
    {!requested && !loading && <p className="coverage-message">Check mobile coverage by postcode, or use your location. Results are predicted for individual properties.</p>}
    {data && !loading && <>
      <p className="coverage-result-heading">{data.postcode} · {data.properties.length} {data.properties.length === 1 ? "property" : "properties"} found</p>
      {data.properties.length > 1 && <label className="coverage-property-label" htmlFor="coverage-property">Choose a property
        <select id="coverage-property" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Select an address to view coverage</option>
          {data.properties.map((item, i) => <option key={item.id} value={String(i)}>{item.address}</option>)}
        </select>
      </label>}
      {data.properties.length === 0 && <p className="coverage-message">Ofcom has no property results for this postcode. This does not mean there is no signal.</p>}
      {property && <>
        <p className="coverage-address">{property.address}</p>
        <div className="network-pills" aria-label="Filter mobile network">
          {(["All", ...COVERAGE_OPERATORS] as OperatorChoice[]).map(name =>
            <button type="button" key={name} aria-pressed={operator === name}
              className={"network-pill" + (operator === name ? " current" : "")}
              onClick={() => setOperator(name)}>{name === "All" ? "All networks" : name}</button>)}
        </div>
        <div className="coverage-rows">
          {operators.map(name => {
            const rating: CoverageRating = property.ratings[name];
            const meaning = coverageDescription(rating);
            return <div className="coverage-network-row" key={name}>
              <strong>{name}</strong>
              <span className={"coverage-rating coverage-rating-" + (rating ?? "unknown")}>
                {rating === null ? "?" : rating}
              </span>
              <span>{meaning}</span>
            </div>;
          })}
        </div>
        <p className="coverage-legend">Scores: 0 = no predicted coverage, 1–2 = outdoor only, 3–4 = some in-home coverage. These are combined 4G/5G predictions, not live measurements.</p>
        {property.createdAt && <p className="coverage-date">Ofcom data date: {property.createdAt}</p>}
      </>}
      <div className="ofcom-attribution">
        <a href="https://www.ofcom.org.uk/mobile" target="_blank" rel="noopener noreferrer" aria-label="Ofcom mobile coverage checker">
          <img src="https://www.ofcom.org.uk/siteassets/resources/images/illustrations/logos/powered-by-ofcom-api.png" alt="Powered by Ofcom API" width="156" height="42" />
        </a>
        <a href="https://www.ofcom.org.uk/mobile" target="_blank" rel="noopener noreferrer">Ofcom checker <ExternalLink size={12}/></a>
      </div>
      <p className="coverage-disclaimer">These are computer-modelled predictions supplied by mobile operators and standardised by Ofcom. Actual coverage can differ because of buildings, terrain, devices and other factors. Operator maps may differ. Ofcom updates its source data periodically; check the network provider before relying on a connection.</p>
    </>}
  </section>;
}
