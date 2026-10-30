"use client";
import { coverageDescription } from "@/lib/ofcom-coverage";
import type { CoverageView } from "@/lib/coverage-visual";
import { COVERAGE_VIEWS, sampleVisual } from "@/lib/coverage-visual";
import type { LocalCoverageSample } from "@/lib/local-coverage";

type Props = {
  samples: LocalCoverageSample[];
  operator: CoverageView;
  onOperatorChange: (operator: CoverageView) => void;
  enabled: boolean;
  onToggle: () => void;
  showHeat: boolean;
  onHeatChange: (enabled: boolean) => void;
  refreshingInSeconds: number;
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
    failedLookups, onSample, onInspect, enabled, onToggle, showHeat, onHeatChange, refreshingInSeconds } = props;
  return <section className="local-coverage-panel" aria-label="Local estimated mobile coverage">
    <div className="filter-head"><span className="eyebrow">MOBILE COVERAGE MAP</span>
      <span className="coverage-source">{enabled ? "Follows the map" : "On-demand"}</span></div>
    <p className="coverage-message">A softly shaded view of nearby Ofcom postcode samples. Panning automatically checks the new map centre when the rate limit allows. The shading suggests local patterns, not the real extent of coverage.</p>
    <div className="network-pills" aria-label="Network for map sample markers">
      {COVERAGE_VIEWS.map(network => <button key={network} type="button"
        className={"network-pill" + (operator === network ? " current" : "")}
        aria-pressed={operator === network} onClick={() => onOperatorChange(network)}>{network === "All" ? "All networks" : network}</button>)}
    </div>
    <div className="local-cover-controls">
      <button type="button" className="local-sample-button" aria-pressed={enabled} disabled={disabled}
        onClick={onToggle}>{enabled ? "Hide coverage layer" : "Show coverage heatmap"}</button>
      {enabled && <label className="local-heat-switch">
        <input type="checkbox" checked={showHeat} onChange={event => onHeatChange(event.target.checked)}/>
        Soft shading
      </label>}
    </div>
    {enabled && <button type="button" className="local-refresh-link" disabled={loading || disabled} onClick={onSample}>
      {loading ? "Checking nearby…" : "Refresh this area"}
    </button>}
    {error && <p role="alert" className="coverage-error">{error}</p>}
    {centreMoved && enabled && <p className="coverage-message">Map moved. Previous samples stay in view while nearby predictions update.</p>}
    {enabled && refreshingInSeconds > 1 && centreMoved && !loading &&
      <p role="status" className="coverage-message">Next automatic update in roughly {refreshingInSeconds} seconds to respect Ofcom request limits.</p>}
    {loading && <p role="status" className="coverage-message">Comparing a small set of nearby postcodes. Wi-Fi remains available.</p>}
    {enabled && samples.length > 0 && <>
      <p className="coverage-result-heading">{samples.length} nearby postcode samples · {operator === "All" ? "All networks" : operator}</p>
      <div className="local-coverage-list">
        {samples.map(sample => {
          const visual = sampleVisual(sample, operator);
          const value = visual.level;
          return <button className="local-coverage-item" key={sample.postcode}
            type="button" onClick={() => onInspect(sample.postcode)}>
            <strong>{sample.postcode}</strong>
            <span className={"coverage-rating coverage-rating-" + (value ?? "unknown")}>
              {visual.label}
            </span>
            <small>{operator === "All" ? visual.details : value === null ? visual.details : coverageDescription(value)}</small>
          </button>;
        })}
      </div>
      {failedLookups > 0 && <p className="coverage-message">{failedLookups} nearby queries could not be completed; missing samples are not zero coverage.</p>}
      <p className="coverage-legend">
        {operator === "All"
          ? "All networks counts only operators with a consistent indoor-capable prediction (score 3–4) at every returned property. A + means others could also qualify."
          : "Numbers are original Ofcom levels, shown only where all properties agree. ≠ means mixed property-level scores; ? means unknown."}
        {" "}Soft colour halos only show where a postcode has been sampled; they are not surveyed coverage polygons or predictions between points.
        Tap a sample for individual property results. No local coverage dataset is stored.
      </p>
      <div className="ofcom-attribution">
        <a href="https://www.ofcom.org.uk/mobile" target="_blank" rel="noopener noreferrer">
          <img src="https://www.ofcom.org.uk/siteassets/resources/images/illustrations/logos/powered-by-ofcom-api.png"
            width="156" height="42" alt="Powered by Ofcom API" />
        </a>
        <a className="local-ofcom-link" href="https://www.ofcom.org.uk/mobile" target="_blank" rel="noopener noreferrer">View official Ofcom checker</a>
      </div>
      <p className="coverage-disclaimer">Mobile coverage availability: Ofcom's information uses signal predictions supplied by mobile operators. It brings their estimates together using a shared independent approach; an operator's own checker may show a different result because of different assumptions about devices, service reliability and signal loss indoors or in vehicles. The underlying predictions are modelled, not measured at every property, and can be wrong. Ofcom and the operators update their data periodically, sometimes at different times. Please also check your mobile provider's coverage checker before relying on a prediction.</p>
    </>}
  </section>;
}
