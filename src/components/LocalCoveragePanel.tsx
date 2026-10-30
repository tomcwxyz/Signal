"use client";
import type { CoverageOperator } from "@/lib/ofcom-coverage";
import { COVERAGE_OPERATORS, coverageDescription } from "@/lib/ofcom-coverage";
import type { LocalCoverageSample } from "@/lib/local-coverage";

type Props = {
  samples: LocalCoverageSample[];
  operator: CoverageOperator;
  onOperatorChange: (operator: CoverageOperator) => void;
  loading: boolean;
  error: string;
  disabled: boolean;
  centreMoved: boolean;
  failedLookups: number;
  onSample: () => void;
  onInspect: (postcode: string) => void;
};

export default function LocalCoveragePanel(props: Props) {
  const { samples, operator, onOperatorChange, loading, error, centreMoved, disabled,
    failedLookups, onSample, onInspect } = props;
  return <section className="local-coverage-panel" aria-label="Local estimated mobile coverage">
    <div className="filter-head"><span className="eyebrow">MOBILE COVERAGE MAP</span>
      <span className="coverage-source">Local postcode samples</span></div>
    <p className="coverage-message">Check Ofcom's combined 4G/5G predictions around the map centre. Each dot represents a sampled postcode; it does not colour an unsampled area.</p>
    <div className="network-pills" aria-label="Network for map sample markers">
      {COVERAGE_OPERATORS.map(network => <button key={network} type="button"
        className={"network-pill" + (operator === network ? " current" : "")}
        aria-pressed={operator === network} onClick={() => onOperatorChange(network)}>{network}</button>)}
    </div>
    <button type="button" className="local-sample-button" disabled={loading || disabled} onClick={onSample}>
      {loading ? "Checking nearby postcodes…" : samples.length ? "Refresh samples at map centre" : "Show local coverage on map"}
    </button>
    {error && <p role="alert" className="coverage-error">{error}</p>}
    {centreMoved && <p className="coverage-message">The map has moved. Sample again to see estimates here.</p>}
    {loading && <p role="status" className="coverage-message">Comparing a small set of nearby postcodes. Wi-Fi remains available.</p>}
    {!loading && !centreMoved && samples.length > 0 && <>
      <p className="coverage-result-heading">{samples.length} nearby postcode samples · {operator}</p>
      <div className="local-coverage-list">
        {samples.map(sample => {
          const value = sample.ratings[operator];
          const varies = sample.varies[operator];
          return <button className="local-coverage-item" key={sample.postcode}
            type="button" onClick={() => onInspect(sample.postcode)}>
            <strong>{sample.postcode}</strong>
            <span className={"coverage-rating coverage-rating-" + (value ?? "unknown")}>
              {varies ? "≠" : value ?? "?"}
            </span>
            <small>{varies ? "Varies across properties" : value === null ? "Not reported" : coverageDescription(value)}</small>
          </button>;
        })}
      </div>
      {failedLookups > 0 && <p className="coverage-message">{failedLookups} nearby queries could not be completed; missing samples are not zero coverage.</p>}
      <p className="coverage-legend">Numbers are shown only where all returned properties in a postcode agree. ≠ means different property scores; tap to choose an address. ? means no comparable score. The pins are at postcode centres, not precise property locations. No results are saved.</p>
      <a className="local-ofcom-link" href="https://www.ofcom.org.uk/mobile" target="_blank" rel="noopener noreferrer">Coverage predictions © Ofcom · View official checker</a>
    </>}
  </section>;
}
