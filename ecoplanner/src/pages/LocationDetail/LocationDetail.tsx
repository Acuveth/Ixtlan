import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDatabase } from '../../context/DatabaseContext';
import type { HistoricalMeasurement } from '../../db';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter,
} from 'recharts';

// Parameter metadata for display
const PARAM_META: Record<string, { label: string; unit: string; color: string }> = {
  ph: { label: 'pH', unit: '', color: '#8B5CF6' },
  oxygen: { label: 'Dissolved Oxygen', unit: 'mg/L', color: '#3B82F6' },
  conductivity: { label: 'Conductivity', unit: 'uS/cm', color: '#F59E0B' },
  temperature: { label: 'Temperature', unit: 'C', color: '#EF4444' },
  lead: { label: 'Lead (Pb)', unit: 'ug/L', color: '#6366F1' },
  mercury: { label: 'Mercury (Hg)', unit: 'ug/L', color: '#EC4899' },
  cadmium: { label: 'Cadmium (Cd)', unit: 'ug/L', color: '#14B8A6' },
  zinc: { label: 'Zinc (Zn)', unit: 'ug/L', color: '#F97316' },
  atrazine: { label: 'Atrazine', unit: 'ug/L', color: '#D946EF' },
  glyphosate: { label: 'Glyphosate', unit: 'ug/L', color: '#84CC16' },
  nitrate: { label: 'Nitrate (NO3)', unit: 'mg/L', color: '#22C55E' },
  phosphate: { label: 'Phosphate (PO4)', unit: 'mg/L', color: '#06B6D4' },
  ammonia: { label: 'Ammonia (NH3)', unit: 'mg/L', color: '#A855F7' },
};

const MEASUREMENT_TYPES = ['Basic Chemistry', 'Heavy Metals', 'Pesticides', 'Nutrients'];
const TYPE_COLORS: Record<string, string> = {
  'Basic Chemistry': '#3B82F6',
  'Heavy Metals': '#8B5CF6',
  'Pesticides': '#F97316',
  'Nutrients': '#22C55E',
};

type ViewMode = 'overview' | 'detailed' | 'annual';

