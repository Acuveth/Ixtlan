import { useState, useMemo } from 'react';
import type { Entry, Rating, Freq, Program, WaterBody } from './planData';
import {
  WORKERS, WATERWAYS, MEASUREMENTS, FREQS, PROGRAMS,
  LAKE_MEASUREMENTS, SEA_MEASUREMENTS, SOIL_MEASUREMENTS,
  LAKES, SEA_STATIONS, SOIL_SITES,
  RATING_COLORS, RATING_LABELS, FREQ_LABELS,
} from './planData';

const PROGRAM_CONFIG: Record<Program, {
  sites: string[];
  measurements: { name: string; cost: number }[];
  waterBody: WaterBody;
  siteLabel: string;
  codePrefix: string;
  placeholder: string;
}> = {
  river: { sites: WATERWAYS, measurements: MEASUREMENTS, waterBody: 'river', siteLabel: 'Waterway', codePrefix: 'RIV', placeholder: 'e.g. Sava — Litija upstream' },
  lake:  { sites: LAKES, measurements: LAKE_MEASUREMENTS, waterBody: 'lake', siteLabel: 'Lake', codePrefix: 'LK', placeholder: 'e.g. Jezero Bled — North shore' },
  sea:   { sites: SEA_STATIONS, measurements: SEA_MEASUREMENTS, waterBody: 'reservoir', siteLabel: 'Station', codePrefix: 'SEA', placeholder: 'e.g. Piran — Offshore S4' },
  soil:  { sites: SOIL_SITES, measurements: SOIL_MEASUREMENTS, waterBody: 'river', siteLabel: 'Site', codePrefix: 'SOL', placeholder: 'e.g. Celje — Bukovžlak NW' },
};

interface Props {
  entries: Entry[];
  defaultDate: string;
  onAdd: (entry: Entry) => void;
  onClose: () => void;
}

type Mode = 'database' | 'custom';

let _addId = Date.now();
function uid() { return `add-${_addId++}`; }

