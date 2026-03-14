import { useState } from 'react';
import type { Entry, EmergencyEvent, Rating } from './planData';
import { WORKERS, WATERWAYS, MEASUREMENTS, workerName } from './planData';

interface EmergencyPanelProps {
  entries: Entry[];
  emergencyEvents: EmergencyEvent[];
  selectedDate: string;
  onClose: () => void;
  onDeploy: (newEntries: Entry[], event: EmergencyEvent) => void;
  onUpdateEventStatus: (eventId: string, status: EmergencyEvent['status']) => void;
}

const SEVERITY_COLORS: Record<EmergencyEvent['severity'], string> = {
  critical: '#E24B4A',
  high: '#D85A30',
  medium: '#D4A017',
};

const EVENT_STATUS_COLORS: Record<EmergencyEvent['status'], string> = {
  active: '#E24B4A',
  monitoring: '#BA7517',
  resolved: '#639922',
};

let _eid = Date.now();
function uid() { return `em-${_eid++}`; }

export default function EmergencyPanel({
  emergencyEvents,
  selectedDate,
  onClose,
  onDeploy,
  onUpdateEventStatus,
}: EmergencyPanelProps) {
  const [severity, setSeverity] = useState<EmergencyEvent['severity']>('high');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedWaterways, setSelectedWaterways] = useState<Set<string>>(new Set());
  const [selectedMeasurements, setSelectedMeasurements] = useState<Set<string>>(new Set());
  const [assigneeId, setAssigneeId] = useState(WORKERS[0].id);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  const activeEvents = emergencyEvents.filter(e => e.status !== 'resolved');
  const resolvedEvents = emergencyEvents.filter(e => e.status === 'resolved');

  function toggleWaterway(w: string) {
    setSelectedWaterways(prev => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w); else next.add(w);
      return next;
    });
  }

  function toggleMeasurement(m: string) {
    setSelectedMeasurements(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  }

  function toggleHistory(id: string) {
    setExpandedHistory(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleDeploy() {
    if (!title.trim() || selectedWaterways.size === 0 || selectedMeasurements.size === 0) return;

    const newEntries: Entry[] = [];
    const entryIds: string[] = [];
    const locationNames: string[] = [];

    for (const waterway of selectedWaterways) {
      for (const measName of selectedMeasurements) {
        const meas = MEASUREMENTS.find(m => m.name === measName)!;
        const id = uid();
        entryIds.push(id);
        const locName = `${waterway} \u2014 Emergency Station`;
        if (!locationNames.includes(locName)) locationNames.push(locName);

        newEntries.push({
          id,
          locationId: uid(),
          locationName: locName,
          locationCode: `EMG-${waterway.slice(0, 3).toUpperCase()}-${String(entryIds.length).padStart(3, '0')}`,
          rating: 'very_poor' as Rating,
          river: waterway,
          program: 'river',
          waterBody: 'river',
          measurement: measName,
          frequency: 'quarterly',
          assigneeId,
          status: 'planned',
          nextDate: selectedDate,
          cost: meas.cost,
        });
      }
    }

    const event: EmergencyEvent = {
      id: uid(),
      title: title.trim(),
      description: description.trim(),
      severity,
      status: 'active',
      createdAt: new Date().toISOString(),
      affectedWaterways: [...selectedWaterways],
      affectedLocations: locationNames,
      deployedEntries: entryIds,
    };

    onDeploy(newEntries, event);

    setTitle('');
    setDescription('');
    setSelectedWaterways(new Set());
    setSelectedMeasurements(new Set());
    setSeverity('high');
  }

  const deploySummary =
    selectedWaterways.size > 0 && selectedMeasurements.size > 0
      ? `Deploy ${selectedMeasurements.size} measurement${selectedMeasurements.size > 1 ? 's' : ''} across ${selectedWaterways.size} location${selectedWaterways.size > 1 ? 's' : ''} to ${workerName(assigneeId)}`
      : null;

  const canDeploy = title.trim().length > 0 && selectedWaterways.size > 0 && selectedMeasurements.size > 0;

  function formatEventTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <>
      <style>{`
        .ep-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .ep-panel {
          background: #fff;
          border-radius: 8px;
          max-width: 720px;
          width: 95%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          border: 0.5px solid var(--border, #e2e4e8);
        }
        .ep-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px 10px;
          border-bottom: 0.5px solid var(--border, #e2e4e8);
        }
        .ep-header-left h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #111;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .ep-header-left h2 .ep-warn {
          color: #E24B4A;
          font-size: 15px;
        }
        .ep-header-left p {
          margin: 3px 0 0;
          font-size: 11px;
          color: #6b7280;
        }
        .ep-close {
          background: none;
          border: 0.5px solid var(--border, #e2e4e8);
          border-radius: 4px;
          width: 26px;
          height: 26px;
          font-size: 15px;
          cursor: pointer;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .ep-close:hover { background: #f3f4f6; color: #111; }
        .ep-section {
          padding: 14px 18px;
          border-bottom: 0.5px solid var(--border, #e2e4e8);
        }
        .ep-section:last-child { border-bottom: none; }
        .ep-section-title {
          font-size: 11.5px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin: 0 0 10px;
        }
        .ep-event-card {
          border: 0.5px solid var(--border, #e2e4e8);
          border-radius: 6px;
          padding: 10px 12px;
          margin-bottom: 8px;
          background: #fafafa;
        }
        .ep-event-top {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 5px;
        }
        .ep-sev-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 7px;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: #fff;
        }
        .ep-event-title {
          font-size: 12.5px;
          font-weight: 600;
          color: #111;
          flex: 1;
        }
        .ep-event-time {
          font-size: 10px;
          color: #9ca3af;
        }
        .ep-event-desc {
          font-size: 11px;
          color: #6b7280;
          margin: 2px 0 6px;
          line-height: 1.4;
        }
        .ep-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 8px;
        }
        .ep-tag {
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 3px;
          background: #eff6ff;
          color: #1d4ed8;
          border: 0.5px solid #bfdbfe;
        }
        .ep-event-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .ep-status-btns {
          display: flex;
          gap: 4px;
        }
        .ep-status-btn {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 3px;
          border: 0.5px solid var(--border, #e2e4e8);
          background: #fff;
          cursor: pointer;
          color: #6b7280;
          font-weight: 500;
        }
        .ep-status-btn:hover { background: #f3f4f6; }
        .ep-status-btn.active {
          color: #fff;
          border-color: transparent;
        }
        .ep-deployed-count {
          font-size: 10px;
          color: #9ca3af;
        }
        .ep-sev-radios {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
        }
        .ep-sev-radio {
          flex: 1;
          padding: 6px 0;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          border-radius: 5px;
          cursor: pointer;
          border: 1.5px solid var(--border, #e2e4e8);
          background: #fff;
          transition: border-color 0.15s, background 0.15s;
        }
        .ep-sev-radio:hover { background: #f9fafb; }
        .ep-sev-radio.selected { color: #fff; }
        .ep-input, .ep-textarea, .ep-select {
          display: block;
          width: 100%;
          box-sizing: border-box;
          font-size: 12px;
          padding: 6px 9px;
          border: 0.5px solid var(--border, #e2e4e8);
          border-radius: 4px;
          background: #fff;
          margin-bottom: 10px;
          font-family: inherit;
          color: #111;
        }
        .ep-input:focus, .ep-textarea:focus, .ep-select:focus {
          outline: none;
          border-color: #378ADD;
          box-shadow: 0 0 0 2px rgba(55,138,221,0.12);
        }
        .ep-textarea { resize: vertical; min-height: 52px; }
        .ep-label {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 4px;
          display: block;
        }
        .ep-ww-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px 8px;
          max-height: 160px;
          overflow-y: auto;
          border: 0.5px solid var(--border, #e2e4e8);
          border-radius: 4px;
          padding: 6px 8px;
          margin-bottom: 10px;
          background: #fafafa;
        }
        .ep-ww-grid label {
          font-size: 11px;
          color: #374151;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 1.5px 0;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ep-ww-grid input[type="checkbox"],
        .ep-meas-grid input[type="checkbox"] {
          accent-color: #378ADD;
          margin: 0;
        }
        .ep-meas-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 12px;
          margin-bottom: 10px;
        }
        .ep-meas-grid label {
          font-size: 11px;
          color: #374151;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .ep-deploy-btn {
          width: 100%;
          padding: 8px 0;
          border: none;
          border-radius: 5px;
          background: #E24B4A;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ep-deploy-btn:hover:not(:disabled) { background: #c93b3a; }
        .ep-deploy-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ep-deploy-summary {
          font-size: 10.5px;
          color: #6b7280;
          text-align: center;
          margin-bottom: 8px;
        }
        .ep-hist-item {
          border: 0.5px solid var(--border, #e2e4e8);
          border-radius: 5px;
          margin-bottom: 6px;
          overflow: hidden;
        }
        .ep-hist-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          cursor: pointer;
          background: #f9fafb;
          font-size: 11.5px;
          color: #374151;
        }
        .ep-hist-header:hover { background: #f3f4f6; }
        .ep-hist-chevron {
          font-size: 10px;
          color: #9ca3af;
          transition: transform 0.15s;
        }
        .ep-hist-chevron.open { transform: rotate(90deg); }
        .ep-hist-title { font-weight: 600; flex: 1; }
        .ep-hist-body {
          padding: 8px 10px;
          font-size: 11px;
          color: #6b7280;
          border-top: 0.5px solid var(--border, #e2e4e8);
          line-height: 1.5;
        }
        .ep-empty {
          font-size: 11px;
          color: #9ca3af;
          text-align: center;
          padding: 12px 0;
        }
      `}</style>

      <div className="ep-overlay" onClick={onClose}>
        <div className="ep-panel" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="ep-header">
            <div className="ep-header-left">
              <h2><span className="ep-warn">&#9888;</span> Emergency Operations</h2>
              <p>Deploy urgent monitoring in response to environmental incidents</p>
            </div>
            <button className="ep-close" onClick={onClose}>&times;</button>
          </div>

          {/* Active Emergencies */}
          {activeEvents.length > 0 && (
            <div className="ep-section">
              <div className="ep-section-title">Active Emergencies ({activeEvents.length})</div>
              {activeEvents.map(ev => (
                <div className="ep-event-card" key={ev.id} style={{ borderLeftColor: SEVERITY_COLORS[ev.severity], borderLeftWidth: 3 }}>
                  <div className="ep-event-top">
                    <span className="ep-sev-badge" style={{ background: SEVERITY_COLORS[ev.severity] }}>
                      {ev.severity}
                    </span>
                    <span className="ep-event-title">{ev.title}</span>
                    <span className="ep-event-time">{formatEventTime(ev.createdAt)}</span>
                  </div>
                  {ev.description && <div className="ep-event-desc">{ev.description}</div>}
                  <div className="ep-tags">
                    {ev.affectedWaterways.map(w => (
                      <span className="ep-tag" key={w}>{w}</span>
                    ))}
                  </div>
                  <div className="ep-event-footer">
                    <div className="ep-status-btns">
                      {(['active', 'monitoring', 'resolved'] as const).map(st => (
                        <button
                          key={st}
                          className={`ep-status-btn ${ev.status === st ? 'active' : ''}`}
                          style={ev.status === st ? { background: EVENT_STATUS_COLORS[st] } : undefined}
                          onClick={() => onUpdateEventStatus(ev.id, st)}
                        >
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </button>
                      ))}
                    </div>
                    <span className="ep-deployed-count">
                      {ev.deployedEntries.length} entr{ev.deployedEntries.length === 1 ? 'y' : 'ies'} deployed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Emergency Form */}
          <div className="ep-section">
            <div className="ep-section-title">New Emergency</div>

            <span className="ep-label">Severity</span>
            <div className="ep-sev-radios">
              {(['critical', 'high', 'medium'] as const).map(s => (
                <button
                  key={s}
                  className={`ep-sev-radio ${severity === s ? 'selected' : ''}`}
                  style={
                    severity === s
                      ? { borderColor: SEVERITY_COLORS[s], background: SEVERITY_COLORS[s] }
                      : { borderColor: SEVERITY_COLORS[s], color: SEVERITY_COLORS[s] }
                  }
                  onClick={() => setSeverity(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            <span className="ep-label">Title</span>
            <input
              className="ep-input"
              placeholder="e.g. Chemical spill on Sava near Litija"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />

            <span className="ep-label">Description</span>
            <textarea
              className="ep-textarea"
              placeholder="Describe the incident and required response..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />

            <span className="ep-label">Affected Waterways</span>
            <div className="ep-ww-grid">
              {WATERWAYS.map(w => (
                <label key={w}>
                  <input
                    type="checkbox"
                    checked={selectedWaterways.has(w)}
                    onChange={() => toggleWaterway(w)}
                  />
                  {w}
                </label>
              ))}
            </div>

            <span className="ep-label">Measurements to Deploy</span>
            <div className="ep-meas-grid">
              {MEASUREMENTS.map(m => (
                <label key={m.name}>
                  <input
                    type="checkbox"
                    checked={selectedMeasurements.has(m.name)}
                    onChange={() => toggleMeasurement(m.name)}
                  />
                  {m.name}
                </label>
              ))}
            </div>

            <span className="ep-label">Assign to</span>
            <select
              className="ep-select"
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
            >
              {WORKERS.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}{w.region ? ` (${w.region})` : ''}
                </option>
              ))}
            </select>

            {deploySummary && (
              <div className="ep-deploy-summary">{deploySummary}</div>
            )}
            <button
              className="ep-deploy-btn"
              disabled={!canDeploy}
              onClick={handleDeploy}
            >
              &#9889; Quick Deploy
            </button>
          </div>

          {/* Emergency History */}
          <div className="ep-section">
            <div className="ep-section-title">Emergency History</div>
            {resolvedEvents.length === 0 ? (
              <div className="ep-empty">No resolved emergencies yet</div>
            ) : (
              resolvedEvents.map(ev => (
                <div className="ep-hist-item" key={ev.id}>
                  <div className="ep-hist-header" onClick={() => toggleHistory(ev.id)}>
                    <span className={`ep-hist-chevron ${expandedHistory.has(ev.id) ? 'open' : ''}`}>&#9654;</span>
                    <span className="ep-sev-badge" style={{ background: SEVERITY_COLORS[ev.severity] }}>
                      {ev.severity}
                    </span>
                    <span className="ep-hist-title">{ev.title}</span>
                    <span className="ep-event-time">{formatEventTime(ev.createdAt)}</span>
                  </div>
                  {expandedHistory.has(ev.id) && (
                    <div className="ep-hist-body">
                      {ev.description && <p style={{ margin: '0 0 6px' }}>{ev.description}</p>}
                      <div className="ep-tags" style={{ marginBottom: 4 }}>
                        {ev.affectedWaterways.map(w => (
                          <span className="ep-tag" key={w}>{w}</span>
                        ))}
                      </div>
                      <div>
                        {ev.deployedEntries.length} entr{ev.deployedEntries.length === 1 ? 'y' : 'ies'} deployed
                        &middot; Resolved
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