function exportToExcel(location: { name: string; code: string }, data: HistoricalMeasurement[], selectedType: string) {
  if (data.length === 0) return;
  // Collect all parameter keys across all records
  const allKeys = new Set<string>();
  for (const h of data) { for (const k of Object.keys(h.results)) allKeys.add(k); }
  const paramKeys = Array.from(allKeys).sort();
  const paramHeaders = paramKeys.map(k => {
    const meta = PARAM_META[k];
    return meta ? `${meta.label}${meta.unit ? ` (${meta.unit})` : ''}` : k;
  });

  // BOM for UTF-8 Excel compatibility
  const BOM = '\uFEFF';
  const sep = ',';
  const rows: string[] = [];
  rows.push(['Date', 'Year', 'Measurement Type', ...paramHeaders].join(sep));
  for (const h of data) {
    const vals = paramKeys.map(k => h.results[k] != null ? String(h.results[k]) : '');
    rows.push([h.date, String(h.year), h.measurement_type, ...vals].join(sep));
  }
  const csv = BOM + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${location.code}_${selectedType.replace(/\s+/g, '_')}_data.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportAllToExcel(location: { name: string; code: string }, data: HistoricalMeasurement[]) {
  if (data.length === 0) return;
  const allKeys = new Set<string>();
  for (const h of data) { for (const k of Object.keys(h.results)) allKeys.add(k); }
  const paramKeys = Array.from(allKeys).sort();
  const paramHeaders = paramKeys.map(k => {
    const meta = PARAM_META[k];
    return meta ? `${meta.label}${meta.unit ? ` (${meta.unit})` : ''}` : k;
  });
  const BOM = '\uFEFF';
  const sep = ',';
  const rows: string[] = [];
  rows.push(['Date', 'Year', 'Measurement Type', ...paramHeaders].join(sep));
  for (const h of data) {
    const vals = paramKeys.map(k => h.results[k] != null ? String(h.results[k]) : '');
    rows.push([h.date, String(h.year), h.measurement_type, ...vals].join(sep));
  }
  const csv = BOM + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${location.code}_all_data.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const database = useDatabase();

  const [historical, setHistorical] = useState<HistoricalMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('Basic Chemistry');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [yearRange, setYearRange] = useState<[number, number]>([1996, 2026]);
  const [hiddenParams, setHiddenParams] = useState<Set<string>>(new Set());
  const [tableSearch, setTableSearch] = useState('');

  const toggleParam = (key: string) => {
    setHiddenParams(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const location = useMemo(() => {
    return database.locations.find(l => l.id === id);
  }, [database.locations, id]);

  // Load historical data
  useEffect(() => {
    if (!id || !database.ready) return;
    setLoading(true);
    database.getHistoricalMeasurements(id).then(data => {
      setHistorical(data);
      setLoading(false);
    });
  }, [id, database.ready, database.getHistoricalMeasurements]);

  // Current measurements from the monitoring system
  const currentMeasurements = useMemo(() => {
    return database.measurements.filter(m => m.location_id === id);
  }, [database.measurements, id]);

  // Filter historical by selected type and year range
  const filteredData = useMemo(() => {
    return historical.filter(h =>
      h.measurement_type === selectedType &&
      h.year >= yearRange[0] &&
      h.year <= yearRange[1]
    );
  }, [historical, selectedType, yearRange]);

  // Available measurement types for this location
  const availableTypes = useMemo(() => {
    const types = new Set(historical.map(h => h.measurement_type));
    return MEASUREMENT_TYPES.filter(t => types.has(t));
  }, [historical]);

  // Compute annual averages for the overview
  const annualAverages = useMemo(() => {
    const byYear = new Map<number, { count: number; sums: Record<string, number> }>();

    for (const h of filteredData) {
      let entry = byYear.get(h.year);
      if (!entry) {
        entry = { count: 0, sums: {} };
        byYear.set(h.year, entry);
      }
      entry.count++;
      for (const [key, val] of Object.entries(h.results)) {
        entry.sums[key] = (entry.sums[key] || 0) + val;
      }
    }

    return Array.from(byYear.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, { count, sums }]) => {
        const avg: Record<string, number | string> = { year: String(year) };
        for (const [key, total] of Object.entries(sums)) {
          avg[key] = Math.round((total / count) * 100) / 100;
        }
        return avg;
      });
  }, [filteredData]);

  // Get parameters for selected type
  const params = useMemo(() => {
    if (filteredData.length === 0) return [];
    const sampleResults = filteredData[0].results;
    return Object.keys(sampleResults).filter(k => PARAM_META[k]);
  }, [filteredData]);

  const visibleParams = useMemo(() => params.filter(k => !hiddenParams.has(k)), [params, hiddenParams]);

  // Stats summary
  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const result: Record<string, { min: number; max: number; avg: number; latest: number }> = {};
    for (const key of params) {
      const values = filteredData.map(d => d.results[key]).filter(v => v != null);
      if (values.length === 0) continue;
      result[key] = {
        min: Math.round(Math.min(...values) * 100) / 100,
        max: Math.round(Math.max(...values) * 100) / 100,
        avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
        latest: Math.round(values[values.length - 1] * 100) / 100,
      };
    }
    return result;
  }, [filteredData, params]);

  // Scatter data — all individual measurements
  const scatterData = useMemo(() => {
    return filteredData.map(h => ({
      date: new Date(h.date + 'T00:00:00').getTime(),
      ...h.results,
    }));
  }, [filteredData]);

  if (!database.ready) {
    return <div className="ld-loading">Loading database...</div>;
  }

  if (!location) {
    return (
      <div className="ld-notfound">
        <div className="ld-notfound-text">Location not found</div>
        <button className="ld-back-btn" onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  return (
    <>
      <div className="ld">
        {/* Header */}
        <div className="ld-header">
          <button className="ld-back" onClick={() => navigate(-1)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
          <div className="ld-header-main">
            <div className="ld-header-left">
              <h1 className="ld-name">{location.name}</h1>
              <div className="ld-meta">
                <span className="ld-code">{location.code}</span>
                <span className={`ld-rating ld-rating-${location.rating}`}>
                  {database.getRatingLabel(location.rating)}
                </span>
                <span className="ld-env">{location.environment_type}</span>
                <span className="ld-coords">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
              </div>
              {location.description && <p className="ld-desc">{location.description}</p>}
            </div>
            <div className="ld-header-stats">
              <div className="ld-stat">
                <div className="ld-stat-val">{historical.length}</div>
                <div className="ld-stat-label">Total records</div>
              </div>
              <div className="ld-stat">
                <div className="ld-stat-val">{availableTypes.length}</div>
                <div className="ld-stat-label">Measurement types</div>
              </div>
              <div className="ld-stat">
                <div className="ld-stat-val">{currentMeasurements.length}</div>
                <div className="ld-stat-label">Active measurements</div>
              </div>
              <div className="ld-stat">
                <div className="ld-stat-val">30</div>
                <div className="ld-stat-label">Years of data</div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="ld-loading">Loading historical data...</div>
        ) : (
          <>
            {/* Controls */}
            <div className="ld-controls">
              <div className="ld-type-tabs">
                {availableTypes.map(t => (
                  <button
                    key={t}
                    className={`ld-type-tab${selectedType === t ? ' active' : ''}`}
                    style={selectedType === t ? { borderColor: TYPE_COLORS[t], color: TYPE_COLORS[t] } : undefined}
                    onClick={() => setSelectedType(t)}
                  >
                    <span className="ld-type-dot" style={{ background: TYPE_COLORS[t] }} />
                    {t}
                  </button>
                ))}
              </div>
              <div className="ld-view-tabs">
                {(['overview', 'detailed', 'annual'] as ViewMode[]).map(v => (
                  <button
                    key={v}
                    className={`ld-view-tab${viewMode === v ? ' active' : ''}`}
                    onClick={() => setViewMode(v)}
                  >
                    {v === 'overview' ? 'Overview' : v === 'detailed' ? 'All Samples' : 'Annual Averages'}
                  </button>
                ))}
              </div>
              <div className="ld-export-btns">
                <button className="ld-export-btn" onClick={() => exportToExcel(location, filteredData, selectedType)} title={`Export ${selectedType} data as CSV`}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 13h8M8 3v7M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {selectedType}
                </button>
                <button className="ld-export-btn ld-export-all" onClick={() => exportAllToExcel(location, historical)} title="Export all measurement data as CSV">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 13h8M8 3v7M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  All data
                </button>
              </div>
              <div className="ld-year-range">
                <label>From</label>
                <select value={yearRange[0]} onChange={e => setYearRange([+e.target.value, yearRange[1]])}>
                  {Array.from({ length: 31 }, (_, i) => 1996 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <label>To</label>
                <select value={yearRange[1]} onChange={e => setYearRange([yearRange[0], +e.target.value])}>
                  {Array.from({ length: 31 }, (_, i) => 1996 + i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Parameter toggles */}
            {params.length > 0 && (
              <div className="ld-param-toggles">
                <span className="ld-param-toggles-label">Parameters:</span>
                {params.map(key => {
                  const meta = PARAM_META[key];
                  if (!meta) return null;
                  const active = !hiddenParams.has(key);
                  return (
                    <button
                      key={key}
                      className={`ld-param-chip${active ? ' active' : ''}`}
                      style={active ? { borderColor: meta.color, color: meta.color, background: meta.color + '12' } : undefined}
                      onClick={() => toggleParam(key)}
                    >
                      <span className="ld-param-chip-dot" style={{ background: active ? meta.color : 'var(--color-border-tertiary)' }} />
                      {meta.label}
                    </button>
                  );
                })}
                {hiddenParams.size > 0 && (
                  <button className="ld-param-chip-clear" onClick={() => setHiddenParams(new Set())}>Show all</button>
                )}
              </div>
            )}

            {/* Stats cards */}
            {stats && (
              <div className="ld-stats-grid">
                {visibleParams.map(key => {
                  const meta = PARAM_META[key];
                  const s = stats[key];
                  if (!meta || !s) return null;
                  return (
                    <div key={key} className="ld-param-card" style={{ borderLeftColor: meta.color }}>
                      <div className="ld-param-name">{meta.label}</div>
                      <div className="ld-param-latest">{s.latest} <span className="ld-param-unit">{meta.unit}</span></div>
                      <div className="ld-param-range">
                        <span>Min: {s.min}</span>
                        <span>Avg: {s.avg}</span>
                        <span>Max: {s.max}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Charts */}
            <div className="ld-charts">
              {viewMode === 'overview' && visibleParams.map(key => {
                const meta = PARAM_META[key];
                if (!meta) return null;
                return (
                  <div key={key} className="ld-chart-card">
                    <h3 className="ld-chart-title">{meta.label} {meta.unit && `(${meta.unit})`} — Annual Average</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={annualAverages}>
                        <defs>
                          <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={meta.color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={meta.color} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                        <XAxis dataKey="year" fontSize={11} tick={{ fill: 'var(--color-text-tertiary)' }} />
                        <YAxis fontSize={11} tick={{ fill: 'var(--color-text-tertiary)' }} />
                        <Tooltip
                          contentStyle={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 6, fontSize: 12 }}
                          labelStyle={{ fontWeight: 500 }}
                        />
                        <Area type="monotone" dataKey={key} stroke={meta.color} fill={`url(#grad-${key})`} strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}

              {viewMode === 'detailed' && (
                <div className="ld-chart-card ld-chart-full">
                  <h3 className="ld-chart-title">{selectedType} — All Individual Samples</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                      <XAxis
                        dataKey="date"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={v => new Date(v).getFullYear().toString()}
                        fontSize={11}
                        tick={{ fill: 'var(--color-text-tertiary)' }}
                      />
                      <YAxis fontSize={11} tick={{ fill: 'var(--color-text-tertiary)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 6, fontSize: 12 }}
                        labelFormatter={v => new Date(v as number).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      />
                      <Legend />
                      {visibleParams.map(key => {
                        const meta = PARAM_META[key];
                        if (!meta) return null;
                        return (
                          <Scatter
                            key={key}
                            name={meta.label}
                            data={scatterData}
                            fill={meta.color}
                            dataKey={key}
                            opacity={0.7}
                          />
                        );
                      })}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}

              {viewMode === 'annual' && (
                <div className="ld-chart-card ld-chart-full">
                  <h3 className="ld-chart-title">{selectedType} — Annual Averages (All Parameters)</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={annualAverages}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                      <XAxis dataKey="year" fontSize={11} tick={{ fill: 'var(--color-text-tertiary)' }} />
                      <YAxis fontSize={11} tick={{ fill: 'var(--color-text-tertiary)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 6, fontSize: 12 }}
                        labelStyle={{ fontWeight: 500 }}
                      />
                      <Legend />
                      {visibleParams.map(key => {
                        const meta = PARAM_META[key];
                        if (!meta) return null;
                        return (
                          <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            name={meta.label}
                            stroke={meta.color}
                            strokeWidth={2}
                            dot={false}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Data table */}
            <div className="ld-table-section">
              <div className="ld-table-header">
                <h3 className="ld-section-title">
                  Recent Measurements — {selectedType}
                  <span className="ld-section-count">{filteredData.length} records</span>
                </h3>
                <input
                  className="ld-table-search"
                  placeholder="Filter by date or value..."
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                />
              </div>
              <div className="ld-table-wrap">
                <table className="ld-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      {visibleParams.map(key => (
                        <th key={key}>{PARAM_META[key]?.label || key} {PARAM_META[key]?.unit && <span className="ld-th-unit">({PARAM_META[key].unit})</span>}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.slice(-50).reverse().filter(h => {
                      if (!tableSearch.trim()) return true;
                      const q = tableSearch.toLowerCase();
                      if (h.date.includes(q)) return true;
                      for (const key of visibleParams) {
                        if (h.results[key] != null && String(h.results[key]).includes(q)) return true;
                      }
                      return false;
                    }).map(h => (
                      <tr key={h.id}>
                        <td className="ld-td-date">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        {visibleParams.map(key => (
                          <td key={key}>{h.results[key] != null ? h.results[key] : '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
.ld{font-family:var(--font-sans);padding:16px 20px;max-width:1200px;margin:0 auto;overflow-y:auto;height:100%}
.ld-loading,.ld-notfound{display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;color:var(--color-text-secondary);font-size:14px;gap:12px}
.ld-back-btn{padding:6px 16px;border:1px solid var(--color-border-tertiary);border-radius:6px;background:var(--color-background-primary);cursor:pointer;color:var(--color-text-primary);font-family:var(--font-sans)}

/* Header */
.ld-header{margin-bottom:20px}
.ld-back{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:none;background:none;cursor:pointer;color:var(--color-text-secondary);font-size:12px;font-family:var(--font-sans);margin-bottom:8px;border-radius:4px}
.ld-back:hover{background:var(--color-background-secondary);color:var(--color-text-primary)}
.ld-header-main{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap}
.ld-header-left{flex:1;min-width:300px}
.ld-name{font-size:22px;font-weight:600;color:var(--color-text-primary);margin:0 0 6px}
.ld-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
.ld-code{font-size:11px;font-family:monospace;padding:2px 6px;border-radius:4px;background:var(--color-background-secondary);color:var(--color-text-secondary)}
.ld-rating{font-size:11px;font-weight:500;padding:2px 8px;border-radius:4px}
.ld-rating-very_poor{background:#FCEBEB;color:#E24B4A}
.ld-rating-poor{background:#FAECE7;color:#D85A30}
.ld-rating-moderate{background:#FAEEDA;color:#B8860B}
.ld-rating-good{background:#EAF3DE;color:#639922}
.ld-rating-very_good{background:#E1F5EE;color:#1D9E75}
.ld-env{font-size:11px;padding:2px 8px;border-radius:4px;background:var(--color-background-info);color:var(--color-text-info);text-transform:capitalize}
.ld-coords{font-size:11px;color:var(--color-text-tertiary)}
.ld-desc{font-size:13px;color:var(--color-text-secondary);margin:4px 0 0}

/* Header stats */
.ld-header-stats{display:flex;gap:12px;flex-shrink:0}
.ld-stat{text-align:center;padding:8px 14px;background:var(--color-background-secondary);border-radius:8px;min-width:80px}
.ld-stat-val{font-size:20px;font-weight:600;color:var(--color-text-primary)}
.ld-stat-label{font-size:10px;color:var(--color-text-tertiary);margin-top:2px}

/* Controls */
.ld-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px;padding:10px 12px;background:var(--color-background-secondary);border-radius:8px}
.ld-type-tabs{display:flex;gap:4px}
.ld-type-tab{display:flex;align-items:center;gap:5px;padding:5px 10px;border:1.5px solid var(--color-border-tertiary);border-radius:6px;background:var(--color-background-primary);cursor:pointer;font-family:var(--font-sans);font-size:12px;font-weight:500;color:var(--color-text-secondary);transition:.15s}
.ld-type-tab:hover{border-color:var(--color-border-secondary)}
.ld-type-tab.active{background:var(--color-background-primary);font-weight:600}
.ld-type-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.ld-view-tabs{display:flex;gap:0;border:1px solid var(--color-border-tertiary);border-radius:6px;overflow:hidden;margin-left:auto}
.ld-view-tab{padding:5px 12px;border:none;background:transparent;cursor:pointer;font-family:var(--font-sans);font-size:11px;font-weight:500;color:var(--color-text-secondary);transition:.15s}
.ld-view-tab.active{background:var(--color-text-info);color:white}
.ld-view-tab:not(.active):hover{background:var(--color-background-primary)}
.ld-export-btns{display:flex;gap:4px;margin-left:8px}
.ld-export-btn{display:flex;align-items:center;gap:4px;padding:5px 10px;border:1px solid var(--color-border-tertiary);border-radius:6px;background:var(--color-background-primary);cursor:pointer;font-family:var(--font-sans);font-size:11px;font-weight:500;color:var(--color-text-secondary);transition:.15s;white-space:nowrap}
.ld-export-btn:hover{border-color:#1D9E75;color:#1D9E75;background:#E1F5EE}
.ld-export-all{border-color:var(--color-border-info);color:var(--color-text-info)}
.ld-export-all:hover{background:var(--color-background-info)}
.ld-year-range{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--color-text-secondary)}
.ld-year-range select{padding:3px 6px;border:1px solid var(--color-border-tertiary);border-radius:4px;font-size:11px;background:var(--color-background-primary);color:var(--color-text-primary);font-family:var(--font-sans)}

/* Parameter toggles */
.ld-param-toggles{display:flex;align-items:center;gap:5px;margin-bottom:12px;flex-wrap:wrap}
.ld-param-toggles-label{font-size:11px;font-weight:500;color:var(--color-text-secondary);margin-right:4px}
.ld-param-chip{display:flex;align-items:center;gap:4px;padding:3px 10px;border:1.5px solid var(--color-border-tertiary);border-radius:20px;background:var(--color-background-primary);cursor:pointer;font-family:var(--font-sans);font-size:11px;font-weight:500;color:var(--color-text-tertiary);transition:.15s}
.ld-param-chip:hover{border-color:var(--color-border-secondary)}
.ld-param-chip.active{font-weight:600}
.ld-param-chip-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.ld-param-chip-clear{border:none;background:none;color:var(--color-text-info);font-size:10px;cursor:pointer;font-family:var(--font-sans);padding:3px 6px}
.ld-param-chip-clear:hover{text-decoration:underline}

/* Table header with search */
.ld-table-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.ld-table-search{padding:5px 10px;border:1px solid var(--color-border-tertiary);border-radius:6px;font-size:11px;font-family:var(--font-sans);color:var(--color-text-primary);background:var(--color-background-secondary);outline:none;width:180px}
.ld-table-search:focus{border-color:var(--color-border-info)}

/* Stats grid */
.ld-stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:16px}
.ld-param-card{padding:10px 12px;background:var(--color-background-primary);border:1px solid var(--color-border-tertiary);border-left:3px solid;border-radius:8px}
.ld-param-name{font-size:11px;color:var(--color-text-secondary);font-weight:500;margin-bottom:4px}
.ld-param-latest{font-size:20px;font-weight:600;color:var(--color-text-primary)}
.ld-param-unit{font-size:11px;font-weight:400;color:var(--color-text-tertiary)}
.ld-param-range{display:flex;gap:10px;font-size:10px;color:var(--color-text-tertiary);margin-top:4px}

/* Charts */
.ld-charts{display:grid;grid-template-columns:repeat(auto-fill,minmax(450px,1fr));gap:12px;margin-bottom:20px}
.ld-chart-card{padding:14px;background:var(--color-background-primary);border:1px solid var(--color-border-tertiary);border-radius:8px}
.ld-chart-full{grid-column:1/-1}
.ld-chart-title{font-size:13px;font-weight:500;color:var(--color-text-primary);margin:0 0 10px}

/* Table */
.ld-table-section{margin-bottom:24px}
.ld-section-title{font-size:14px;font-weight:500;color:var(--color-text-primary);margin:0 0 10px;display:flex;align-items:center;gap:8px}
.ld-section-count{font-size:11px;font-weight:400;color:var(--color-text-tertiary);padding:1px 6px;background:var(--color-background-secondary);border-radius:4px}
.ld-table-wrap{overflow-x:auto;border:1px solid var(--color-border-tertiary);border-radius:8px}
.ld-table{width:100%;border-collapse:collapse;font-size:12px}
.ld-table th{padding:8px 12px;text-align:left;font-weight:500;color:var(--color-text-secondary);background:var(--color-background-secondary);border-bottom:1px solid var(--color-border-tertiary);white-space:nowrap}
.ld-th-unit{font-weight:400;color:var(--color-text-tertiary);font-size:10px}
.ld-table td{padding:6px 12px;border-bottom:1px solid var(--color-border-tertiary);color:var(--color-text-primary)}
.ld-table tr:last-child td{border-bottom:none}
.ld-table tr:hover td{background:var(--color-background-secondary)}
.ld-td-date{font-weight:500;white-space:nowrap;color:var(--color-text-secondary)}

@media(max-width:768px){
  .ld{padding:12px}
  .ld-header-main{flex-direction:column}
  .ld-header-stats{flex-wrap:wrap}
  .ld-charts{grid-template-columns:1fr}
  .ld-controls{flex-direction:column;align-items:stretch}
  .ld-type-tabs{flex-wrap:wrap}
  .ld-view-tabs{margin-left:0}
}
      `}</style>
    </>
  );
}
