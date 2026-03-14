import { useState } from 'react';
import { useUser } from '../../context/UserContext';
import { useDatabase } from '../../context/DatabaseContext';
import type { PipelineStatus, Measurement } from '../../types';

const pipelineColors: Record<string, { bg: string; color: string }> = {
  pending_sample: { bg: '#F1F5F9', color: '#64748B' },
  sampled: { bg: '#EFF6FF', color: '#378ADD' },
  in_transit: { bg: '#FFF7ED', color: '#BA7517' },
  in_lab: { bg: '#FEF3C7', color: '#D97706' },
  analyzed: { bg: '#ECFDF5', color: '#059669' },
  validated: { bg: '#F0FDF4', color: '#639922' },
  rejected: { bg: '#FEF2F2', color: '#E24B4A' },
};

// Lab status transitions
const LAB_EDITABLE: PipelineStatus[] = ['in_transit', 'in_lab', 'analyzed'];
const LAB_TRANSITIONS: Partial<Record<PipelineStatus, PipelineStatus>> = {
  in_transit: 'in_lab',
  in_lab: 'analyzed',
};

const TRANSITION_LABELS: Partial<Record<PipelineStatus, string>> = {
  pending_sample: 'Mark as Sampled',
  sampled: 'Send to Transit',
  in_transit: 'Confirm Received in Lab',
  in_lab: 'Submit Results',
};

