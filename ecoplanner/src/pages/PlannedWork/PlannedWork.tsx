import { useState, useMemo, useEffect, useCallback } from 'react';
import { useUser } from '../../context/UserContext';
import { useDatabase } from '../../context/DatabaseContext';
import type { PipelineStatus, Measurement } from '../../types';
import { queryAI } from '../../services/aiService';

const TODAY = '2026-03-15';
function dStr(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addD(d: string, n: number): string { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n); return dStr(dt); }
function getMonday(d: string): string { const dt = new Date(d + 'T00:00:00'); const day = dt.getDay(); dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1)); return dStr(dt); }
function niceDate(d: string): string { if (d === TODAY) return 'Today'; if (d === addD(TODAY, 1)) return 'Tomorrow'; return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
function fmtDate(d: string): string { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

type TimeFilter = 'today' | 'tomorrow' | 'this_week' | 'this_month' | 'upcoming';

const PC: Record<string, { bg: string; color: string }> = {
  pending_sample: { bg: '#F1F5F9', color: '#64748B' },
  sampled: { bg: '#EFF6FF', color: '#378ADD' },
  in_transit: { bg: '#FFF7ED', color: '#BA7517' },
  in_lab: { bg: '#FEF3C7', color: '#D97706' },
  analyzed: { bg: '#ECFDF5', color: '#059669' },
  validated: { bg: '#F0FDF4', color: '#639922' },
};

// Field workers can act on these statuses
const FIELD_ACTIONABLE: PipelineStatus[] = ['pending_sample', 'sampled'];
const FIELD_TRANSITIONS: Partial<Record<PipelineStatus, PipelineStatus>> = { pending_sample: 'sampled', sampled: 'in_transit' };

export default function PlannedWork() {
  const db = useDatabase();
  const { visits, measurements: allMeasurements, locations, measurementTemplates, users, monitoringPlans, getPipelineLabel, updateMeasurement } = db;
  const { currentUser } = useUser();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('this_week');
  const [measurements, setMeasurements] = useState(allMeasurements);

  // Sync when DatabaseContext measurements change (e.g. PlanGenerator adds new ones)
  useEffect(() => {
    setMeasurements(prev => {
      const prevIds = new Set(prev.map(m => m.id));
      const fresh = allMeasurements.filter(m => !prevIds.has(m.id));
      if (fresh.length === 0) return prev;
      return [...prev, ...fresh];
    });
  }, [allMeasurements]);

  // Visit popup
  const [openVisitId, setOpenVisitId] = useState<string | null>(null);
  // Per-measurement field data entry (key = measurement id)
  const [fieldData, setFieldData] = useState<Record<string, Record<string, string>>>({});
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  const tomorrow = addD(TODAY, 1);
  const weekStart = getMonday(TODAY);
  const weekEnd = addD(weekStart, 6);
  const monthStart = TODAY.slice(0, 8) + '01';
  const monthEnd = (() => { const dt = new Date(TODAY + 'T00:00:00'); dt.setMonth(dt.getMonth() + 1, 0); return dStr(dt); })();

  // Only visits where the field worker still has work to do
  const activeVisits = useMemo(() => {
    return visits
      .filter(v => {
        if (v.assigned_to !== currentUser.id) return false;
        if (v.status === 'completed' || v.status === 'cancelled') return false;
        // Has at least one measurement that field worker can still act on
        const vMeas = measurements.filter(m => m.visit_id === v.id);
        return vMeas.some(m => FIELD_ACTIONABLE.includes(m.pipeline_status));
      })
      .sort((a, b) => a.planned_date.localeCompare(b.planned_date));
  }, [currentUser.id, measurements]);

  const filteredVisits = useMemo(() => {
    return activeVisits.filter(v => {
      const d = v.planned_date;
      switch (timeFilter) {
        case 'today': return d === TODAY;
        case 'tomorrow': return d === tomorrow;
        case 'this_week': return d >= weekStart && d <= weekEnd;
        case 'this_month': return d >= monthStart && d <= monthEnd;
        case 'upcoming': return d >= TODAY;
      }
    });
  }, [activeVisits, timeFilter, tomorrow, weekStart, weekEnd, monthStart, monthEnd]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredVisits>();
    for (const v of filteredVisits) {
      const existing = map.get(v.planned_date);
      if (existing) existing.push(v);
      else map.set(v.planned_date, [v]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredVisits]);

  const countFor = (check: (d: string) => boolean) => activeVisits.filter(v => check(v.planned_date)).length;
  const filters: { key: TimeFilter; label: string; count: number }[] = [
    { key: 'today', label: 'Today', count: countFor(d => d === TODAY) },
    { key: 'tomorrow', label: 'Tomorrow', count: countFor(d => d === tomorrow) },
    { key: 'this_week', label: 'This week', count: countFor(d => d >= weekStart && d <= weekEnd) },
    { key: 'this_month', label: 'This month', count: countFor(d => d >= monthStart && d <= monthEnd) },
    { key: 'upcoming', label: 'All upcoming', count: countFor(d => d >= TODAY) },
  ];

  // Summary
  const allActionable = filteredVisits.flatMap(v => measurements.filter(m => m.visit_id === v.id && FIELD_ACTIONABLE.includes(m.pipeline_status)));
  const pendingCount = allActionable.filter(m => m.pipeline_status === 'pending_sample').length;
  const sampledCount = allActionable.filter(m => m.pipeline_status === 'sampled').length;

  // Actions — update local state AND persist to Supabase
  const advanceStatus = (mId: string, resultsData?: Record<string, number>, notes?: string) => {
    setMeasurements(prev => prev.map(m => {
      if (m.id !== mId) return m;
      const next = FIELD_TRANSITIONS[m.pipeline_status];
      if (!next) return m;
      const updates: Partial<Measurement> = {
        pipeline_status: next,
        ...(resultsData ? { results: resultsData } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(next === 'sampled' ? { measurement_date: TODAY } : {}),
      };
      // Persist to Supabase
      updateMeasurement(mId, updates);
      return { ...m, ...updates };
    }));
  };

  const handleFieldParam = (mId: string, key: string, val: string) => {
    setFieldData(prev => ({ ...prev, [mId]: { ...(prev[mId] || {}), [key]: val } }));
  };

  const handleFieldNotes = (mId: string, val: string) => {
    setFieldNotes(prev => ({ ...prev, [mId]: val }));
  };

  // AI field report generation
  const generateAiNotes = useCallback(async (m: Measurement) => {
    const tpl = measurementTemplates.find(t => t.id === m.measurement_template_id);
    const loc = locations.find(l => l.id === m.location_id);
    const fd = fieldData[m.id] || {};
    const existingNotes = fieldNotes[m.id] || '';

    // Only include parameters that actually have values
    const recordedParams = tpl?.parameters
      .filter(p => fd[p.key] && fd[p.key].trim() !== '')
      .map(p => `${p.label}: ${fd[p.key]}${p.unit ? ` ${p.unit}` : ''}`) || [];

    const hasValues = recordedParams.length > 0;
    const hasNotes = existingNotes.trim().length > 0;

    if (!hasValues && !hasNotes) {
      setFieldNotes(prev => ({ ...prev, [m.id]: 'Sample collected. No field readings or observations recorded.' }));
      return;
    }

    // Build a natural prompt from whatever the worker actually entered
    const parts: string[] = [];
    parts.push(`Location: ${loc?.name || 'Unknown'}, ${tpl?.name || ''}, ${TODAY}.`);
    if (hasValues) parts.push(`Readings: ${recordedParams.join(', ')}.`);
    if (hasNotes) parts.push(`Notes: ${existingNotes}`);

    const prompt = `Write a field sampling report from this: ${parts.join(' ')} — be descriptive, interpret the data, add environmental context. Just the report text, nothing else.`;

    setAiLoading(prev => ({ ...prev, [m.id]: true }));
    try {
      const res = await queryAI(prompt, [], currentUser);
      setFieldNotes(prev => ({ ...prev, [m.id]: res.text }));
    } catch {
      setFieldNotes(prev => ({ ...prev, [m.id]: existingNotes + '\n[AI generation failed]' }));
    }
    setAiLoading(prev => ({ ...prev, [m.id]: false }));
  }, [measurementTemplates, locations, fieldData, fieldNotes, currentUser]);

  // Confirm sample: record field values + advance to sampled
  const confirmSample = (m: Measurement) => {
    const tpl = measurementTemplates.find(t => t.id === m.measurement_template_id);
    const fd = fieldData[m.id];
    let results: Record<string, number> | undefined;
    if (tpl && fd) {
      results = {};
      for (const p of tpl.parameters) {
        if (fd[p.key]) results[p.key] = parseFloat(fd[p.key]);
      }
      if (Object.keys(results).length === 0) results = undefined;
    }
    advanceStatus(m.id, results, fieldNotes[m.id]);
  };

  // Visit popup data
  const popVisit = openVisitId ? visits.find(v => v.id === openVisitId) : null;
  const popLoc = popVisit ? locations.find(l => l.id === popVisit.location_id) : null;
  const popPlan = popVisit ? monitoringPlans.find(p => p.id === popVisit.plan_id) : null;
  const popMeas = popVisit ? measurements.filter(m => m.visit_id === popVisit.id) : [];

  return (
    <>
      <style>{css}</style>
      <div className="pw">
        <div className="pw-header">
          <h1>My Schedule</h1>
          <p>Visits with samples to collect — click a visit to record measurements</p>
        </div>

        <div className="pw-summary">
          <div className="pw-sum-item"><span className="pw-sum-val" style={{ color: '#378ADD' }}>{filteredVisits.length}</span><span className="pw-sum-lbl">Visits</span></div>
          <div className="pw-sum-item"><span className="pw-sum-val" style={{ color: '#64748B' }}>{pendingCount}</span><span className="pw-sum-lbl">To collect</span></div>
          <div className="pw-sum-item"><span className="pw-sum-val" style={{ color: '#378ADD' }}>{sampledCount}</span><span className="pw-sum-lbl">Sampled</span></div>
          <div className="pw-sum-item"><span className="pw-sum-val">{allActionable.length}</span><span className="pw-sum-lbl">Total tasks</span></div>
        </div>

        <div className="pw-filters">
          {filters.map(f => (
            <button key={f.key} className={`pw-fbtn${timeFilter === f.key ? ' active' : ''}`} onClick={() => setTimeFilter(f.key)}>
              {f.label} <span className="pw-fcnt">{f.count}</span>
            </button>
          ))}
        </div>

        <div className="pw-days">
          {grouped.length === 0 && <div className="pw-empty">No visits with pending work for this period.</div>}
          {grouped.map(([date, dayVisits]) => (
            <div key={date} className={`pw-day${date === TODAY ? ' pw-today' : ''}${date < TODAY ? ' pw-past' : ''}`}>
              <div className="pw-day-hdr">
                <span className="pw-day-lbl">{niceDate(date)}</span>
                <span className="pw-day-full">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
                <span className="pw-day-cnt">{dayVisits.length} visit{dayVisits.length > 1 ? 's' : ''}</span>
              </div>
              <div className="pw-day-body">
                {dayVisits.map(visit => {
                  const loc = locations.find(l => l.id === visit.location_id);
                  const plan = monitoringPlans.find(p => p.id === visit.plan_id);
                  const vMeas = measurements.filter(m => m.visit_id === visit.id);
                  const actionable = vMeas.filter(m => FIELD_ACTIONABLE.includes(m.pipeline_status));

                  return (
                    <div key={visit.id} className="pw-visit" onClick={() => setOpenVisitId(visit.id)}>
                      <div className="pw-visit-top">
                        <div className="pw-visit-left">
                          <span className="pw-visit-name">{loc?.name ?? 'Unknown'}</span>
                          {loc && <span className="pw-visit-code">{loc.code}</span>}
                        </div>
                        <div className="pw-visit-right">
                          <span className="pw-tag-pending">{actionable.length} task{actionable.length > 1 ? 's' : ''}</span>
                          <svg className="pw-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                        </div>
                      </div>
                      {plan && <div className="pw-visit-plan">{plan.name}</div>}
                      <div className="pw-meas-list">
                        {vMeas.map(m => {
                          const tpl = measurementTemplates.find(t => t.id === m.measurement_template_id);
                          const pc = PC[m.pipeline_status] ?? PC.pending_sample;
                          return (
                            <div key={m.id} className="pw-meas">
                              <span className="pw-meas-dot" style={{ background: pc.color }} />
                              <span className="pw-meas-name">{tpl?.name ?? 'Unknown'}</span>
                              <span className="pw-meas-badge" style={{ background: pc.bg, color: pc.color }}>{getPipelineLabel(m.pipeline_status)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========== Visit Popup ========== */}
      {popVisit && popLoc && (
        <div className="pw-overlay" onClick={() => setOpenVisitId(null)}>
          <div className="pw-popup" onClick={e => e.stopPropagation()}>
            <div className="pw-pop-hdr">
              <div>
                <div className="pw-pop-title">{popLoc.name}</div>
                <div className="pw-pop-subtitle">{popLoc.code} · {fmtDate(popVisit.planned_date)}{popPlan ? ` · ${popPlan.name}` : ''}</div>
              </div>
              <button className="pw-pop-close" onClick={() => setOpenVisitId(null)}>&times;</button>
            </div>

            <div className="pw-pop-body">
              {popMeas.map(m => {
                const tpl = measurementTemplates.find(t => t.id === m.measurement_template_id);
                const pc = PC[m.pipeline_status] ?? PC.pending_sample;
                const isActionable = FIELD_ACTIONABLE.includes(m.pipeline_status);
                const fd = fieldData[m.id] || {};
                const labWorker = m.lab_assignee_id ? users.find(u => u.id === m.lab_assignee_id) : null;

                return (
                  <div key={m.id} className={`pw-pop-meas${isActionable ? '' : ' pw-pop-meas-done'}`}>
                    {/* Measurement header */}
                    <div className="pw-pop-meas-top">
                      <span className="pw-pop-meas-name">{tpl?.name ?? 'Unknown'}</span>
                      <span className="pw-pop-meas-badge" style={{ background: pc.bg, color: pc.color }}>{getPipelineLabel(m.pipeline_status)}</span>
                    </div>

                    {/* Info row */}
                    <div className="pw-pop-meas-info">
                      {tpl && <span>€{tpl.unit_cost}</span>}
                      {tpl && <span>{tpl.parameters.length} params</span>}
                      {labWorker && <span>Lab: {labWorker.full_name}</span>}
                    </div>

                    {/* Field data entry — for pending_sample */}
                    {m.pipeline_status === 'pending_sample' && tpl && (
                      <div className="pw-pop-entry">
                        <div className="pw-pop-entry-label">Record field measurements <span className="pw-pop-optional">(optional — can be done at lab)</span></div>
                        <div className="pw-pop-params">
                          {tpl.parameters.map(p => (
                            <div key={p.key} className="pw-pop-param">
                              <label className="pw-pop-plbl">{p.label}{p.unit && <span className="pw-pop-punit"> ({p.unit})</span>}</label>
                              <input
                                type="number"
                                className="pw-pop-pinput"
                                placeholder={p.min !== undefined ? `${p.min}–${p.max}` : '—'}
                                value={fd[p.key] ?? ''}
                                onChange={e => handleFieldParam(m.id, p.key, e.target.value)}
                                step="any"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="pw-pop-notes-row">
                          <textarea
                            className="pw-pop-notes"
                            placeholder="Field notes (optional)..."
                            value={fieldNotes[m.id] ?? ''}
                            onChange={e => handleFieldNotes(m.id, e.target.value)}
                            rows={(fieldNotes[m.id] ?? '').length > 80 ? 4 : 1}
                          />
                          <button
                            className={`pw-pop-ai-btn${aiLoading[m.id] ? ' loading' : ''}`}
                            title="Generate AI field report"
                            onClick={() => generateAiNotes(m)}
                            disabled={aiLoading[m.id]}
                          >
                            {aiLoading[m.id] ? (
                              <span className="pw-pop-ai-spinner" />
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            )}
                          </button>
                        </div>
                        <button className="pw-pop-action" onClick={() => confirmSample(m)}>
                          Confirm Sampled
                        </button>
                      </div>
                    )}

                    {/* For sampled — just advance to transit */}
                    {m.pipeline_status === 'sampled' && (
                      <div className="pw-pop-entry">
                        <button className="pw-pop-action pw-pop-action-transit" onClick={() => advanceStatus(m.id)}>
                          Send to Transit
                        </button>
                      </div>
                    )}

                    {/* Already sent — read only */}
                    {!isActionable && (
                      <div className="pw-pop-sent">
                        <div>{getPipelineLabel(m.pipeline_status)} — no action needed</div>
                        {m.notes && (
                          <div className="pw-pop-sent-notes">
                            <span className="pw-pop-sent-notes-label">Field notes:</span>
                            <p>{m.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pw-pop-footer">
              {/* Bulk action: confirm all pending */}
              {popMeas.some(m => m.pipeline_status === 'pending_sample') && (
                <button
                  className="pw-pop-bulk"
                  onClick={() => {
                    popMeas.filter(m => m.pipeline_status === 'pending_sample').forEach(m => confirmSample(m));
                  }}
                >
                  Confirm all pending ({popMeas.filter(m => m.pipeline_status === 'pending_sample').length})
                </button>
              )}
              <button className="pw-pop-btn-close" onClick={() => setOpenVisitId(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const css = `
.pw{padding:1.5rem;width:100%;font-family:var(--font-sans)}
.pw-header{margin-bottom:1rem}
.pw-header h1{font-size:18px;font-weight:600;color:var(--color-text-primary);margin-bottom:2px}
.pw-header p{font-size:13px;color:var(--color-text-secondary)}
.pw-summary{display:flex;gap:10px;margin-bottom:1rem;flex-wrap:wrap}
.pw-sum-item{display:flex;flex-direction:column;padding:10px 16px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);min-width:80px}
.pw-sum-val{font-size:20px;font-weight:600}
.pw-sum-lbl{font-size:10px;color:var(--color-text-secondary)}
.pw-filters{display:flex;gap:6px;margin-bottom:1.25rem;flex-wrap:wrap}
.pw-fbtn{padding:6px 12px;font-size:12px;font-weight:500;font-family:var(--font-sans);border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-secondary);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:5px}
.pw-fbtn:hover{border-color:var(--color-border-info);color:var(--color-text-info)}
.pw-fbtn.active{background:var(--color-background-info);border-color:var(--color-border-info);color:var(--color-text-info)}
.pw-fcnt{font-size:10px;font-weight:600;background:var(--color-background-secondary);padding:1px 6px;border-radius:8px}
.pw-fbtn.active .pw-fcnt{background:rgba(55,138,221,0.15)}

.pw-days{display:flex;flex-direction:column;gap:14px}
.pw-day{border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);overflow:hidden}
.pw-today{border-color:#378ADD;box-shadow:0 0 0 1px #378ADD22}
.pw-past{opacity:0.55}
.pw-day-hdr{display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--color-background-secondary);border-bottom:0.5px solid var(--color-border-tertiary)}
.pw-today .pw-day-hdr{background:#EBF3FB}
.pw-day-lbl{font-size:13px;font-weight:600;color:var(--color-text-primary)}
.pw-today .pw-day-lbl{color:#378ADD}
.pw-day-full{font-size:11px;color:var(--color-text-tertiary)}
.pw-day-cnt{font-size:10px;color:var(--color-text-secondary);margin-left:auto;background:var(--color-background-primary);padding:2px 8px;border-radius:8px}
.pw-day-body{padding:8px}

.pw-visit{padding:10px 12px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);margin-bottom:6px;background:var(--color-background-primary);cursor:pointer;transition:border-color .15s}
.pw-visit:last-child{margin-bottom:0}
.pw-visit:hover{border-color:var(--color-border-info)}
.pw-visit-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}
.pw-visit-left{display:flex;align-items:center;gap:8px;min-width:0}
.pw-visit-name{font-size:13px;font-weight:600;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pw-visit-code{font-size:10px;color:var(--color-text-tertiary);background:var(--color-background-secondary);padding:1px 6px;border-radius:3px;flex-shrink:0}
.pw-visit-right{display:flex;align-items:center;gap:6px;flex-shrink:0}
.pw-tag-pending{font-size:10px;font-weight:600;color:#BA7517;background:#FFF7ED;padding:2px 8px;border-radius:var(--border-radius-md)}
.pw-chevron-right{width:14px;height:14px;color:var(--color-text-tertiary)}
.pw-visit-plan{font-size:11px;color:var(--color-text-secondary);margin-bottom:2px}

.pw-meas-list{display:flex;flex-direction:column;gap:3px;margin-top:6px;padding-top:6px;border-top:0.5px solid var(--color-border-tertiary)}
.pw-meas{display:flex;align-items:center;gap:6px;font-size:12px;padding:2px 0}
.pw-meas-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.pw-meas-name{color:var(--color-text-primary);font-weight:500}
.pw-meas-badge{font-size:9px;padding:1px 6px;border-radius:3px;font-weight:500;white-space:nowrap}

.pw-empty{text-align:center;padding:3rem 1rem;color:var(--color-text-secondary);font-size:14px;border:0.5px dashed var(--color-border-tertiary);border-radius:var(--border-radius-lg)}

/* ========== Visit Popup ========== */
.pw-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-family:var(--font-sans)}
.pw-popup{background:var(--color-background-primary);border-radius:10px;width:520px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.18);border:0.5px solid var(--color-border-tertiary)}

.pw-pop-hdr{display:flex;align-items:flex-start;justify-content:space-between;padding:16px 20px 12px;border-bottom:0.5px solid var(--color-border-tertiary);flex-shrink:0}
.pw-pop-title{font-size:15px;font-weight:600;color:var(--color-text-primary)}
.pw-pop-subtitle{font-size:11px;color:var(--color-text-secondary);margin-top:2px}
.pw-pop-close{background:none;border:0.5px solid var(--color-border-tertiary);border-radius:4px;width:26px;height:26px;font-size:16px;cursor:pointer;color:var(--color-text-secondary);display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0}
.pw-pop-close:hover{background:var(--color-background-secondary);color:var(--color-text-primary)}

.pw-pop-body{flex:1;overflow-y:auto;padding:8px 20px}

/* Each measurement card in popup */
.pw-pop-meas{border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:12px;margin-bottom:8px}
.pw-pop-meas:last-child{margin-bottom:0}
.pw-pop-meas-done{opacity:0.5}
.pw-pop-meas-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.pw-pop-meas-name{font-size:13px;font-weight:600;color:var(--color-text-primary)}
.pw-pop-meas-badge{font-size:10px;padding:2px 8px;border-radius:var(--border-radius-md);font-weight:500}
.pw-pop-meas-info{display:flex;gap:10px;font-size:10px;color:var(--color-text-secondary);margin-bottom:6px}

/* Field data entry */
.pw-pop-entry{border-top:0.5px solid var(--color-border-tertiary);padding-top:8px;margin-top:6px}
.pw-pop-entry-label{font-size:11px;font-weight:500;color:var(--color-text-secondary);margin-bottom:6px}
.pw-pop-optional{font-weight:400;color:var(--color-text-tertiary);font-size:10px}
.pw-pop-params{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:6px}
.pw-pop-param{display:flex;flex-direction:column;gap:2px}
.pw-pop-plbl{font-size:10px;color:var(--color-text-secondary)}
.pw-pop-punit{color:var(--color-text-tertiary)}
.pw-pop-pinput{padding:5px 8px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:12px;color:var(--color-text-primary);font-family:var(--font-sans);outline:none;width:100%;box-sizing:border-box}
.pw-pop-pinput:focus{border-color:#378ADD}
.pw-pop-notes-row{display:flex;gap:4px;margin-bottom:6px;align-items:flex-start}
.pw-pop-notes{flex:1;padding:5px 8px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:11px;color:var(--color-text-primary);font-family:var(--font-sans);outline:none;resize:vertical;box-sizing:border-box}
.pw-pop-notes:focus{border-color:#378ADD}
.pw-pop-ai-btn{width:30px;height:30px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);background:var(--color-background-secondary);color:var(--color-text-info);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.pw-pop-ai-btn:hover:not(:disabled){background:var(--color-background-info);border-color:var(--color-border-info)}
.pw-pop-ai-btn:disabled{opacity:0.6;cursor:wait}
.pw-pop-ai-btn.loading{background:var(--color-background-info)}
.pw-pop-ai-spinner{width:12px;height:12px;border:2px solid var(--color-border-info);border-top-color:var(--color-text-info);border-radius:50%;animation:pw-spin .6s linear infinite}
@keyframes pw-spin{to{transform:rotate(360deg)}}
.pw-pop-sent-notes{margin-top:6px;padding:6px 8px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);font-size:11px}
.pw-pop-sent-notes-label{font-weight:500;color:var(--color-text-secondary);font-size:10px}
.pw-pop-sent-notes p{margin:2px 0 0;color:var(--color-text-primary);white-space:pre-wrap}

.pw-pop-action{width:100%;padding:7px;border:none;border-radius:var(--border-radius-md);background:#378ADD;color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-sans);transition:background .15s}
.pw-pop-action:hover{background:#2a7acc}
.pw-pop-action-transit{background:#BA7517}
.pw-pop-action-transit:hover{background:#9a6212}

.pw-pop-sent{font-size:11px;color:var(--color-text-tertiary);padding-top:4px}

/* Footer */
.pw-pop-footer{display:flex;gap:8px;padding:12px 20px;border-top:0.5px solid var(--color-border-tertiary);justify-content:flex-end;flex-shrink:0}
.pw-pop-bulk{padding:7px 16px;border:none;border-radius:var(--border-radius-md);background:#378ADD;color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-sans)}
.pw-pop-bulk:hover{background:#2a7acc}
.pw-pop-btn-close{padding:7px 16px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:none;color:var(--color-text-secondary);font-size:12px;cursor:pointer;font-family:var(--font-sans)}
.pw-pop-btn-close:hover{border-color:var(--color-border-info);color:var(--color-text-info)}

@media(max-width:600px){
  .pw-summary{flex-direction:row;gap:6px}
  .pw-sum-item{flex:1;min-width:0;padding:8px 10px}
  .pw-sum-val{font-size:16px}
  .pw-popup{width:100%;border-radius:0;max-height:100vh}
  .pw-pop-params{grid-template-columns:1fr}
}
`;
