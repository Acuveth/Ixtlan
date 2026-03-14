import { useState, useCallback, useMemo, Fragment } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useUser } from '../../context/UserContext';
import type { PipelineStatus } from '../../types';

const PIPELINE_STAGES: PipelineStatus[] = [
  'pending_sample',
  'sampled',
  'in_transit',
  'in_lab',
  'analyzed',
  'validated',
];

const STAGE_LABELS: Record<string, string> = {
  pending_sample: 'Pending',
  sampled: 'Sampled',
  in_transit: 'Transit',
  in_lab: 'In lab',
  analyzed: 'Analyzed',
  validated: 'Validated',
  rejected: 'Rejected',
};

const STAGE_COLORS: Record<string, string> = {
  pending_sample: '#9ca3af',
  sampled: '#378ADD',
  in_transit: '#BA7517',
  in_lab: '#D85A30',
  analyzed: '#639922',
  validated: '#1D9E75',
  rejected: '#E24B4A',
};

interface PipelineItem {
  id: string;
  label: string;
  pipelineStatus: PipelineStatus;
  locationName: string;
  templateName: string;
  measurementId: string;
  plannedDate: string;
  actualDate: string;
  // Chain of custody
  plannedBy: string;
  assignedTo: string;
  collectedBy: string;
  collectedOn: string;
  labWorker: string;
  labAssignedAt: string;
  validatedBy: string;
  validatedAt: string;
  // Other
  planName: string;
  cost: string;
  results: Record<string, number> | null;
  parameters: { key: string; label: string; unit: string; min?: number; max?: number }[];
  notes: string;
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateTime(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PipelineTracker() {
  const { measurements, locations, measurementTemplates, users, visits, monitoringPlans } = useDatabase();
  const { currentUser } = useUser();
  const [filterStatus, setFilterStatus] = useState<string>('in_progress');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [custodyOpenId, setCustodyOpenId] = useState<string | null>(null);

  const items = useMemo<PipelineItem[]>(() => {
    // Field workers only see their assigned measurements
    // Lab workers only see their assigned measurements
    const source = currentUser.role === 'field_worker'
      ? measurements.filter(m => m.assignee_id === currentUser.id)
      : currentUser.role === 'lab_worker'
      ? measurements.filter(m => m.lab_assignee_id === currentUser.id)
      : measurements;

    return source.map((m) => {
      const loc = locations.find((l) => l.id === m.location_id);
      const tmpl = measurementTemplates.find((t) => t.id === m.measurement_template_id);
      const visit = visits.find(v => v.id === m.visit_id);
      const plan = visit ? monitoringPlans.find(p => p.id === visit.plan_id) : null;
      const planner = plan ? users.find(u => u.id === plan.created_by) : null;
      const assignee = users.find((u) => u.id === m.assignee_id);
      const collector = m.recorded_by ? users.find(u => u.id === m.recorded_by) : null;
      const labUser = m.lab_assignee_id ? users.find(u => u.id === m.lab_assignee_id) : null;
      const validator = m.validated_by ? users.find((u) => u.id === m.validated_by) : null;

      return {
        id: m.id,
        label: `${tmpl?.name ?? 'Unknown'}`,
        pipelineStatus: m.pipeline_status,
        locationName: loc?.name ?? '',
        templateName: tmpl?.name ?? '',
        measurementId: m.id.toUpperCase(),
        plannedDate: fmtDate(m.planned_date),
        actualDate: fmtDate(m.measurement_date),
        plannedBy: planner?.full_name ?? '\u2014',
        assignedTo: assignee?.full_name ?? '\u2014',
        collectedBy: collector?.full_name ?? '\u2014',
        collectedOn: fmtDate(m.measurement_date),
        labWorker: labUser?.full_name ?? '\u2014',
        labAssignedAt: fmtDateTime(m.lab_assigned_at),
        validatedBy: validator?.full_name ?? '\u2014',
        validatedAt: fmtDateTime(m.validated_at),
        planName: plan?.name ?? '\u2014',
        cost: m.analysis_cost ? `\u20AC${m.analysis_cost}` : '\u2014',
        results: m.results ?? null,
        parameters: tmpl?.parameters ?? [],
        notes: m.notes ?? '',
      };
    });
  }, [currentUser.id, currentUser.role]);

  const [overrides, setOverrides] = useState<Record<string, PipelineStatus>>({});

  const getStatus = useCallback((item: PipelineItem) => {
    return overrides[item.id] ?? item.pipelineStatus;
  }, [overrides]);

  const IN_PROGRESS_STAGES: PipelineStatus[] = ['sampled', 'in_transit', 'in_lab', 'analyzed'];
  const inProgressCount = items.filter(m => IN_PROGRESS_STAGES.includes(getStatus(m))).length;

  const filtered = filterStatus === 'all'
    ? items
    : filterStatus === 'in_progress'
    ? items.filter(m => IN_PROGRESS_STAGES.includes(getStatus(m)))
    : items.filter((m) => getStatus(m) === filterStatus);

  const stageCounts = PIPELINE_STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage] = items.filter((m) => getStatus(m) === stage).length;
    return acc;
  }, {});

  const advanceStage = useCallback((id: string) => {
    setOverrides((prev) => {
      const item = items.find((m) => m.id === id);
      if (!item) return prev;
      const currentStatus = prev[id] ?? item.pipelineStatus;
      const idx = PIPELINE_STAGES.indexOf(currentStatus);
      if (idx < 0 || idx >= PIPELINE_STAGES.length - 1) return prev;
      return { ...prev, [id]: PIPELINE_STAGES[idx + 1] };
    });
  }, [items]);

  return (
    <>
      <style>{`
.pt{font-family:var(--font-sans);padding:1.25rem 1.5rem;width:100%}
.pt-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;gap:12px}
.pt-title{font-size:16px;font-weight:500;color:var(--color-text-primary)}
.pt-count{font-size:12px;color:var(--color-text-tertiary);margin-left:6px;font-weight:400}

.pt-pills{display:flex;gap:4px;margin-bottom:1rem;flex-wrap:wrap}
.pt-pill{display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:var(--border-radius-md);font-size:11px;font-weight:500;cursor:pointer;border:0.5px solid var(--color-border-tertiary);background:var(--color-background-primary);color:var(--color-text-secondary);transition:all .12s;white-space:nowrap}
.pt-pill:hover{border-color:var(--color-border-secondary)}
.pt-pill.active{color:white}
.pt-pill-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.pt-pill-count{font-size:10px;opacity:0.7}

.pt-table{width:100%;border-collapse:collapse}
.pt-th{text-align:left;font-size:10px;font-weight:500;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.3px;padding:6px 10px;border-bottom:0.5px solid var(--color-border-tertiary)}
.pt-th:last-child{text-align:right}
.pt-row{cursor:pointer;transition:background .1s}
.pt-row:hover{background:var(--color-background-secondary)}
.pt-row td{padding:8px 10px;border-bottom:0.5px solid var(--color-border-tertiary);font-size:12px;color:var(--color-text-primary);vertical-align:middle}
.pt-row.expanded td{border-bottom:none;background:var(--color-background-secondary)}
.pt-row-label{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
.pt-row-loc{color:var(--color-text-secondary);font-size:11px}
.pt-badge-sm{font-size:10px;font-weight:500;padding:2px 7px;border-radius:3px;white-space:nowrap;display:inline-block}
.pt-row-meta{color:var(--color-text-secondary);font-size:11px;white-space:nowrap}
.pt-row-mid{font-family:monospace;font-size:10px;color:var(--color-text-tertiary);text-align:right;white-space:nowrap}

.pt-dots{display:flex;gap:3px;align-items:center}
.pt-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;transition:all .2s}
.pt-dot-done{background:#639922}
.pt-dot-active{box-shadow:0 0 0 2px rgba(55,138,221,0.3)}
.pt-dot-future{background:var(--color-border-tertiary)}

.pt-expand{background:var(--color-background-secondary);border-bottom:0.5px solid var(--color-border-tertiary)}
.pt-expand-inner{padding:10px 10px 12px}

.pt-expand-stepper{display:flex;align-items:center;gap:2px;margin-bottom:10px}
.pt-mini-step{display:flex;align-items:center}
.pt-mini-circle{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;color:#fff;flex-shrink:0}
.pt-mini-circle-done{background:#639922}
.pt-mini-circle-active{background:#378ADD;box-shadow:0 0 0 3px rgba(55,138,221,0.18)}
.pt-mini-circle-future{background:var(--color-background-primary);color:var(--color-text-tertiary);border:0.5px solid var(--color-border-tertiary)}
.pt-mini-connector{width:12px;height:1.5px;border-radius:1px}
.pt-mini-connector-done{background:#639922}
.pt-mini-connector-future{background:var(--color-border-tertiary)}

.pt-custody-toggle{display:flex;align-items:center;gap:6px;padding:4px 0;margin-bottom:6px;cursor:pointer;font-size:11px;color:var(--color-text-secondary);user-select:none}
.pt-custody-toggle:hover{color:var(--color-text-primary)}
.pt-custody-toggle svg{width:10px;height:10px;transition:transform .15s;flex-shrink:0}
.pt-custody-toggle svg.open{transform:rotate(90deg)}
.pt-custody-summary{display:flex;gap:3px;align-items:center;margin-left:auto}
.pt-custody-avatar{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:600;color:white;flex-shrink:0;border:1.5px solid var(--color-background-secondary)}
.pt-custody-avatar:not(:first-child){margin-left:-6px}
.pt-custody{margin-bottom:8px;overflow:hidden}
.pt-custody-timeline{position:relative;padding-left:20px}
.pt-custody-line{position:absolute;left:8px;top:10px;bottom:10px;width:1.5px;background:var(--color-border-tertiary)}
.pt-custody-item{display:flex;align-items:flex-start;gap:8px;padding:4px 0;position:relative;font-size:11px}
.pt-custody-item.inactive .pt-custody-who,.pt-custody-item.inactive .pt-custody-when,.pt-custody-item.inactive .pt-custody-step{opacity:0.35}
.pt-custody-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;position:absolute;left:-16px;top:6px;z-index:1;border:1.5px solid var(--color-background-secondary)}
.pt-custody-dot-ring{box-shadow:0 0 0 2px rgba(55,138,221,0.25)}
.pt-custody-step{font-size:10px;color:var(--color-text-tertiary);width:64px;flex-shrink:0}
.pt-custody-who{color:var(--color-text-primary);font-weight:500;flex:1;min-width:0}
.pt-custody-when{color:var(--color-text-tertiary);font-size:10px;text-align:right;white-space:nowrap}

.pt-expand-meta{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;margin-bottom:8px}
.pt-expand-meta-item{display:flex;flex-direction:column;gap:1px}
.pt-expand-meta-label{font-size:9px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.3px}
.pt-expand-meta-val{color:var(--color-text-primary);font-weight:500}

.pt-expand-results{margin-top:4px}
.pt-expand-results-title{font-size:10px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:6px}
.pt-results-grid{display:flex;gap:6px;flex-wrap:wrap}
.pt-result-chip{display:flex;align-items:baseline;gap:4px;padding:4px 8px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);background:var(--color-background-primary);font-size:11px}
.pt-result-param{color:var(--color-text-secondary);font-size:10px}
.pt-result-value{font-weight:600;color:var(--color-text-primary)}
.pt-result-value.warn{color:#BA7517}
.pt-result-value.danger{color:#E24B4A}
.pt-result-unit{font-size:9px;color:var(--color-text-tertiary)}

.pt-expand-note{margin-top:6px;padding:4px 8px;background:#FEF3C7;border-radius:var(--border-radius-md);font-size:10px;color:#92400E;border:0.5px solid #FDE68A}

.pt-expand-actions{display:flex;gap:6px;margin-top:8px}
.pt-btn{padding:4px 12px;border-radius:var(--border-radius-md);font-size:10px;font-weight:500;cursor:pointer;border:none;font-family:var(--font-sans);transition:opacity .15s}
.pt-btn:hover{opacity:0.85}
.pt-btn-primary{background:#378ADD;color:#fff}
.pt-btn-primary:disabled{background:var(--color-border-tertiary);color:var(--color-text-tertiary);cursor:not-allowed;opacity:1}
.pt-btn-ghost{background:none;color:var(--color-text-secondary);border:0.5px solid var(--color-border-tertiary)}
.pt-btn-danger{background:none;color:#E24B4A;border:0.5px solid #fecaca}
.pt-btn-ghost:disabled,.pt-btn-danger:disabled{opacity:0.35;cursor:not-allowed;pointer-events:none}

.pt-empty{text-align:center;padding:32px 0;font-size:12px;color:var(--color-text-tertiary)}
.pt-check{display:inline-block;width:10px;height:10px}

@media(max-width:600px){
  .pt-pills{overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch}
  .pt-table{display:block}
  .pt-table thead{display:none}
  .pt-table tbody{display:block}
  .pt-row{display:flex;flex-wrap:wrap;gap:4px;padding:8px 10px;align-items:center}
  .pt-row td{border:none;padding:0}
  .pt-custody-row{flex-wrap:wrap;gap:4px}
}
      `}</style>

      <div className="pt">
        <div className="pt-header">
          <div className="pt-title">Pipeline<span className="pt-count">{filtered.length} samples</span></div>
        </div>

        {/* Stage pills */}
        <div className="pt-pills">
          <button
            className={`pt-pill${filterStatus === 'in_progress' ? ' active' : ''}`}
            style={filterStatus === 'in_progress' ? { background: '#BA7517', color: '#fff', borderColor: '#BA7517' } : {}}
            onClick={() => setFilterStatus('in_progress')}
          >
            In Progress <span className="pt-pill-count">{inProgressCount}</span>
          </button>
          <button
            className={`pt-pill${filterStatus === 'all' ? ' active' : ''}`}
            style={filterStatus === 'all' ? { background: '#374151', color: '#fff', borderColor: '#374151' } : {}}
            onClick={() => setFilterStatus('all')}
          >
            All <span className="pt-pill-count">{items.length}</span>
          </button>
          {PIPELINE_STAGES.map(stage => (
            <button
              key={stage}
              className={`pt-pill${filterStatus === stage ? ' active' : ''}`}
              style={filterStatus === stage ? { background: STAGE_COLORS[stage], borderColor: STAGE_COLORS[stage] } : {}}
              onClick={() => setFilterStatus(filterStatus === stage ? 'all' : stage)}
            >
              <span className="pt-pill-dot" style={{ background: STAGE_COLORS[stage] }} />
              {STAGE_LABELS[stage]}
              <span className="pt-pill-count">{stageCounts[stage] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <table className="pt-table">
          <thead>
            <tr>
              <th className="pt-th">Sample</th>
              <th className="pt-th">Status</th>
              <th className="pt-th">Progress</th>
              <th className="pt-th">Date</th>
              <th className="pt-th">Worker</th>
              <th className="pt-th" style={{ textAlign: 'right' }}>ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const status = getStatus(m);
              const stageIdx = PIPELINE_STAGES.indexOf(status);
              // Role-based permissions
              const FIELD_STAGES: PipelineStatus[] = ['pending_sample', 'sampled'];
              const LAB_STAGES: PipelineStatus[] = ['in_transit', 'in_lab'];
              const canAdvanceBase = stageIdx >= 0 && stageIdx < PIPELINE_STAGES.length - 1;
              const canEdit =
                currentUser.role === 'field_worker' ? FIELD_STAGES.includes(status) :
                currentUser.role === 'lab_worker' ? LAB_STAGES.includes(status) :
                true;
              const canAdvance = canAdvanceBase && canEdit;
              const badgeColor = STAGE_COLORS[status] ?? '#9ca3af';
              const hasResults = m.results !== null && Object.keys(m.results).length > 0;
              const isExpanded = expandedId === m.id;

              // Chain of custody steps with active/inactive state
              const custodySteps = [
                { step: 'Planned', who: m.plannedBy, when: m.plannedDate, color: '#9ca3af', active: true },
                { step: 'Assigned', who: m.assignedTo, when: m.plannedDate, color: '#378ADD', active: stageIdx >= 0 },
                { step: 'Collected', who: m.collectedBy, when: m.collectedOn, color: '#378ADD', active: stageIdx >= 1 },
                { step: 'Lab assigned', who: m.labWorker, when: m.labAssignedAt, color: '#D85A30', active: stageIdx >= 2 },
                { step: 'Analyzed', who: m.labWorker, when: stageIdx >= 4 ? m.labAssignedAt : '\u2014', color: '#639922', active: stageIdx >= 4 },
                { step: 'Validated', who: m.validatedBy, when: m.validatedAt, color: '#1D9E75', active: stageIdx >= 5 },
              ];

              return (
                <Fragment key={m.id}>
                  <tr
                    className={`pt-row${isExpanded ? ' expanded' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  >
                    <td>
                      <div className="pt-row-label">{m.label}</div>
                      <div className="pt-row-loc">{m.locationName}</div>
                    </td>
                    <td>
                      <span className="pt-badge-sm" style={{ background: badgeColor + '18', color: badgeColor }}>
                        {STAGE_LABELS[status]}
                      </span>
                    </td>
                    <td>
                      <div className="pt-dots">
                        {PIPELINE_STAGES.map((stage, i) => (
                          <span
                            key={stage}
                            className={`pt-dot ${i < stageIdx ? 'pt-dot-done' : i === stageIdx ? 'pt-dot-active' : 'pt-dot-future'}`}
                            style={{
                              background: i < stageIdx ? '#639922' : i === stageIdx ? STAGE_COLORS[status] : undefined,
                            }}
                            title={STAGE_LABELS[stage]}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="pt-row-meta">{m.plannedDate}</td>
                    <td className="pt-row-meta">{m.assignedTo}</td>
                    <td className="pt-row-mid">{m.measurementId}</td>
                  </tr>

                  {isExpanded && (
                    <tr className="pt-expand">
                      <td colSpan={6}>
                        <div className="pt-expand-inner">
                          {/* Mini stepper */}
                          <div className="pt-expand-stepper">
                            {PIPELINE_STAGES.map((stage, i) => {
                              const isDone = i < stageIdx;
                              const isActive = i === stageIdx;
                              return (
                                <div key={stage} className="pt-mini-step">
                                  <div className={`pt-mini-circle ${isDone ? 'pt-mini-circle-done' : isActive ? 'pt-mini-circle-active' : 'pt-mini-circle-future'}`}>
                                    {isDone ? (
                                      <svg className="pt-check" viewBox="0 0 12 12" fill="none">
                                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    ) : i + 1}
                                  </div>
                                  {i < PIPELINE_STAGES.length - 1 && (
                                    <div className={`pt-mini-connector ${i < stageIdx ? 'pt-mini-connector-done' : 'pt-mini-connector-future'}`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Chain of custody */}
                          {(() => {
                            const isCustodyOpen = custodyOpenId === m.id;
                            // Unique people involved (for avatar summary)
                            const activePeople = custodySteps.filter(s => s.active && s.who !== '\u2014');
                            const uniqueNames = [...new Set(activePeople.map(s => s.who))];
                            const completedCount = custodySteps.filter(s => s.active).length;
                            const custodyColors: Record<string, string> = {
                              '#9ca3af': '#9ca3af', '#378ADD': '#378ADD', '#D85A30': '#D85A30',
                              '#639922': '#639922', '#1D9E75': '#1D9E75',
                            };

                            return (
                              <div className="pt-custody">
                                <div className="pt-custody-toggle" onClick={(e) => { e.stopPropagation(); setCustodyOpenId(isCustodyOpen ? null : m.id); }}>
                                  <svg viewBox="0 0 10 10" fill="none" className={isCustodyOpen ? 'open' : ''}>
                                    <path d="M3.5 1.5L7 5L3.5 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  Chain of custody ({completedCount}/{custodySteps.length})
                                  <div className="pt-custody-summary">
                                    {uniqueNames.slice(0, 4).map((name, i) => {
                                      const initials = name.split(' ').map(n => n[0]).join('');
                                      const step = activePeople.find(s => s.who === name);
                                      return (
                                        <div key={name} className="pt-custody-avatar" style={{ background: step?.color ?? '#9ca3af' }} title={name}>
                                          {initials}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {isCustodyOpen && (
                                  <div className="pt-custody-timeline">
                                    <div className="pt-custody-line" />
                                    {custodySteps.map((s, i) => {
                                      const isCurrentStep = s.active && (i === custodySteps.length - 1 || !custodySteps[i + 1].active);
                                      return (
                                        <div key={s.step} className={`pt-custody-item${!s.active ? ' inactive' : ''}`}>
                                          <div
                                            className={`pt-custody-dot${isCurrentStep ? ' pt-custody-dot-ring' : ''}`}
                                            style={{ background: s.active ? s.color : '#d1d5db' }}
                                          />
                                          <span className="pt-custody-step">{s.step}</span>
                                          <span className="pt-custody-who">{s.who}</span>
                                          <span className="pt-custody-when">{s.active ? s.when : ''}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Extra metadata */}
                          <div className="pt-expand-meta">
                            <div className="pt-expand-meta-item">
                              <span className="pt-expand-meta-label">Plan</span>
                              <span className="pt-expand-meta-val">{m.planName}</span>
                            </div>
                            <div className="pt-expand-meta-item">
                              <span className="pt-expand-meta-label">Location</span>
                              <span className="pt-expand-meta-val">{m.locationName}</span>
                            </div>
                            <div className="pt-expand-meta-item">
                              <span className="pt-expand-meta-label">Cost</span>
                              <span className="pt-expand-meta-val">{m.cost}</span>
                            </div>
                          </div>

                          {/* Results */}
                          {hasResults && (
                            <div className="pt-expand-results">
                              <div className="pt-expand-results-title">Results</div>
                              <div className="pt-results-grid">
                                {m.parameters.map(param => {
                                  const value = m.results![param.key];
                                  if (value === undefined) return null;
                                  let valueClass = '';
                                  if (param.min !== undefined && param.max !== undefined) {
                                    const range = param.max - param.min;
                                    const low = param.min + range * 0.15;
                                    const high = param.max - range * 0.15;
                                    if (value < low || value > high) valueClass = ' warn';
                                    if (value <= param.min || value >= param.max) valueClass = ' danger';
                                  }
                                  return (
                                    <div key={param.key} className="pt-result-chip">
                                      <span className="pt-result-param">{param.label}</span>
                                      <span className={`pt-result-value${valueClass}`}>
                                        {typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value}
                                      </span>
                                      {param.unit && <span className="pt-result-unit">{param.unit}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {m.notes && <div className="pt-expand-note">{m.notes}</div>}

                          <div className="pt-expand-actions">
                            <button
                              className="pt-btn pt-btn-primary"
                              disabled={!canAdvance}
                              title={!canAdvance && canAdvanceBase ? `Your role (${currentUser.role.replace('_', ' ')}) cannot advance this stage` : undefined}
                              onClick={(e) => { e.stopPropagation(); canAdvance && advanceStage(m.id); }}
                            >
                              {canAdvance ? `Advance to ${STAGE_LABELS[PIPELINE_STAGES[stageIdx + 1]]}` : canAdvanceBase ? 'Not your stage' : 'Advance'}
                            </button>
                            <button className="pt-btn pt-btn-ghost" disabled={!canEdit}>Add note</button>
                            <button className="pt-btn pt-btn-danger" disabled={!canEdit}>Flag</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="pt-empty">No measurements match the selected filter.</div>
        )}
      </div>
    </>
  );
}
