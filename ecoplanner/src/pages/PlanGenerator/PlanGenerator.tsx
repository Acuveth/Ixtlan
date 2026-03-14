import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDatabase } from '../../context/DatabaseContext';
import { generateSuggestions } from './generateSuggestions';
import type { Entry } from '../PlanBuilder/planData';
import type { PlanSuggestion, Frequency, SuggestionPriority, Visit, Measurement } from '../../types';
import AddEntryModal from '../PlanBuilder/AddEntryModal';

// ── Constants ──

const PRIORITY_COLORS: Record<SuggestionPriority, { bg: string; color: string; label: string }> = {
  critical: { bg: '#FEF2F2', color: '#DC2626', label: 'Critical' },
  high: { bg: '#FFF7ED', color: '#EA580C', label: 'High' },
  medium: { bg: '#FEF9C3', color: '#A16207', label: 'Medium' },
  low: { bg: '#F0F9FF', color: '#0369A1', label: 'Low' },
};

const SOURCE_LABELS: Record<string, string> = {
  auto_anomaly: 'Anomaly',
  auto_rating: 'Rating',
  auto_pattern: 'Pattern',
  auto_cluster: 'Cluster',
  manual: 'Manual',
};

const FREQUENCIES: Frequency[] = ['quarterly', 'biannual', 'annual', 'biennial', 'triennial'];

const CLUSTER_COLORS = ['#378ADD', '#E24B4A', '#639922', '#BA7517', '#a855f7', '#14b8a6'];

// ── Map helpers ──

function MapReady() {
  const map = useMap();
  useEffect(() => {
    map.setView([46.07, 14.82], 8);
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function makeIcon(color: string, active: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:${active ? 16 : 12}px;height:${active ? 16 : 12}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);${active ? 'box-shadow:0 0 0 4px ' + color + '40,0 1px 4px rgba(0,0,0,0.3)' : ''}"></div>`,
  });
}

// ── Component ──

