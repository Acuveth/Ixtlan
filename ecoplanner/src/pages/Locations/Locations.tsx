import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../../context/DatabaseContext';

const RATING_LABELS: Record<string, string> = { very_poor: 'Very poor', poor: 'Poor', moderate: 'Moderate', good: 'Good', very_good: 'Very good' };
const RATING_COLORS: Record<string, string> = { very_poor: '#E24B4A', poor: '#D85A30', moderate: '#EF9F27', good: '#639922', very_good: '#1D9E75' };
const ENV_LABELS: Record<string, string> = { water: 'Water', soil: 'Soil', air: 'Air', organisms: 'Organisms' };
const PROGRAM_LABELS: Record<string, string> = { river: 'River', lake: 'Lake', sea: 'Sea', soil: 'Soil', air: 'Air' };

type SortKey = 'name' | 'code' | 'rating' | 'environment_type' | 'visits' | 'measurements';
const RATING_ORDER = ['very_poor', 'poor', 'moderate', 'good', 'very_good'];

export default function Locations() {
  const db = useDatabase();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterEnv, setFilterEnv] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterMeasType, setFilterMeasType] = useState('');
  const [filterFieldWorker, setFilterFieldWorker] = useState('');
  const [filterLabWorker, setFilterLabWorker] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Lookup maps
  const visitCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of db.visits) m.set(v.location_id, (m.get(v.location_id) || 0) + 1);
    return m;
  }, [db.visits]);

  const measCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const ms of db.measurements) m.set(ms.location_id, (m.get(ms.location_id) || 0) + 1);
    return m;
  }, [db.measurements]);

  const latestVisit = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of db.visits) {
      const cur = m.get(v.location_id);
      if (!cur || v.planned_date > cur) m.set(v.location_id, v.planned_date);
    }
    return m;
  }, [db.visits]);

  // Build per-location sets for cross-reference filters
  const locMeasTypes = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const ms of db.measurements) {
      const tpl = db.measurementTemplates.find(t => t.id === ms.measurement_template_id);
      if (tpl) {
        let s = m.get(ms.location_id);
        if (!s) { s = new Set(); m.set(ms.location_id, s); }
        s.add(tpl.name);
      }
    }
    return m;
  }, [db.measurements, db.measurementTemplates]);

  const locFieldWorkers = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const ms of db.measurements) {
      if (ms.assignee_id) {
        let s = m.get(ms.location_id);
        if (!s) { s = new Set(); m.set(ms.location_id, s); }
        s.add(ms.assignee_id);
      }
    }
    return m;
  }, [db.measurements]);

  const locLabWorkers = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const ms of db.measurements) {
      if (ms.lab_assignee_id) {
        let s = m.get(ms.location_id);
        if (!s) { s = new Set(); m.set(ms.location_id, s); }
        s.add(ms.lab_assignee_id);
      }
    }
    return m;
  }, [db.measurements]);

  const locPrograms = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const pe of db.planEntries) {
      const plan = db.monitoringPlans.find(p => p.id === pe.plan_id);
      if (plan) {
        let s = m.get(pe.location_id);
        if (!s) { s = new Set(); m.set(pe.location_id, s); }
        s.add(plan.program_type);
      }
    }
    return m;
  }, [db.planEntries, db.monitoringPlans]);

  // Unique values for dropdown options
  const measTypeOptions = useMemo(() => Array.from(new Set(db.measurementTemplates.map(t => t.name))).sort(), [db.measurementTemplates]);

  const fieldWorkerOptions = useMemo(() => {
    const ids = new Set(db.measurements.map(m => m.assignee_id).filter(Boolean) as string[]);
    return db.users.filter(u => ids.has(u.id)).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [db.measurements, db.users]);

  const labWorkerOptions = useMemo(() => {
    const ids = new Set(db.measurements.map(m => m.lab_assignee_id).filter(Boolean) as string[]);
    return db.users.filter(u => ids.has(u.id)).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [db.measurements, db.users]);

  const programOptions = useMemo(() => {
    const types = new Set(db.monitoringPlans.map(p => p.program_type));
    return Array.from(types).sort();
  }, [db.monitoringPlans]);

  const regions = useMemo(() => {
    const r = new Set<string>();
    for (const l of db.locations) {
      if (l.description) {
        const match = l.description.match(/in\s+(.+)$/);
        if (match) r.add(match[1]);
      }
    }
    return Array.from(r).sort();
  }, [db.locations]);

  const filtered = useMemo(() => {
    let list = [...db.locations];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q));
    }
    if (filterRating) list = list.filter(l => l.rating === filterRating);
    if (filterEnv) list = list.filter(l => l.environment_type === filterEnv);
    if (filterRegion) list = list.filter(l => (l.description || '').includes(filterRegion));
    if (filterMeasType) list = list.filter(l => locMeasTypes.get(l.id)?.has(filterMeasType));
    if (filterFieldWorker) list = list.filter(l => locFieldWorkers.get(l.id)?.has(filterFieldWorker));
    if (filterLabWorker) list = list.filter(l => locLabWorkers.get(l.id)?.has(filterLabWorker));
    if (filterProgram) list = list.filter(l => locPrograms.get(l.id)?.has(filterProgram));

    const dir = sortAsc ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'name': return a.name.localeCompare(b.name) * dir;
        case 'code': return a.code.localeCompare(b.code) * dir;
        case 'rating': return (RATING_ORDER.indexOf(a.rating) - RATING_ORDER.indexOf(b.rating)) * dir;
        case 'environment_type': return a.environment_type.localeCompare(b.environment_type) * dir;
        case 'visits': return ((visitCounts.get(a.id) || 0) - (visitCounts.get(b.id) || 0)) * dir;
        case 'measurements': return ((measCounts.get(a.id) || 0) - (measCounts.get(b.id) || 0)) * dir;
      }
    });
    return list;
  }, [db.locations, search, filterRating, filterEnv, filterRegion, filterMeasType, filterFieldWorker, filterLabWorker, filterProgram, sortKey, sortAsc, visitCounts, measCounts, locMeasTypes, locFieldWorkers, locLabWorkers, locPrograms]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc); else { setSortKey(key); setSortAsc(true); }
  };
  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? ' \u25B2' : ' \u25BC') : '';

  const ratingCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of db.locations) c[l.rating] = (c[l.rating] || 0) + 1;
    return c;
  }, [db.locations]);

  const hasActiveFilters = !!(search || filterRating || filterEnv || filterRegion || filterMeasType || filterFieldWorker || filterLabWorker || filterProgram);
  const clearAll = () => {
    setSearch(''); setFilterRating(''); setFilterEnv(''); setFilterRegion('');
    setFilterMeasType(''); setFilterFieldWorker(''); setFilterLabWorker(''); setFilterProgram('');
  };

  return (
    <>
      <style>{css}</style>
      <div className="lp">
        <div className="lp-header">
          <div>
            <h1 className="lp-h1">Database</h1>
            <p className="lp-sub">{db.locations.length} monitoring stations</p>
          </div>
          <div className="lp-stats">
            {RATING_ORDER.map(r => (
              <div key={r} className="lp-stat" onClick={() => setFilterRating(filterRating === r ? '' : r)} style={{ cursor: 'pointer', opacity: filterRating && filterRating !== r ? 0.4 : 1 }}>
                <span className="lp-stat-val" style={{ color: RATING_COLORS[r] }}>{ratingCounts[r] || 0}</span>
                <span className="lp-stat-lbl">{RATING_LABELS[r]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lp-filters">
          <input className="lp-search" placeholder="Search name, code, description..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="lp-sel" value={filterRating} onChange={e => setFilterRating(e.target.value)}>
            <option value="">All ratings</option>
            {RATING_ORDER.map(r => <option key={r} value={r}>{RATING_LABELS[r]}</option>)}
          </select>
          <select className="lp-sel" value={filterEnv} onChange={e => setFilterEnv(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(ENV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {programOptions.length > 0 && (
            <select className="lp-sel" value={filterProgram} onChange={e => setFilterProgram(e.target.value)}>
              <option value="">All programs</option>
              {programOptions.map(p => <option key={p} value={p}>{PROGRAM_LABELS[p] || p}</option>)}
            </select>
          )}
          {regions.length > 0 && (
            <select className="lp-sel" value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
              <option value="">All regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          {measTypeOptions.length > 0 && (
            <select className="lp-sel" value={filterMeasType} onChange={e => setFilterMeasType(e.target.value)}>
              <option value="">All measurements</option>
              {measTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {fieldWorkerOptions.length > 0 && (
            <select className="lp-sel" value={filterFieldWorker} onChange={e => setFilterFieldWorker(e.target.value)}>
              <option value="">All field workers</option>
              {fieldWorkerOptions.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          )}
          {labWorkerOptions.length > 0 && (
            <select className="lp-sel" value={filterLabWorker} onChange={e => setFilterLabWorker(e.target.value)}>
              <option value="">All analysts</option>
              {labWorkerOptions.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          )}
          {hasActiveFilters && (
            <button className="lp-clear" onClick={clearAll}>Clear all</button>
          )}
          <span className="lp-count">{filtered.length} of {db.locations.length}</span>
        </div>

        <div className="lp-table-wrap">
          <table className="lp-table">
            <thead>
              <tr>
                <th className="lp-th-name" onClick={() => handleSort('code')}>Code{arrow('code')}</th>
                <th className="lp-th-name-wide" onClick={() => handleSort('name')}>Name{arrow('name')}</th>
                <th onClick={() => handleSort('environment_type')}>Type{arrow('environment_type')}</th>
                <th onClick={() => handleSort('rating')}>Rating{arrow('rating')}</th>
                <th>Lat</th>
                <th>Lng</th>
                <th onClick={() => handleSort('visits')}>Visits{arrow('visits')}</th>
                <th onClick={() => handleSort('measurements')}>Meas.{arrow('measurements')}</th>
                <th>Last visit</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={10} className="lp-empty">No locations match your filters</td></tr>}
              {filtered.map(l => (
                <tr key={l.id} className="lp-row" onClick={() => navigate(`/locations/${l.id}`)}>
                  <td className="lp-code">{l.code}</td>
                  <td className="lp-name">{l.name}</td>
                  <td><span className="lp-env-tag">{ENV_LABELS[l.environment_type] || l.environment_type}</span></td>
                  <td><span className="lp-rating-tag" style={{ background: RATING_COLORS[l.rating] }}>{RATING_LABELS[l.rating]}</span></td>
                  <td className="lp-coord">{l.latitude.toFixed(4)}</td>
                  <td className="lp-coord">{l.longitude.toFixed(4)}</td>
                  <td className="lp-num">{visitCounts.get(l.id) || 0}</td>
                  <td className="lp-num">{measCounts.get(l.id) || 0}</td>
                  <td className="lp-date">{latestVisit.get(l.id) || '\u2014'}</td>
                  <td className="lp-desc">{l.description || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const css = `
.lp{font-family:var(--font-sans);display:flex;flex-direction:column;height:100%;overflow:hidden}
.lp-header{padding:14px 20px 10px;border-bottom:0.5px solid var(--color-border-tertiary);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-shrink:0;flex-wrap:wrap}
.lp-h1{font-size:18px;font-weight:600;color:var(--color-text-primary);margin:0}
.lp-sub{font-size:12px;color:var(--color-text-secondary);margin-top:2px}
.lp-stats{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;align-items:center}
.lp-stat{display:flex;flex-direction:column;align-items:center;padding:3px 8px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);min-width:40px;transition:opacity .15s}
.lp-stat-val{font-size:14px;font-weight:600}
.lp-stat-lbl{font-size:7px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap}
.lp-filters{display:flex;align-items:center;gap:6px;padding:8px 20px;border-bottom:0.5px solid var(--color-border-tertiary);flex-shrink:0;flex-wrap:wrap}
.lp-search{padding:5px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:11px;color:var(--color-text-primary);background:var(--color-background-secondary);font-family:var(--font-sans);width:180px;outline:none}
.lp-search:focus{border-color:var(--color-border-info)}
.lp-sel{padding:5px 6px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:10px;color:var(--color-text-primary);background:var(--color-background-primary);font-family:var(--font-sans);outline:none;cursor:pointer}
.lp-clear{border:none;background:none;color:var(--color-text-info);font-size:10px;cursor:pointer;font-family:var(--font-sans)}
.lp-clear:hover{text-decoration:underline}
.lp-count{font-size:10px;color:var(--color-text-tertiary);margin-left:auto}
.lp-table-wrap{flex:1;overflow:auto}
.lp-table{width:100%;border-collapse:collapse;min-width:900px}
.lp-table thead{position:sticky;top:0;z-index:1}
.lp-table th{text-align:left;font-size:10px;font-weight:600;color:var(--color-text-secondary);padding:8px 10px;border-bottom:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary);cursor:pointer;user-select:none;white-space:nowrap;text-transform:uppercase;letter-spacing:0.3px}
.lp-table th:hover{color:var(--color-text-primary)}
.lp-th-name{width:90px}
.lp-th-name-wide{min-width:180px}
.lp-table td{font-size:11px;padding:7px 10px;border-bottom:0.5px solid var(--color-border-tertiary);color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lp-row{cursor:pointer;transition:background .1s}
.lp-row:hover td{background:var(--color-background-secondary)}
.lp-code{font-family:monospace;font-size:10px;color:var(--color-text-secondary)}
.lp-name{font-weight:500}
.lp-env-tag{font-size:9px;padding:1px 6px;border-radius:3px;background:var(--color-background-secondary);color:var(--color-text-secondary);font-weight:500}
.lp-rating-tag{font-size:8px;font-weight:600;padding:2px 6px;border-radius:var(--border-radius-md);color:#fff;white-space:nowrap}
.lp-coord{font-family:monospace;font-size:10px;color:var(--color-text-tertiary)}
.lp-num{text-align:center;font-variant-numeric:tabular-nums}
.lp-date{font-family:monospace;font-size:10px;color:var(--color-text-secondary)}
.lp-desc{max-width:200px;color:var(--color-text-secondary);font-size:10px}
.lp-empty{text-align:center;padding:3rem;color:var(--color-text-tertiary);font-size:13px}
@media(max-width:768px){.lp-header{flex-direction:column}.lp-search{width:100%}.lp-filters{gap:4px}}
`;