export default function AddEntryModal({ entries, defaultDate, onAdd, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('database');

  // --- Database mode: pick existing location ---
  const [dbSearch, setDbSearch] = useState('');
  const [dbSelectedLoc, setDbSelectedLoc] = useState<string | null>(null);
  const [dbMeas, setDbMeas] = useState(MEASUREMENTS[0].name);
  const [dbFreq, setDbFreq] = useState<Freq>('quarterly');
  const [dbWorker, setDbWorker] = useState('');
  const [dbDate, setDbDate] = useState(defaultDate);

  // Unique locations from entries
  const locations = useMemo(() => {
    const map = new Map<string, { locationId: string; locationName: string; locationCode: string; river: string; rating: Rating; waterBody: WaterBody; program: Program }>();
    for (const e of entries) {
      if (!map.has(e.locationId)) {
        map.set(e.locationId, {
          locationId: e.locationId,
          locationName: e.locationName,
          locationCode: e.locationCode,
          river: e.river,
          rating: e.rating,
          waterBody: e.waterBody,
          program: e.program,
        });
      }
    }
    return Array.from(map.values());
  }, [entries]);

  const filteredLocs = useMemo(() => {
    if (!dbSearch) return locations.slice(0, 50);
    const q = dbSearch.toLowerCase();
    return locations.filter(l =>
      l.locationName.toLowerCase().includes(q) ||
      l.locationCode.toLowerCase().includes(q) ||
      l.river.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [locations, dbSearch]);

  const selectedLocData = dbSelectedLoc ? locations.find(l => l.locationId === dbSelectedLoc) : null;

  // Measurements already on this location
  const existingMeasOnLoc = useMemo(() => {
    if (!dbSelectedLoc) return new Set<string>();
    return new Set(entries.filter(e => e.locationId === dbSelectedLoc).map(e => e.measurement));
  }, [entries, dbSelectedLoc]);

  // All measurements for context-appropriate list
  const availableMeasurements = useMemo(() => {
    // Show all MEASUREMENTS; mark ones already on location
    return MEASUREMENTS.map(m => ({
      ...m,
      existing: existingMeasOnLoc.has(m.name),
    }));
  }, [existingMeasOnLoc]);

  const handleDbAdd = () => {
    if (!selectedLocData) return;
    const meas = MEASUREMENTS.find(m => m.name === dbMeas);
    if (!meas) return;
    onAdd({
      id: uid(),
      locationId: selectedLocData.locationId,
      locationName: selectedLocData.locationName,
      locationCode: selectedLocData.locationCode,
      rating: selectedLocData.rating,
      river: selectedLocData.river,
      program: selectedLocData.program,
      waterBody: selectedLocData.waterBody,
      measurement: dbMeas,
      frequency: dbFreq,
      assigneeId: dbWorker,
      status: 'planned',
      nextDate: dbDate,
      cost: meas.cost,
    });
  };

  // --- Custom mode ---
  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('');
  const [cProgram, setCProgram] = useState<Program>('river');
  const [cSite, setCSite] = useState(WATERWAYS[0]);
  const [cSiteCustom, setCSiteCustom] = useState('');
  const [cUseCustomSite, setCUseCustomSite] = useState(false);
  const [cMeas, setCMeas] = useState(MEASUREMENTS[0].name);
  const [cMeasCustom, setCMeasCustom] = useState('');
  const [cCost, setCCost] = useState(MEASUREMENTS[0].cost);
  const [cUseCustomMeas, setCUseCustomMeas] = useState(false);
  const [cFreq, setCFreq] = useState<Freq>('quarterly');
  const [cWorker, setCWorker] = useState('');
  const [cDate, setCDate] = useState(defaultDate);

  const programCfg = PROGRAM_CONFIG[cProgram];

  // Reset site + measurement when program changes
  const handleProgramChange = (p: Program) => {
    setCProgram(p);
    const cfg = PROGRAM_CONFIG[p];
    setCSite(cfg.sites[0]);
    setCMeas(cfg.measurements[0].name);
    setCCost(cfg.measurements[0].cost);
    setCUseCustomSite(false);
    setCUseCustomMeas(false);
  };

  const handleCustomAdd = () => {
    const site = cUseCustomSite ? cSiteCustom : cSite;
    const measurement = cUseCustomMeas ? cMeasCustom : cMeas;
    const cost = cUseCustomMeas ? cCost : (programCfg.measurements.find(m => m.name === cMeas)?.cost ?? cCost);
    if (!site.trim() || !measurement.trim()) return;
    onAdd({
      id: uid(),
      locationId: uid(),
      locationName: cName || `${site} — New station`,
      locationCode: cCode || `${programCfg.codePrefix}-${String(Date.now()).slice(-6)}`,
      rating: 'moderate',
      river: site,
      program: cProgram,
      waterBody: programCfg.waterBody,
      measurement,
      frequency: cFreq,
      assigneeId: cWorker,
      status: 'planned',
      nextDate: cDate,
      cost,
    });
  };

  return (
    <>
      <style>{MODAL_CSS}</style>
      <div className="aem-overlay" onClick={onClose}>
        <div className="aem-modal" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="aem-header">
            <h2 className="aem-title">Add Measurement Entry</h2>
            <button className="aem-close" onClick={onClose}>&times;</button>
          </div>

          {/* Mode tabs */}
          <div className="aem-tabs">
            <button className={`aem-tab${mode === 'database' ? ' aem-tab-active' : ''}`} onClick={() => setMode('database')}>
              Select from database
            </button>
            <button className={`aem-tab${mode === 'custom' ? ' aem-tab-active' : ''}`} onClick={() => setMode('custom')}>
              Custom entry
            </button>
          </div>

          <div className="aem-body">
            {/* ========== DATABASE MODE ========== */}
            {mode === 'database' && !selectedLocData && (
              /* Step 1: Pick a location */
              <div className="aem-section">
                <span className="aem-label">Select a location</span>
                <input
                  className="aem-input"
                  placeholder="Search by name, code, or waterway..."
                  value={dbSearch}
                  onChange={e => setDbSearch(e.target.value)}
                />
                <div className="aem-loc-list">
                  {filteredLocs.map(loc => (
                    <div
                      key={loc.locationId}
                      className="aem-loc-item"
                      onClick={() => setDbSelectedLoc(loc.locationId)}
                    >
                      <div className="aem-loc-name">{loc.locationName}</div>
                      <div className="aem-loc-meta">
                        <span className="aem-loc-code">{loc.locationCode}</span>
                        <span className="aem-loc-river">{loc.river}</span>
                        <span className="aem-loc-rating" style={{ background: RATING_COLORS[loc.rating] }}>{RATING_LABELS[loc.rating]}</span>
                      </div>
                    </div>
                  ))}
                  {filteredLocs.length === 0 && <div className="aem-empty">No locations found</div>}
                </div>
              </div>
            )}

            {mode === 'database' && selectedLocData && (
              /* Step 2: Configure the entry */
              <>
                {/* Back + selected banner */}
                <div className="aem-selected-banner">
                  <div className="aem-banner-top">
                    <button className="aem-back-btn" onClick={() => setDbSelectedLoc(null)}>&larr; Change location</button>
                  </div>
                  <strong>{selectedLocData.locationName}</strong>
                  <span>{selectedLocData.locationCode} · {selectedLocData.river} · <span className="aem-inline-rating" style={{ background: RATING_COLORS[selectedLocData.rating] }}>{RATING_LABELS[selectedLocData.rating]}</span></span>
                </div>

                {/* Measurement */}
                <div className="aem-section">
                  <span className="aem-label">Measurement type</span>
                  <div className="aem-meas-grid">
                    {availableMeasurements.map(m => (
                      <button
                        key={m.name}
                        className={`aem-meas-btn${dbMeas === m.name ? ' aem-meas-active' : ''}${m.existing ? ' aem-meas-existing' : ''}`}
                        onClick={() => setDbMeas(m.name)}
                      >
                        <span>{m.name}</span>
                        <span className="aem-meas-cost">€{m.cost}</span>
                        {m.existing && <span className="aem-meas-tag">exists</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frequency + Worker + Date */}
                <div className="aem-row">
                  <div className="aem-field">
                    <span className="aem-label">Frequency</span>
                    <select className="aem-select" value={dbFreq} onChange={e => setDbFreq(e.target.value as Freq)}>
                      {FREQS.map(f => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
                    </select>
                  </div>
                  <div className="aem-field">
                    <span className="aem-label">Assignee</span>
                    <select className="aem-select" value={dbWorker} onChange={e => setDbWorker(e.target.value)}>
                      <option value="">Unassigned</option>
                      {WORKERS.filter(w => w.id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="aem-field">
                    <span className="aem-label">Next date</span>
                    <input className="aem-select" type="date" value={dbDate} onChange={e => setDbDate(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {/* ========== CUSTOM MODE ========== */}
            {mode === 'custom' && (
              <>
                {/* Program selector */}
                <div className="aem-section">
                  <span className="aem-label">Program</span>
                  <div className="aem-program-row">
                    {PROGRAMS.map(p => (
                      <button
                        key={p.key}
                        className={`aem-program-btn${cProgram === p.key ? ' aem-program-active' : ''}`}
                        onClick={() => handleProgramChange(p.key)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Site / location */}
                <div className="aem-section">
                  <div className="aem-label-row">
                    <span className="aem-label">{programCfg.siteLabel}</span>
                    <label className="aem-toggle-label">
                      <input type="checkbox" checked={cUseCustomSite} onChange={() => setCUseCustomSite(!cUseCustomSite)} />
                      Custom
                    </label>
                  </div>
                  {cUseCustomSite ? (
                    <input className="aem-input" placeholder={`Enter ${programCfg.siteLabel.toLowerCase()} name...`} value={cSiteCustom} onChange={e => setCSiteCustom(e.target.value)} />
                  ) : (
                    <select className="aem-select aem-select-full" value={cSite} onChange={e => setCSite(e.target.value)}>
                      {programCfg.sites.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>

                {/* Location name + code */}
                <div className="aem-row">
                  <div className="aem-field" style={{ flex: 2 }}>
                    <span className="aem-label">Location name <span className="aem-optional">optional — auto-generated if empty</span></span>
                    <input className="aem-input" placeholder={programCfg.placeholder} value={cName} onChange={e => setCName(e.target.value)} />
                  </div>
                  <div className="aem-field">
                    <span className="aem-label">Code <span className="aem-optional">optional</span></span>
                    <input className="aem-input" placeholder={`e.g. ${programCfg.codePrefix}-0042`} value={cCode} onChange={e => setCCode(e.target.value)} />
                  </div>
                </div>

                {/* Measurement — driven by program */}
                <div className="aem-section">
                  <div className="aem-label-row">
                    <span className="aem-label">Measurement</span>
                    <label className="aem-toggle-label">
                      <input type="checkbox" checked={cUseCustomMeas} onChange={() => setCUseCustomMeas(!cUseCustomMeas)} />
                      Custom
                    </label>
                  </div>
                  {cUseCustomMeas ? (
                    <div className="aem-row">
                      <div className="aem-field" style={{ flex: 2 }}>
                        <input className="aem-input" placeholder="Measurement name..." value={cMeasCustom} onChange={e => setCMeasCustom(e.target.value)} />
                      </div>
                      <div className="aem-field">
                        <input className="aem-input" type="number" placeholder="Cost €" value={cCost} onChange={e => setCCost(Number(e.target.value))} />
                      </div>
                    </div>
                  ) : (
                    <div className="aem-meas-grid">
                      {programCfg.measurements.map(m => (
                        <button
                          key={m.name}
                          className={`aem-meas-btn${cMeas === m.name ? ' aem-meas-active' : ''}`}
                          onClick={() => { setCMeas(m.name); setCCost(m.cost); }}
                        >
                          <span>{m.name}</span>
                          <span className="aem-meas-cost">€{m.cost}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Frequency + Worker + Date */}
                <div className="aem-row">
                  <div className="aem-field">
                    <span className="aem-label">Frequency</span>
                    <select className="aem-select" value={cFreq} onChange={e => setCFreq(e.target.value as Freq)}>
                      {FREQS.map(f => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
                    </select>
                  </div>
                  <div className="aem-field">
                    <span className="aem-label">Assignee</span>
                    <select className="aem-select" value={cWorker} onChange={e => setCWorker(e.target.value)}>
                      <option value="">Unassigned</option>
                      {WORKERS.filter(w => w.id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="aem-field">
                    <span className="aem-label">Next date</span>
                    <input className="aem-select" type="date" value={cDate} onChange={e => setCDate(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="aem-footer">
            <button className="aem-cancel" onClick={onClose}>Cancel</button>
            <button
              className="aem-submit"
              disabled={mode === 'database' ? !selectedLocData : !(cUseCustomSite ? cSiteCustom.trim() : cSite)}
              onClick={mode === 'database' ? handleDbAdd : handleCustomAdd}
            >
              Add entry
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const MODAL_CSS = `
.aem-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-family:var(--font-sans)}
.aem-modal{background:var(--color-background-primary);border-radius:10px;width:640px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.18);border:0.5px solid var(--color-border-tertiary)}

/* Header */
.aem-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:0.5px solid var(--color-border-tertiary)}
.aem-title{margin:0;font-size:15px;font-weight:600;color:var(--color-text-primary)}
.aem-close{background:none;border:0.5px solid var(--color-border-tertiary);border-radius:4px;width:26px;height:26px;font-size:16px;cursor:pointer;color:var(--color-text-secondary);display:flex;align-items:center;justify-content:center;line-height:1}
.aem-close:hover{background:var(--color-background-secondary);color:var(--color-text-primary)}

/* Tabs */
.aem-tabs{display:flex;border-bottom:0.5px solid var(--color-border-tertiary)}
.aem-tab{flex:1;padding:9px 16px;font-size:12px;font-weight:500;color:var(--color-text-secondary);background:none;border:none;cursor:pointer;font-family:var(--font-sans);border-bottom:2px solid transparent;transition:all .15s}
.aem-tab:hover{color:var(--color-text-primary);background:var(--color-background-secondary)}
.aem-tab-active{color:#378ADD;border-bottom-color:#378ADD;font-weight:600}

/* Body */
.aem-body{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px}

/* Shared form elements */
.aem-section{display:flex;flex-direction:column;gap:5px}
.aem-label{font-size:11px;font-weight:600;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.3px}
.aem-label-row{display:flex;align-items:center;justify-content:space-between}
.aem-optional{font-weight:400;text-transform:none;letter-spacing:0;color:var(--color-text-tertiary);font-size:10px}
.aem-toggle-label{font-size:10px;color:var(--color-text-secondary);display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:500}
.aem-toggle-label input{accent-color:#378ADD;margin:0}
.aem-input{padding:7px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:12px;color:var(--color-text-primary);font-family:var(--font-sans);outline:none;background:var(--color-background-primary);width:100%;box-sizing:border-box}
.aem-input:focus{border-color:#378ADD;box-shadow:0 0 0 2px rgba(55,138,221,0.1)}
.aem-select{padding:7px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:12px;color:var(--color-text-primary);font-family:var(--font-sans);outline:none;background:var(--color-background-primary);cursor:pointer;width:100%;box-sizing:border-box}
.aem-select:focus{border-color:#378ADD}
.aem-select-full{width:100%}
.aem-row{display:flex;gap:10px}
.aem-field{flex:1;display:flex;flex-direction:column;gap:4px}

/* Location list (database mode) */
.aem-loc-list{max-height:180px;overflow-y:auto;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);background:var(--color-background-secondary)}
.aem-loc-item{padding:7px 10px;cursor:pointer;border-bottom:0.5px solid var(--color-border-tertiary);transition:background .1s}
.aem-loc-item:last-child{border-bottom:none}
.aem-loc-item:hover{background:var(--color-background-primary)}
.aem-loc-selected{background:#EBF3FB !important;border-left:3px solid #378ADD}
.aem-loc-name{font-size:12px;font-weight:500;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aem-loc-meta{display:flex;gap:6px;align-items:center;margin-top:2px}
.aem-loc-code{font-size:9px;color:var(--color-text-tertiary)}
.aem-loc-river{font-size:9px;color:var(--color-text-secondary)}
.aem-loc-rating{font-size:8px;padding:0 4px;border-radius:2px;color:#fff;font-weight:500}
.aem-empty{padding:16px;text-align:center;font-size:11px;color:var(--color-text-tertiary)}

/* Selected location banner */
.aem-selected-banner{padding:10px 12px;background:#EBF3FB;border-radius:var(--border-radius-md);border:0.5px solid #378ADD44;display:flex;flex-direction:column;gap:3px}
.aem-selected-banner strong{font-size:13px;color:var(--color-text-primary)}
.aem-selected-banner span{font-size:10px;color:var(--color-text-secondary)}
.aem-banner-top{margin-bottom:2px}
.aem-back-btn{background:none;border:none;color:#378ADD;font-size:11px;font-weight:500;cursor:pointer;padding:0;font-family:var(--font-sans)}
.aem-back-btn:hover{text-decoration:underline}
.aem-inline-rating{font-size:8px;padding:1px 5px;border-radius:2px;color:#fff;font-weight:500}

/* Measurement grid */
.aem-meas-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4px}
.aem-meas-btn{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);background:var(--color-background-primary);cursor:pointer;font-size:11px;color:var(--color-text-primary);font-family:var(--font-sans);transition:all .12s;text-align:left;position:relative}
.aem-meas-btn:hover{border-color:var(--color-border-info);background:var(--color-background-secondary)}
.aem-meas-active{border-color:#378ADD;background:#EBF3FB;font-weight:600;color:#378ADD}
.aem-meas-existing{opacity:0.6}
.aem-meas-cost{font-size:10px;color:var(--color-text-tertiary);font-weight:400}
.aem-meas-tag{position:absolute;top:2px;right:4px;font-size:8px;color:#BA7517;font-weight:500}

/* Program selector */
.aem-program-row{display:flex;gap:4px}
.aem-program-btn{flex:1;padding:7px 4px;border:1px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:11px;font-weight:500;cursor:pointer;font-family:var(--font-sans);background:var(--color-background-primary);color:var(--color-text-secondary);transition:all .12s;text-align:center}
.aem-program-btn:hover{background:var(--color-background-secondary);color:var(--color-text-primary)}
.aem-program-active{background:#378ADD;color:#fff;border-color:#378ADD;font-weight:600}
.aem-program-active:hover{background:#2a7acc;color:#fff}

/* Rating row */
.aem-rating-row{display:flex;gap:4px}
.aem-rating-btn{flex:1;padding:5px 4px;border:1.5px solid;border-radius:var(--border-radius-md);font-size:10px;font-weight:600;cursor:pointer;font-family:var(--font-sans);background:var(--color-background-primary);transition:all .12s;text-align:center}
.aem-rating-btn:hover{opacity:0.85}
.aem-rating-active{color:#fff !important}

/* Footer */
.aem-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:0.5px solid var(--color-border-tertiary)}
.aem-cancel{padding:7px 16px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-primary);font-size:12px;cursor:pointer;font-family:var(--font-sans)}
.aem-cancel:hover{background:var(--color-background-secondary)}
.aem-submit{padding:7px 20px;border:none;border-radius:var(--border-radius-md);background:#378ADD;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-sans)}
.aem-submit:hover:not(:disabled){opacity:0.9}
.aem-submit:disabled{opacity:0.45;cursor:not-allowed}

@media(max-width:640px){
  .aem-modal{width:100%;border-radius:0;max-height:100vh}
  .aem-meas-grid{grid-template-columns:1fr}
  .aem-row{flex-direction:column;gap:8px}
  .aem-rating-row{flex-wrap:wrap}
}
`;