export default function PlanGenerator() {
  const { locations, measurementTemplates, users, monitoringPlans, getRatingColor, addPlanBuilderEntries, removePlanBuilderEntries, addVisits, addMeasurements, removeVisits, removeMeasurements, planBuilderEntries } = useDatabase();
  const fieldWorkers = users.filter(u => u.role === 'field_worker');
  const [suggestions, setSuggestions] = useState<PlanSuggestion[]>(() => generateSuggestions());
  const [modifyingId, setModifyingId] = useState<string | null>(null);
  const [modifyForm, setModifyForm] = useState<{ freq: Frequency; date: string; assignee: string }>({ freq: 'quarterly', date: '', assignee: '' });
  const [manualOpen, setManualOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // ── Derived data ──

  const stats = useMemo(() => {
    const confirmed = suggestions.filter(s => s.action === 'confirmed').length;
    const modified = suggestions.filter(s => s.action === 'modified').length;
    const declined = suggestions.filter(s => s.action === 'declined').length;
    const pending = suggestions.filter(s => s.action === 'pending').length;
    const totalCost = suggestions
      .filter(s => s.action === 'confirmed' || s.action === 'modified')
      .reduce((sum, s) => sum + s.estimatedCost, 0);
    return { confirmed, modified, declined, pending, total: suggestions.length, totalCost };
  }, [suggestions]);

  const costByTemplate = useMemo(() => {
    const active = suggestions.filter(s => s.action === 'confirmed' || s.action === 'modified');
    const map: Record<string, { name: string; cost: number; count: number }> = {};
    for (const s of active) {
      const tmpl = measurementTemplates.find(t => t.id === s.measurementTemplateId);
      if (!tmpl) continue;
      if (!map[tmpl.id]) map[tmpl.id] = { name: tmpl.name, cost: 0, count: 0 };
      map[tmpl.id].cost += s.estimatedCost;
      map[tmpl.id].count++;
    }
    return Object.values(map);
  }, [suggestions]);

  // Show pending first, then confirmed/modified — declined go to separate section
  const sortedSuggestions = useMemo(() => {
    const order: Record<string, number> = { pending: 0, modified: 1, confirmed: 2 };
    return suggestions
      .filter(s => s.action !== 'declined')
      .sort((a, b) => {
        const ao = order[a.action] ?? 0;
        const bo = order[b.action] ?? 0;
        if (ao !== bo) return ao - bo;
        const po: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (po[a.priority] ?? 9) - (po[b.priority] ?? 9);
      });
  }, [suggestions]);

  // Map data: cluster polylines
  const clusterLines = useMemo(() => {
    return suggestions
      .filter(s => s.source === 'auto_cluster' && s.action !== 'declined')
      .map((s, i) => {
        const coords = s.locationIds
          .map(id => locations.find(l => l.id === id))
          .filter(Boolean)
          .map(l => [l!.latitude, l!.longitude] as [number, number]);
        return { id: s.id, coords, color: CLUSTER_COLORS[i % CLUSTER_COLORS.length] };
      });
  }, [suggestions]);

  // All location IDs referenced in non-declined suggestions
  const activeLocationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of suggestions) {
      if (s.action === 'declined') continue;
      s.locationIds.forEach(id => ids.add(id));
    }
    return ids;
  }, [suggestions]);

  const prevBudget = monitoringPlans.find(p => p.id === 'p3')?.total_budget ?? 172000;

  const declinedSuggestions = useMemo(() => suggestions.filter(s => s.action === 'declined'), [suggestions]);
  const [declinedOpen, setDeclinedOpen] = useState(false);


  // Convert a suggestion to PlanBuilder Entry objects
  function suggestionToEntries(s: PlanSuggestion): Entry[] {
    const tmpl = measurementTemplates.find(t => t.id === s.measurementTemplateId);
    const date = s.modifiedDate ?? s.proposedDate;
    const freq = s.modifiedFrequency ?? s.proposedFrequency;
    const assignee = s.modifiedAssigneeId ?? s.assigneeId;
    // Map mockData user id to planData worker id
    const workerMap: Record<string, string> = { u2: 'w1', u4: 'w2' };
    const workerId = workerMap[assignee] ?? '';

    return s.locationIds.map((locId, i) => {
      const loc = locations.find(l => l.id === locId);
      return {
        id: `pg-${s.id}-${i}`,
        locationId: locId,
        locationName: loc?.name ?? 'Unknown',
        locationCode: loc?.code ?? '',
        rating: loc?.rating ?? 'moderate',
        river: loc?.name.split(' — ')[0] ?? loc?.name ?? '',
        program: 'river' as const,
        waterBody: 'river' as const,
        measurement: tmpl?.name ?? 'Unknown',
        frequency: freq === 'triennial' ? 'biennial' : freq as Entry['frequency'],
        assigneeId: workerId,
        status: 'planned' as const,
        nextDate: date,
        cost: tmpl?.unit_cost ?? 120,
      };
    });
  }

  // Create Visit + Measurement records so they appear in /plans and /planned-work
  function suggestionToVisitsAndMeasurements(s: PlanSuggestion): { visits: Visit[]; measurements: Measurement[] } {
    const tmpl = measurementTemplates.find(t => t.id === s.measurementTemplateId);
    const date = s.modifiedDate ?? s.proposedDate;
    const assignee = s.modifiedAssigneeId ?? s.assigneeId;
    const planId = monitoringPlans[0]?.id ?? 'p1';

    const newVisits: Visit[] = [];
    const newMeasurements: Measurement[] = [];

    for (let i = 0; i < s.locationIds.length; i++) {
      const locId = s.locationIds[i];
      const visitId = `pgv-${s.id}-${i}`;
      const measId = `pgm-${s.id}-${i}`;

      newVisits.push({
        id: visitId,
        plan_id: planId,
        location_id: locId,
        planned_date: date,
        status: 'planned',
        assigned_to: assignee,
        logistics_cost: 50,
      });

      newMeasurements.push({
        id: measId,
        location_id: locId,
        measurement_template_id: s.measurementTemplateId,
        plan_entry_id: `pg-${s.id}-${i}`,
        visit_id: visitId,
        assignee_id: assignee,
        status: 'planned',
        pipeline_status: 'pending_sample',
        planned_date: date,
        analysis_cost: tmpl?.unit_cost ?? 120,
      });
    }

    return { visits: newVisits, measurements: newMeasurements };
  }

  // ── Handlers ──

  const handleConfirm = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, action: 'confirmed' } : s));
    setModifyingId(null);
    const s = suggestions.find(s => s.id === id);
    if (s) {
      addPlanBuilderEntries(suggestionToEntries(s));
      const { visits, measurements } = suggestionToVisitsAndMeasurements(s);
      addVisits(visits);
      addMeasurements(measurements);
    }
  };

  const handleDecline = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, action: 'declined' } : s));
    const s = suggestions.find(s => s.id === id);
    if (s) {
      removePlanBuilderEntries(s.locationIds.map((_, i) => `pg-${id}-${i}`));
      removeVisits(s.locationIds.map((_, i) => `pgv-${id}-${i}`));
      removeMeasurements(s.locationIds.map((_, i) => `pgm-${id}-${i}`));
    }
  };

  const handleStartModify = (s: PlanSuggestion) => {
    setModifyingId(s.id);
    setModifyForm({
      freq: s.modifiedFrequency ?? s.proposedFrequency,
      date: s.modifiedDate ?? s.proposedDate,
      assignee: s.modifiedAssigneeId ?? s.assigneeId,
    });
  };

  const handleSaveModify = (id: string) => {
    const updated: PlanSuggestion = {
      ...suggestions.find(s => s.id === id)!,
      action: 'modified',
      modifiedFrequency: modifyForm.freq,
      modifiedDate: modifyForm.date,
      modifiedAssigneeId: modifyForm.assignee,
    };
    setSuggestions(prev => prev.map(s => s.id === id ? updated : s));
    setModifyingId(null);
    // Remove old, add updated
    removePlanBuilderEntries(updated.locationIds.map((_, i) => `pg-${id}-${i}`));
    removeVisits(updated.locationIds.map((_, i) => `pgv-${id}-${i}`));
    removeMeasurements(updated.locationIds.map((_, i) => `pgm-${id}-${i}`));
    addPlanBuilderEntries(suggestionToEntries(updated));
    const { visits, measurements } = suggestionToVisitsAndMeasurements(updated);
    addVisits(visits);
    addMeasurements(measurements);
  };

  const handleToggleAutoApprove = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, autoApproveSimilar: !s.autoApproveSimilar } : s));
  };

  const handleRestore = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, action: 'pending' } : s));
    const s = suggestions.find(s => s.id === id);
    if (s) {
      removePlanBuilderEntries(s.locationIds.map((_, i) => `pg-${id}-${i}`));
      removeVisits(s.locationIds.map((_, i) => `pgv-${id}-${i}`));
      removeMeasurements(s.locationIds.map((_, i) => `pgm-${id}-${i}`));
    }
  };

  const handleAddFromModal = (entry: Entry) => {
    // Find matching template by name
    const tmpl = measurementTemplates.find(t => t.name === entry.measurement);
    const templateId = tmpl?.id ?? 'mt1';

    // Map worker ID to user ID
    const workerToUser: Record<string, string> = { w1: 'u2', w2: 'u4' };
    const assigneeId = workerToUser[entry.assigneeId] || entry.assigneeId || '';

    const newSuggestion: PlanSuggestion = {
      id: `sg-manual-${Date.now()}`,
      locationIds: [entry.locationId],
      measurementTemplateId: templateId,
      proposedDate: entry.nextDate,
      proposedFrequency: (entry.frequency || 'quarterly') as Frequency,
      assigneeId,
      estimatedCost: entry.cost + 50,
      priority: 'medium',
      source: 'manual',
      rationale: `Manually added: ${entry.measurement} at ${entry.locationName}.`,
      action: 'confirmed',
    };
    setSuggestions(prev => [...prev, newSuggestion]);
    addPlanBuilderEntries([entry]);
    const { visits, measurements } = suggestionToVisitsAndMeasurements(newSuggestion);
    addVisits(visits);
    addMeasurements(measurements);
    setManualOpen(false);
  };

  const handleConfirmAll = () => {
    const pending = suggestions.filter(s => s.action === 'pending');
    setSuggestions(prev => prev.map(s => s.action === 'pending' ? { ...s, action: 'confirmed' } : s));
    const allNewEntries = pending.flatMap(s => suggestionToEntries(s));
    addPlanBuilderEntries(allNewEntries);
    const allVisits: Visit[] = [];
    const allMeas: Measurement[] = [];
    for (const s of pending) {
      const { visits, measurements } = suggestionToVisitsAndMeasurements(s);
      allVisits.push(...visits);
      allMeas.push(...measurements);
    }
    addVisits(allVisits);
    addMeasurements(allMeas);
  };

  // ── Render ──

  return (
    <>
      <style>{css}</style>
      <div className="pg">
        {/* Left panel */}
        <div className="pg-left">
          {/* Header */}
          <div className="pg-header">
            <div>
              <h1 className="pg-title">Plan Generator</h1>
              <p className="pg-subtitle">AI-generated monitoring suggestions based on historical data</p>
            </div>
            <div className="pg-header-actions">
              <button className="pg-btn pg-btn-secondary" onClick={() => setManualOpen(!manualOpen)}>
                + Manual
              </button>
              <button className="pg-btn pg-btn-primary" onClick={handleConfirmAll} disabled={stats.pending === 0}>
                Confirm all ({stats.pending})
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="pg-stats">
            <div className="pg-stat">
              <span className="pg-stat-val">{stats.total}</span>
              <span className="pg-stat-label">Total</span>
            </div>
            <div className="pg-stat">
              <span className="pg-stat-val" style={{ color: '#64748B' }}>{stats.pending}</span>
              <span className="pg-stat-label">Pending</span>
            </div>
            <div className="pg-stat">
              <span className="pg-stat-val" style={{ color: '#639922' }}>{stats.confirmed}</span>
              <span className="pg-stat-label">Confirmed</span>
            </div>
            <div className="pg-stat">
              <span className="pg-stat-val" style={{ color: '#378ADD' }}>{stats.modified}</span>
              <span className="pg-stat-label">Modified</span>
            </div>
            <div className="pg-stat">
              <span className="pg-stat-val" style={{ color: '#E24B4A' }}>{stats.declined}</span>
              <span className="pg-stat-label">Declined</span>
            </div>
            <div className="pg-stat pg-stat-cost">
              <span className="pg-stat-val">€{stats.totalCost.toLocaleString()}</span>
              <span className="pg-stat-label">Est. cost</span>
            </div>
          </div>

          {/* Manual add modal — uses full AddEntryModal from PlanBuilder */}
          {manualOpen && (
            <AddEntryModal
              entries={planBuilderEntries}
              defaultDate="2026-04-01"
              onAdd={handleAddFromModal}
              onClose={() => setManualOpen(false)}
            />
          )}

          {/* Suggestions list */}
          <div className="pg-list">
            {sortedSuggestions.length === 0 ? (
              <div className="pg-empty">No suggestions match this filter.</div>
            ) : (
              sortedSuggestions.map(s => {
                const locs = s.locationIds.map(id => locations.find(l => l.id === id)).filter(Boolean);
                const tmpl = measurementTemplates.find(t => t.id === s.measurementTemplateId);
                const assignee = users.find(u => u.id === (s.modifiedAssigneeId ?? s.assigneeId));
                const pc = PRIORITY_COLORS[s.priority];
                const isModifying = modifyingId === s.id;
                const isDone = s.action === 'confirmed' || s.action === 'modified';
                const isDeclined = s.action === 'declined';
                const effectiveDate = s.modifiedDate ?? s.proposedDate;
                const effectiveFreq = s.modifiedFrequency ?? s.proposedFrequency;

                const isFocused = focusedId === s.id;

                return (
                  <div
                    key={s.id}
                    ref={el => { if (isFocused && el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                    className={`pg-card${isDeclined ? ' declined' : ''}${isDone ? ' done' : ''}${isFocused ? ' focused' : ''}`}
                    onMouseEnter={() => setHoveredId(s.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => setFocusedId(isFocused ? null : s.id)}
                  >
                    <div className="pg-card-top">
                      <div className="pg-card-badges">
                        <span className="pg-priority" style={{ background: pc.bg, color: pc.color }}>{pc.label}</span>
                        <span className="pg-source">{SOURCE_LABELS[s.source]}</span>
                      </div>
                      <span className="pg-card-cost">€{s.estimatedCost}</span>
                    </div>

                    <div className="pg-card-body">
                      <div className="pg-card-location">
                        {locs.map(l => l!.name).join(' + ')}
                      </div>
                      <div className="pg-card-details">
                        <span>{tmpl?.name}</span>
                        <span className="pg-sep">&middot;</span>
                        <span>{new Date(effectiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        <span className="pg-sep">&middot;</span>
                        <span>{effectiveFreq}</span>
                        <span className="pg-sep">&middot;</span>
                        <span>{assignee?.full_name ?? '—'}</span>
                      </div>
                      <div className="pg-card-rationale">{s.rationale}</div>
                    </div>

                    {/* Modify form */}
                    {isModifying && (
                      <div className="pg-modify">
                        <div className="pg-modify-grid">
                          <label className="pg-field">
                            <span className="pg-field-label">Frequency</span>
                            <select value={modifyForm.freq} onChange={e => setModifyForm(f => ({ ...f, freq: e.target.value as Frequency }))}>
                              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </label>
                          <label className="pg-field">
                            <span className="pg-field-label">Date</span>
                            <input type="date" value={modifyForm.date} onChange={e => setModifyForm(f => ({ ...f, date: e.target.value }))} />
                          </label>
                          <label className="pg-field">
                            <span className="pg-field-label">Assignee</span>
                            <select value={modifyForm.assignee} onChange={e => setModifyForm(f => ({ ...f, assignee: e.target.value }))}>
                              {fieldWorkers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                            </select>
                          </label>
                        </div>
                        <div className="pg-modify-actions">
                          <button className="pg-btn pg-btn-secondary" onClick={() => setModifyingId(null)}>Cancel</button>
                          <button className="pg-btn pg-btn-primary" onClick={() => handleSaveModify(s.id)}>Save</button>
                        </div>
                      </div>
                    )}

                    {/* Action bar */}
                    <div className="pg-card-actions">
                      {s.action === 'pending' && !isModifying && (
                        <>
                          <button className="pg-act pg-act-confirm" onClick={() => handleConfirm(s.id)} title="Confirm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                            Confirm
                          </button>
                          <button className="pg-act pg-act-modify" onClick={() => handleStartModify(s)} title="Modify">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            Modify
                          </button>
                          <button className="pg-act pg-act-decline" onClick={() => handleDecline(s.id)} title="Decline">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            Decline
                          </button>
                        </>
                      )}
                      {isDone && (
                        <div className="pg-done-row">
                          <span className="pg-done-badge" style={{ color: s.action === 'confirmed' ? '#639922' : '#378ADD' }}>
                            {s.action === 'confirmed' ? '✓ Confirmed' : '✎ Modified'}
                          </span>
                          <label className="pg-auto-approve">
                            <input type="checkbox" checked={s.autoApproveSimilar ?? false} onChange={() => handleToggleAutoApprove(s.id)} />
                            <span>Auto-approve similar</span>
                          </label>
                          <button className="pg-act-undo" onClick={() => handleRestore(s.id)}>Undo</button>
                        </div>
                      )}
                      {isDeclined && (
                        <div className="pg-done-row">
                          <span className="pg-done-badge" style={{ color: '#E24B4A' }}>✗ Declined</span>
                          <button className="pg-act-undo" onClick={() => handleRestore(s.id)}>Restore</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Declined section */}
          {declinedSuggestions.length > 0 && (
            <div className="pg-declined">
              <div className="pg-declined-toggle" onClick={() => setDeclinedOpen(!declinedOpen)}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={declinedOpen ? 'open' : ''}>
                  <path d="M3.5 1.5L7 5L3.5 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Declined ({declinedSuggestions.length})
              </div>
              {declinedOpen && (
                <div className="pg-declined-list">
                  {declinedSuggestions.map(s => {
                    const locs = s.locationIds.map(id => locations.find(l => l.id === id)).filter(Boolean);
                    const tmpl = measurementTemplates.find(t => t.id === s.measurementTemplateId);
                    const pc = PRIORITY_COLORS[s.priority];
                    return (
                      <div key={s.id} className="pg-declined-item">
                        <div className="pg-declined-info">
                          <span className="pg-priority" style={{ background: pc.bg, color: pc.color, fontSize: '8px', padding: '1px 5px' }}>{pc.label}</span>
                          <span className="pg-declined-name">{tmpl?.name} — {locs.map(l => l!.name).join(', ')}</span>
                        </div>
                        <button className="pg-act-undo" onClick={() => handleRestore(s.id)}>Restore</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Cost summary */}
          <div className="pg-cost">
            <div className="pg-cost-title">Cost Summary</div>
            <div className="pg-cost-total">
              <span>Confirmed plan</span>
              <strong>€{stats.totalCost.toLocaleString()}</strong>
            </div>
            <div className="pg-cost-compare">
              <span>Previous cycle</span>
              <span>€{prevBudget.toLocaleString()}</span>
            </div>
            {costByTemplate.length > 0 && (
              <div className="pg-cost-breakdown">
                {costByTemplate.map(c => (
                  <div key={c.name} className="pg-cost-row">
                    <span className="pg-cost-name">{c.name} ({c.count})</span>
                    <span className="pg-cost-val">€{c.cost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Map */}
        <div className="pg-right">
          <MapContainer
            center={[46.07, 14.82]}
            zoom={8}
            minZoom={3}
            maxZoom={18}
            className="pg-map"
            zoomControl={true}
            scrollWheelZoom={true}
          >
            <MapReady />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {/* Location markers */}
            {locations.filter(l => activeLocationIds.has(l.id)).map(loc => {
              const color = getRatingColor(loc.rating);
              const isHovered = suggestions.some(s => (s.id === hoveredId || s.id === focusedId) && s.locationIds.includes(loc.id));
              // Find the first non-declined suggestion for this location
              const locSuggestion = sortedSuggestions.find(s => s.locationIds.includes(loc.id));
              return (
                <Marker
                  key={loc.id}
                  position={[loc.latitude, loc.longitude]}
                  icon={makeIcon(color, isHovered)}
                  eventHandlers={{
                    click: () => {
                      if (locSuggestion) setFocusedId(locSuggestion.id);
                    },
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', minWidth: 160 }}>
                      <strong>{loc.name}</strong>
                      <div style={{ color: '#64748B', marginTop: 2 }}>{loc.code} &middot; {loc.rating.replace('_', ' ')}</div>
                      <div style={{ marginTop: 6, fontSize: '11px' }}>
                        {suggestions.filter(s => s.locationIds.includes(loc.id) && s.action !== 'declined').map(s => {
                          const tmpl = measurementTemplates.find(t => t.id === s.measurementTemplateId);
                          return (
                            <div key={s.id} style={{ padding: '2px 0' }}>
                              <span style={{ color: PRIORITY_COLORS[s.priority].color, fontWeight: 600 }}>{PRIORITY_COLORS[s.priority].label}</span>
                              {' '}{tmpl?.name} — €{s.estimatedCost}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Cluster polylines */}
            {clusterLines.map(cl => (
              <Polyline key={cl.id} positions={cl.coords} pathOptions={{ color: cl.color, weight: 2, dashArray: '6 4', opacity: 0.7 }} />
            ))}
          </MapContainer>
        </div>
      </div>
    </>
  );
}

// ── CSS ──

const css = `
.pg{display:flex;height:100%;width:100%;overflow:hidden;font-family:var(--font-sans)}
.pg-left{width:440px;flex-shrink:0;display:flex;flex-direction:column;border-right:0.5px solid var(--color-border-tertiary);background:var(--color-background-primary);overflow-y:auto}
.pg-right{flex:1;min-width:0;position:relative}
.pg-map{width:100%;height:100%}

.pg-header{padding:16px 16px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.pg-title{font-size:17px;font-weight:600;color:var(--color-text-primary);margin:0}
.pg-subtitle{font-size:12px;color:var(--color-text-secondary);margin-top:2px}
.pg-header-actions{display:flex;gap:6px;flex-shrink:0}

.pg-btn{padding:6px 14px;font-size:11px;font-weight:500;font-family:var(--font-sans);border-radius:var(--border-radius-md);cursor:pointer;transition:all .12s;white-space:nowrap}
.pg-btn-primary{background:#378ADD;color:white;border:none}
.pg-btn-primary:hover{background:#2d78c4}
.pg-btn-primary:disabled{opacity:0.4;cursor:not-allowed}
.pg-btn-secondary{background:var(--color-background-secondary);color:var(--color-text-primary);border:0.5px solid var(--color-border-tertiary)}
.pg-btn-secondary:hover{border-color:var(--color-border-secondary)}

.pg-stats{display:flex;gap:0;padding:12px 16px;border-bottom:0.5px solid var(--color-border-tertiary)}
.pg-stat{flex:1;text-align:center}
.pg-stat-val{display:block;font-size:16px;font-weight:600;color:var(--color-text-primary)}
.pg-stat-label{display:block;font-size:9px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.3px}
.pg-stat-cost{border-left:0.5px solid var(--color-border-tertiary);padding-left:8px}

.pg-manual{padding:12px 16px;border-bottom:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary)}
.pg-manual-title{font-size:12px;font-weight:500;color:var(--color-text-primary);margin-bottom:8px}
.pg-manual-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pg-manual-actions{display:flex;gap:6px;margin-top:8px;justify-content:flex-end}

.pg-field{display:flex;flex-direction:column;gap:3px}
.pg-field-label{font-size:10px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.3px}
.pg-field select,.pg-field input{padding:5px 8px;font-size:12px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-primary);font-family:var(--font-sans);outline:none}
.pg-field select:focus,.pg-field input:focus{border-color:var(--color-border-info)}

.pg-list{flex:1;overflow-y:auto;padding:8px 16px}
.pg-empty{text-align:center;padding:2rem;color:var(--color-text-tertiary);font-size:13px}

.pg-card{border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);margin-bottom:8px;background:var(--color-background-primary);transition:border-color .12s,opacity .12s}
.pg-card:hover{border-color:var(--color-border-secondary)}
.pg-card.declined{opacity:0.5}
.pg-card.focused{border-color:#378ADD;box-shadow:0 0 0 2px rgba(55,138,221,0.15)}
.pg-card.done{border-left:3px solid #639922}
.pg-card.done.declined{border-left-color:#E24B4A}

.pg-card-top{display:flex;align-items:center;justify-content:space-between;padding:8px 10px 0}
.pg-card-badges{display:flex;gap:4px;align-items:center}
.pg-priority{font-size:9px;font-weight:600;padding:2px 7px;border-radius:3px}
.pg-source{font-size:9px;color:var(--color-text-tertiary);padding:2px 6px;border:0.5px solid var(--color-border-tertiary);border-radius:3px}
.pg-card-cost{font-size:12px;font-weight:600;color:var(--color-text-primary)}

.pg-card-body{padding:6px 10px}
.pg-card-location{font-size:13px;font-weight:500;color:var(--color-text-primary);margin-bottom:3px}
.pg-card-details{font-size:11px;color:var(--color-text-secondary);display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.pg-sep{color:var(--color-text-tertiary)}
.pg-card-rationale{font-size:11px;color:var(--color-text-tertiary);margin-top:4px;line-height:1.4}

.pg-modify{padding:8px 10px;border-top:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary)}
.pg-modify-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.pg-modify-actions{display:flex;gap:6px;margin-top:8px;justify-content:flex-end}

.pg-card-actions{display:flex;align-items:center;gap:4px;padding:6px 10px;border-top:0.5px solid var(--color-border-tertiary)}
.pg-act{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;font-size:10px;font-weight:500;font-family:var(--font-sans);border:none;border-radius:var(--border-radius-md);cursor:pointer;transition:all .12s}
.pg-act-confirm{background:#ECFDF5;color:#059669}
.pg-act-confirm:hover{background:#D1FAE5}
.pg-act-modify{background:#EFF6FF;color:#378ADD}
.pg-act-modify:hover{background:#DBEAFE}
.pg-act-decline{background:#FEF2F2;color:#E24B4A}
.pg-act-decline:hover{background:#FEE2E2}
.pg-done-row{display:flex;align-items:center;gap:8px;width:100%}
.pg-done-badge{font-size:11px;font-weight:500}
.pg-auto-approve{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--color-text-secondary);margin-left:auto;cursor:pointer}
.pg-auto-approve input{width:12px;height:12px;accent-color:#378ADD}
.pg-act-undo{background:none;border:none;font-size:10px;color:var(--color-text-tertiary);cursor:pointer;font-family:var(--font-sans);text-decoration:underline}
.pg-act-undo:hover{color:var(--color-text-secondary)}

.pg-declined{padding:8px 16px;border-top:0.5px solid var(--color-border-tertiary)}
.pg-declined-toggle{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:500;color:var(--color-text-secondary);cursor:pointer;padding:4px 0;user-select:none}
.pg-declined-toggle:hover{color:var(--color-text-primary)}
.pg-declined-toggle svg{transition:transform .15s}
.pg-declined-toggle svg.open{transform:rotate(90deg)}
.pg-declined-list{margin-top:6px;display:flex;flex-direction:column;gap:4px}
.pg-declined-item{display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);opacity:0.6;font-size:11px}
.pg-declined-item:hover{opacity:0.9}
.pg-declined-info{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden}
.pg-declined-name{color:var(--color-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.pg-cost{padding:12px 16px;border-top:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary);flex-shrink:0}
.pg-cost-title{font-size:11px;font-weight:500;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:6px}
.pg-cost-total{display:flex;justify-content:space-between;font-size:13px;color:var(--color-text-primary);margin-bottom:4px}
.pg-cost-total strong{color:#639922}
.pg-cost-compare{display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-tertiary);margin-bottom:8px;padding-bottom:6px;border-bottom:0.5px solid var(--color-border-tertiary)}
.pg-cost-breakdown{display:flex;flex-direction:column;gap:3px}
.pg-cost-row{display:flex;justify-content:space-between;font-size:11px}
.pg-cost-name{color:var(--color-text-secondary)}
.pg-cost-val{color:var(--color-text-primary);font-weight:500}

@media(max-width:900px){
  .pg{flex-direction:column}
  .pg-left{width:100%;max-height:60vh;border-right:none;border-bottom:0.5px solid var(--color-border-tertiary)}
  .pg-right{height:40vh}
  .pg-manual-grid{grid-template-columns:1fr}
  .pg-modify-grid{grid-template-columns:1fr}
}
`;