export default function LabQueue() {
  const { measurements: allMeasurements, locations, measurementTemplates, users, visits, monitoringPlans, getPipelineLabel } = useDatabase();
  const { currentUser } = useUser();

  // Local mutable copy of measurements for status changes
  const [measurements, setMeasurements] = useState(allMeasurements);

  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [formNotes, setFormNotes] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // Lab queue: show measurements assigned to this lab worker
  const myMeasurements = measurements
    .filter(m => m.lab_assignee_id === currentUser.id)
    .sort((a, b) => {
      const priority: Record<string, number> = { in_lab: 0, in_transit: 1, analyzed: 2, validated: 3, pending_sample: 4, sampled: 5 };
      const pa = priority[a.pipeline_status] ?? 9;
      const pb = priority[b.pipeline_status] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.planned_date.localeCompare(b.planned_date);
    });

  const transit = myMeasurements.filter(m => m.pipeline_status === 'in_transit').length;
  const inLab = myMeasurements.filter(m => m.pipeline_status === 'in_lab').length;
  const analyzed = myMeasurements.filter(m => m.pipeline_status === 'analyzed').length;

  type FilterDef = { key: string; label: string; count: number };
  const filterDefs: FilterDef[] = [
    { key: 'all', label: 'All', count: myMeasurements.length },
    { key: 'in_transit', label: 'In Transit', count: transit },
    { key: 'in_lab', label: 'In Lab', count: inLab },
    { key: 'analyzed', label: 'Analyzed', count: analyzed },
  ];

  const filteredMeasurements = filter === 'all'
    ? myMeasurements
    : myMeasurements.filter(m => m.pipeline_status === filter);

  const statCards = [
    { label: 'In Transit', value: transit, color: '#BA7517', sub: 'Arriving soon' },
    { label: 'In Lab', value: inLab, color: '#D97706', sub: 'Ready to analyze' },
    { label: 'Analyzed', value: analyzed, color: '#059669', sub: 'Awaiting validation' },
    { label: 'Total Active', value: transit + inLab + analyzed, color: '#378ADD', sub: 'In pipeline' },
      ];

  // Permission helpers (lab-only)
  const canEdit = (m: Measurement): boolean => LAB_EDITABLE.includes(m.pipeline_status);
  const getNextStatus = (m: Measurement): PipelineStatus | null => LAB_TRANSITIONS[m.pipeline_status] ?? null;
  const hasResults = (m: Measurement) => m.results && Object.keys(m.results).length > 0;

  // Actions
  const advanceStatus = (mId: string) => {
    setMeasurements(prev => prev.map(m => {
      if (m.id !== mId) return m;
      const next = LAB_TRANSITIONS[m.pipeline_status];
      if (!next) return m;

      // If advancing to 'analyzed', require results
      if (next === 'analyzed') {
        const template = measurementTemplates.find(t => t.id === m.measurement_template_id);
        const fd = formData[m.id];
        if (template && (!fd || !template.parameters.every(p => fd[p.key]))) return m;
        const results: Record<string, number> = {};
        for (const p of template?.parameters ?? []) {
          results[p.key] = parseFloat(fd?.[p.key] ?? '0');
        }
        return { ...m, pipeline_status: next, results, notes: formNotes[m.id] || m.notes };
      }
      return { ...m, pipeline_status: next };
    }));
    setExpandedId(null);
    setEditingId(null);
  };

  // Save edited results without changing status
  const saveResults = (mId: string) => {
    setMeasurements(prev => prev.map(m => {
      if (m.id !== mId) return m;
      const template = measurementTemplates.find(t => t.id === m.measurement_template_id);
      const fd = formData[m.id];
      if (!template || !fd) return m;
      const results: Record<string, number> = {};
      for (const p of template.parameters) {
        results[p.key] = parseFloat(fd[p.key] ?? String(m.results?.[p.key] ?? 0));
      }
      return { ...m, results, notes: formNotes[m.id] ?? m.notes };
    }));
    setEditingId(null);
  };

  // Start editing an analyzed entry — populate form with existing results
  const startEditing = (m: Measurement) => {
    const template = measurementTemplates.find(t => t.id === m.measurement_template_id);
    if (!template || !m.results) return;
    const fd: Record<string, string> = {};
    for (const p of template.parameters) {
      fd[p.key] = String(m.results[p.key] ?? '');
    }
    setFormData(prev => ({ ...prev, [m.id]: fd }));
    setFormNotes(prev => ({ ...prev, [m.id]: m.notes ?? '' }));
    setEditingId(m.id);
    setExpandedId(m.id);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

  const handleParamChange = (measurementId: string, paramKey: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [measurementId]: { ...(prev[measurementId] || {}), [paramKey]: value },
    }));
  };

  const handleNotesChange = (measurementId: string, value: string) => {
    setFormNotes(prev => ({ ...prev, [measurementId]: value }));
  };

  const pageTitle = 'Lab Queue';
  const pageDesc = 'Samples assigned to you for laboratory analysis';

  return (
    <>
      <style>{css}</style>
      <div className="lq">
        <div className="lq-header">
          <h1>{pageTitle}</h1>
          <p>{pageDesc}</p>
        </div>

        <div className="lq-stats">
          {statCards.map(s => (
            <div className="lq-stat" key={s.label}>
              <div className="lq-stat-label">{s.label}</div>
              <div className="lq-stat-val" style={{ color: s.color }}>{s.value}</div>
              <div className="lq-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="lq-filters">
          {filterDefs.map(fd => (
            <button
              key={fd.key}
              className={`lq-filter-btn${filter === fd.key ? ' active' : ''}`}
              onClick={() => setFilter(fd.key)}
            >
              {fd.label} ({fd.count})
            </button>
          ))}
        </div>

        <div className="lq-list">
          {filteredMeasurements.length === 0 ? (
            <div className="lq-empty">No samples match the current filter.</div>
          ) : (
            filteredMeasurements.map(m => {
              const location = locations.find(l => l.id === m.location_id);
              const template = measurementTemplates.find(t => t.id === m.measurement_template_id);
              const collector = users.find(u => u.id === m.recorded_by);
              const fieldWorker = users.find(u => u.id === m.assignee_id);

              const visit = visits.find(v => v.id === m.visit_id);
              const plan = visit ? monitoringPlans.find(p => p.id === visit.plan_id) : null;
              const validator = m.validated_by ? users.find(u => u.id === m.validated_by) : null;
              const pc = pipelineColors[m.pipeline_status] || pipelineColors.pending_sample;
              const isExpanded = expandedId === m.id;
              const editable = canEdit(m);
              const nextStatus = getNextStatus(m);
              const currentFormData = formData[m.id] || {};

              // Can advance in_transit -> in_lab without expanding
              const canConfirmReceipt = m.pipeline_status === 'in_transit';
              // Need to expand for analysis results entry
              const needsExpand = m.pipeline_status === 'in_lab' || m.pipeline_status === 'analyzed';
              const isEditingThis = editingId === m.id;

              return (
                <div key={m.id} className="lq-card">
                  <div className="lq-card-main" onClick={() => toggleExpand(m.id)}>
                    <div className="lq-card-top">
                      <div className="lq-card-title">
                        {(m.pipeline_status === 'in_lab' || m.pipeline_status === 'in_transit') && (
                          <span className="lq-priority" style={{ background: pc.color }} />
                        )}
                        <span className="lq-card-template">{template?.name ?? 'Unknown'}</span>
                        <span className="lq-card-location">— {location?.name ?? 'Unknown'}</span>
                      </div>
                      <div className="lq-card-top-right">
                        <span className="lq-card-badge" style={{ background: pc.bg, color: pc.color }}>
                          {getPipelineLabel(m.pipeline_status)}
                        </span>
                        {/* Quick action: confirm receipt */}
                        {canConfirmReceipt && nextStatus && (
                          <button
                            className="lq-advance-btn"
                            style={{ background: pipelineColors[nextStatus]?.color || '#378ADD' }}
                            onClick={e => { e.stopPropagation(); advanceStatus(m.id); }}
                          >
                            {TRANSITION_LABELS[m.pipeline_status]}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="lq-card-meta">
                      <div className="lq-meta-item">
                        <span className="lq-meta-label">Collected by</span>
                        <span className="lq-meta-value">{collector?.full_name ?? fieldWorker?.full_name ?? '—'}</span>
                      </div>
                      <div className="lq-meta-item">
                        <span className="lq-meta-label">{m.measurement_date ? 'Sampled on' : 'Planned date'}</span>
                        <span className="lq-meta-value">{formatDate(m.measurement_date || m.planned_date)}</span>
                      </div>
                      <div className="lq-meta-item">
                        <span className="lq-meta-label">Assigned to lab</span>
                        <span className="lq-meta-value">{m.lab_assigned_at ? formatDateTime(m.lab_assigned_at) : '—'}</span>
                      </div>
                      <div className="lq-meta-item">
                        <span className="lq-meta-label">Plan</span>
                        <span className="lq-meta-value">{plan?.name ?? '—'}</span>
                      </div>
                      {location && (
                        <div className="lq-meta-item">
                          <span className="lq-meta-label">Station code</span>
                          <span className="lq-meta-value">{location.code}</span>
                        </div>
                      )}
                      {validator && (
                        <div className="lq-meta-item">
                          <span className="lq-meta-label">Validated by</span>
                          <span className="lq-meta-value">{validator.full_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lq-card-expand" onClick={() => toggleExpand(m.id)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isExpanded ? 'open' : ''}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                    {needsExpand && editable && m.pipeline_status === 'in_lab' ? 'Enter results' : isEditingThis ? 'Editing results' : hasResults(m) ? 'View results' : 'Details'}
                  </div>

                  {isExpanded && (
                    <div className="lq-analysis">
                      <div className="lq-analysis-header">
                        <span className="lq-analysis-title">
                          {editable && m.pipeline_status === 'in_lab' ? 'Enter Analysis Results' : isEditingThis ? 'Edit Analysis Results' : 'Analysis Results'}
                        </span>
                        {template && (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                            {template.parameters.length} parameters · €{template.unit_cost}
                          </span>
                        )}
                      </div>

                      {/* Editable form: in_lab (new entry) or editing analyzed */}
                      {editable && (m.pipeline_status === 'in_lab' || isEditingThis) && template ? (
                        <>
                          <div className="lq-analysis-grid">
                            {template.parameters.map(param => (
                              <div key={param.key} className="lq-param">
                                <label className="lq-param-label">
                                  {param.label}
                                  {param.unit && <span className="lq-param-unit">({param.unit})</span>}
                                </label>
                                {(param.min !== undefined || param.max !== undefined) && (
                                  <span className="lq-param-range">
                                    Range: {param.min ?? '—'} – {param.max ?? '—'}
                                  </span>
                                )}
                                <input
                                  type="number"
                                  className={`lq-param-input${currentFormData[param.key] ? ' has-value' : ''}`}
                                  placeholder={`Enter ${param.label.toLowerCase()}`}
                                  value={currentFormData[param.key] || ''}
                                  onChange={e => handleParamChange(m.id, param.key, e.target.value)}
                                  step="any"
                                  min={param.min}
                                  max={param.max}
                                />
                              </div>
                            ))}
                          </div>
                          <textarea
                            className="lq-notes-input"
                            placeholder="Add analysis notes (optional)..."
                            value={formNotes[m.id] || ''}
                            onChange={e => handleNotesChange(m.id, e.target.value)}
                            rows={2}
                          />
                          <div className="lq-analysis-actions">
                            <button className="lq-btn lq-btn-secondary" onClick={() => { setExpandedId(null); setEditingId(null); }}>Cancel</button>
                            {m.pipeline_status === 'in_lab' ? (
                              <button
                                className="lq-btn lq-btn-primary"
                                disabled={!template.parameters.every(p => currentFormData[p.key])}
                                onClick={() => advanceStatus(m.id)}
                              >
                                Submit Results
                              </button>
                            ) : (
                              <button
                                className="lq-btn lq-btn-primary"
                                disabled={!template.parameters.every(p => currentFormData[p.key])}
                                onClick={() => saveResults(m.id)}
                              >
                                Save Changes
                              </button>
                            )}
                          </div>
                        </>
                      ) : hasResults(m) && template ? (
                        /* View results (read-only) + edit button for analyzed */
                        <>
                          <div className="lq-results-display">
                            {template.parameters.map(param => (
                              <div key={param.key} className="lq-result-item">
                                <div className="lq-result-label">{param.label}</div>
                                <div className="lq-result-value">
                                  {m.results?.[param.key] ?? '—'}
                                  {param.unit && <span className="lq-result-unit"> {param.unit}</span>}
                                </div>
                              </div>
                            ))}
                            {m.notes && (
                              <div className="lq-result-item" style={{ gridColumn: '1 / -1' }}>
                                <div className="lq-result-label">Notes</div>
                                <div className="lq-result-value" style={{ fontSize: '12px', fontWeight: 400 }}>{m.notes}</div>
                              </div>
                            )}
                          </div>
                          {editable && m.pipeline_status === 'analyzed' && (
                            <div className="lq-analysis-actions">
                              <button className="lq-btn lq-btn-secondary" onClick={() => startEditing(m)}>
                                Edit Results
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        /* No results yet */
                        <div style={{ padding: '12px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          {m.pipeline_status === 'in_transit'
                            ? 'Sample is in transit to the lab. Analysis can begin once it arrives.'
                            : m.pipeline_status === 'pending_sample'
                            ? 'Sample has not been collected yet.'
                            : m.pipeline_status === 'sampled'
                            ? 'Sample collected. Ready to be sent to the lab.'
                            : 'No results available yet.'}
                        </div>
                      )}

                      {/* Status advance from expanded view (for statuses that need expand) */}
                      {editable && nextStatus && m.pipeline_status !== 'in_lab' && (
                        <div className="lq-analysis-actions">
                          <button
                            className="lq-btn lq-btn-primary"
                            onClick={() => advanceStatus(m.id)}
                          >
                            {TRANSITION_LABELS[m.pipeline_status] ?? `Move to ${getPipelineLabel(nextStatus)}`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

const css = `
.lq{padding:2rem 1.5rem;width:100%;font-family:var(--font-sans)}
.lq-header{margin-bottom:1.5rem}
.lq-header h1{font-size:18px;font-weight:600;color:var(--color-text-primary);margin-bottom:4px}
.lq-header p{font-size:13px;color:var(--color-text-secondary)}
.lq-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.5rem}
.lq-stat{background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:12px 14px}
.lq-stat-label{font-size:11px;color:var(--color-text-secondary);margin-bottom:2px}
.lq-stat-val{font-size:20px;font-weight:500;color:var(--color-text-primary)}
.lq-stat-sub{font-size:10px;color:var(--color-text-secondary);margin-top:2px}
.lq-filters{display:flex;gap:8px;margin-bottom:1rem;flex-wrap:wrap}
.lq-filter-btn{padding:6px 14px;font-size:12px;font-weight:500;font-family:var(--font-sans);border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-secondary);cursor:pointer;transition:all .15s}
.lq-filter-btn:hover{border-color:var(--color-border-info);color:var(--color-text-info)}
.lq-filter-btn.active{background:var(--color-background-info);border-color:var(--color-border-info);color:var(--color-text-info)}
.lq-list{display:flex;flex-direction:column;gap:10px}
.lq-card{border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);background:var(--color-background-primary);overflow:hidden;transition:border-color .15s}
.lq-card:hover{border-color:var(--color-border-secondary)}
.lq-card-main{padding:14px 16px;cursor:pointer}
.lq-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px}
.lq-card-top-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.lq-card-title{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden}
.lq-card-template{font-size:14px;font-weight:500;color:var(--color-text-primary);white-space:nowrap}
.lq-card-location{font-size:12px;color:var(--color-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lq-card-badge{font-size:10px;padding:3px 10px;border-radius:var(--border-radius-md);font-weight:500;white-space:nowrap}
.lq-card-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;font-size:12px}
.lq-meta-item{display:flex;flex-direction:column;gap:1px}
.lq-meta-label{font-size:10px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.3px}
.lq-meta-value{color:var(--color-text-primary);font-weight:500}
.lq-card-expand{display:flex;align-items:center;justify-content:center;gap:4px;padding:6px;font-size:11px;color:var(--color-text-tertiary);border-top:0.5px solid var(--color-border-tertiary);cursor:pointer}
.lq-card-expand svg{width:12px;height:12px;transition:transform .15s}
.lq-card-expand svg.open{transform:rotate(180deg)}
.lq-analysis{padding:0 16px 16px;border-top:0.5px solid var(--color-border-tertiary)}
.lq-analysis-header{display:flex;align-items:center;justify-content:space-between;padding:12px 0 10px}
.lq-analysis-title{font-size:13px;font-weight:500;color:var(--color-text-primary)}
.lq-analysis-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.lq-param{display:flex;flex-direction:column;gap:4px}
.lq-param-label{font-size:11px;color:var(--color-text-secondary);display:flex;align-items:center;gap:4px}
.lq-param-unit{color:var(--color-text-tertiary);font-size:10px}
.lq-param-range{font-size:10px;color:var(--color-text-tertiary)}
.lq-param-input{width:100%;padding:7px 10px;font-size:13px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-primary);font-family:var(--font-sans);outline:none;transition:border-color .15s;box-sizing:border-box}
.lq-param-input:focus{border-color:var(--color-border-info)}
.lq-param-input:disabled{background:var(--color-background-secondary);color:var(--color-text-secondary)}
.lq-param-input.has-value{border-color:var(--color-border-info);background:var(--color-background-info)}
.lq-analysis-actions{display:flex;gap:8px;margin-top:14px;justify-content:flex-end}
.lq-btn{padding:7px 16px;font-size:12px;font-weight:500;font-family:var(--font-sans);border-radius:var(--border-radius-md);cursor:pointer;transition:all .15s}
.lq-btn-primary{background:#378ADD;color:white;border:none}
.lq-btn-primary:hover{background:#2d78c4}
.lq-btn-primary:disabled{opacity:0.5;cursor:not-allowed}
.lq-btn-secondary{background:none;border:0.5px solid var(--color-border-secondary);color:var(--color-text-secondary)}
.lq-btn-secondary:hover{border-color:var(--color-border-info);color:var(--color-text-info)}
.lq-results-display{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.lq-result-item{background:var(--color-background-secondary);padding:8px 10px;border-radius:var(--border-radius-md)}
.lq-result-label{font-size:10px;color:var(--color-text-secondary)}
.lq-result-value{font-size:14px;font-weight:500;color:var(--color-text-primary)}
.lq-result-unit{font-size:11px;color:var(--color-text-tertiary)}
.lq-notes-input{width:100%;padding:7px 10px;font-size:12px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-primary);font-family:var(--font-sans);outline:none;resize:vertical;min-height:36px;box-sizing:border-box;margin-top:10px}
.lq-notes-input:focus{border-color:var(--color-border-info)}
.lq-empty{text-align:center;padding:3rem 1rem;color:var(--color-text-secondary);font-size:14px}
.lq-priority{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;flex-shrink:0}

/* Advance status button */
.lq-advance-btn{padding:4px 12px;font-size:10px;font-weight:600;color:white;border:none;border-radius:var(--border-radius-md);cursor:pointer;font-family:var(--font-sans);white-space:nowrap;transition:opacity .15s}
.lq-advance-btn:hover{opacity:0.85}

@media(max-width:600px){.lq-stats{grid-template-columns:repeat(2,1fr)}.lq-analysis-grid{grid-template-columns:1fr}.lq-card-top{flex-direction:column;align-items:flex-start}.lq-card-top-right{width:100%;justify-content:space-between}}
`;
