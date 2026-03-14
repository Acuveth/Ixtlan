import { useState, useMemo } from 'react';
import type { Entry, ViewMode } from './planData';
import {
  WORKERS, RATING_COLORS, STATUS_COLORS,
  formatDate, dateStr, addDays, getWeekStart,
} from './planData';

interface PlanCalendarProps {
  viewMode: ViewMode;
  selectedDate: string;
  entriesByDate: Map<string, Entry[]>;
  entries: Entry[];
  onNavigateToDay: (date: string) => void;
  onNavigateToMonth: (year: number, month: number) => void;
  onReassign: (entryId: string, workerId: string) => void;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthGrid(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon
  const totalDays = lastDay.getDate();
  const rows: (string | null)[][] = [];
  let day = 1 - startDow;
  for (let r = 0; r < 6; r++) {
    const row: (string | null)[] = [];
    for (let c = 0; c < 7; c++, day++) {
      if (day >= 1 && day <= totalDays) {
        row.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      } else {
        row.push(null);
      }
    }
    rows.push(row);
  }
  return rows;
}

function densityColor(count: number): string {
  if (count === 0) return '#e5e7eb';
  if (count <= 2) return '#bfdbfe';
  if (count <= 5) return '#3b82f6';
  return '#1e40af';
}

// ---------------------------------------------------------------------------
// Side Panel
// ---------------------------------------------------------------------------

function SidePanel({ date, entries, onReassign, onClose }: {
  date: string;
  entries: Entry[];
  onReassign: (entryId: string, workerId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="pcal-side">
      <div className="pcal-side-hdr">
        <span className="pcal-side-title">{formatDate(date)}</span>
        <button className="pcal-side-close" onClick={onClose}>&times;</button>
      </div>
      <div className="pcal-side-count">{entries.length} entries</div>
      <div className="pcal-side-list">
        {entries.map(e => (
          <div key={e.id} className="pcal-side-card">
            <div className="pcal-side-loc">{e.locationName}</div>
            <div className="pcal-side-meas">{e.measurement}</div>
            <div className="pcal-side-row">
              <select
                className="pcal-side-assign"
                value={e.assigneeId}
                onClick={ev => ev.stopPropagation()}
                onChange={ev => onReassign(e.id, ev.target.value)}
              >
                <option value="">Unassigned</option>
                {WORKERS.filter(w => w.id).map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <span className="pcal-side-dot" style={{ background: STATUS_COLORS[e.status] }} />
              <span className="pcal-side-status">{e.status.replace('_', ' ')}</span>
            </div>
            <div className="pcal-side-cost">&euro;{e.cost}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day View
// ---------------------------------------------------------------------------

function DayView({ date, entriesByDate, onReassign }: {
  date: string;
  entriesByDate: Map<string, Entry[]>;
  onReassign: (id: string, wid: string) => void;
}) {
  const dayEntries = entriesByDate.get(date) || [];
  const totalCost = dayEntries.reduce((s, e) => s + e.cost, 0);
  const hours = Array.from({ length: 15 }, (_, i) => 6 + i); // 06:00-20:00

  // Distribute entries across morning slots (08-12) based on index
  const slotMap = useMemo(() => {
    const map = new Map<number, Entry[]>();
    dayEntries.forEach((entry, idx) => {
      const hour = 8 + (idx % 5); // 08, 09, 10, 11, 12
      const existing = map.get(hour);
      if (existing) existing.push(entry);
      else map.set(hour, [entry]);
    });
    return map;
  }, [dayEntries]);

  return (
    <div className="pcal-day">
      <div className="pcal-day-summary">
        <span className="pcal-day-sum-item"><strong>{dayEntries.length}</strong> entries</span>
        <span className="pcal-day-sum-item"><strong>&euro;{totalCost.toLocaleString()}</strong> total cost</span>
      </div>
      <div className="pcal-day-timeline">
        {hours.map(h => {
          const label = `${String(h).padStart(2, '0')}:00`;
          const entries = slotMap.get(h) || [];
          return (
            <div key={h} className={`pcal-day-slot${entries.length === 0 ? ' pcal-day-slot-empty' : ''}`}>
              <div className="pcal-day-hour">{label}</div>
              <div className="pcal-day-cards">
                {entries.map(entry => (
                  <div key={entry.id} className="pcal-day-card" style={{ borderLeftColor: RATING_COLORS[entry.rating] }}>
                    <div className="pcal-day-card-loc">{entry.locationName}</div>
                    <div className="pcal-day-card-meas">{entry.measurement}</div>
                    <div className="pcal-day-card-meta">
                      <select
                        className="pcal-day-card-assign"
                        value={entry.assigneeId}
                        onClick={e => e.stopPropagation()}
                        onChange={e => onReassign(entry.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {WORKERS.filter(w => w.id).map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                      <span className="pcal-day-card-dot" style={{ background: STATUS_COLORS[entry.status] }} />
                      <span className="pcal-day-card-cost">&euro;{entry.cost}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week View
// ---------------------------------------------------------------------------

function WeekView({ date, entriesByDate, onNavigateToDay, onSelectDay }: {
  date: string;
  entriesByDate: Map<string, Entry[]>;
  onNavigateToDay: (d: string) => void;
  onSelectDay: (d: string) => void;
}) {
  const weekStart = getWeekStart(date);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = dateStr(new Date());

  return (
    <div className="pcal-week">
      <div className="pcal-week-grid">
        {weekDates.map((d, i) => {
          const de = entriesByDate.get(d) || [];
          const isToday = d === today;
          const dayNum = new Date(d + 'T00:00:00').getDate();
          return (
            <div
              key={d}
              className={`pcal-week-col${isToday ? ' pcal-week-today' : ''}`}
              onClick={() => { onSelectDay(d); onNavigateToDay(d); }}
            >
              <div className="pcal-week-hdr">
                <span className="pcal-week-dayname">{DAY_NAMES[i]}</span>
                <span className="pcal-week-daynum">{dayNum}</span>
              </div>
              {de.length > 0 && <span className="pcal-week-badge">{de.length}</span>}
              <div className="pcal-week-entries">
                {de.slice(0, 5).map(e => (
                  <div key={e.id} className="pcal-week-mini">
                    <span className="pcal-week-dot" style={{ background: STATUS_COLORS[e.status] }} />
                    <span className="pcal-week-loc">{e.locationName}</span>
                  </div>
                ))}
                {de.length > 5 && <span className="pcal-week-more">+{de.length - 5} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month View
// ---------------------------------------------------------------------------

function MonthView({ date, entriesByDate, onNavigateToDay, onSelectDay }: {
  date: string;
  entriesByDate: Map<string, Entry[]>;
  onNavigateToDay: (d: string) => void;
  onSelectDay: (d: string) => void;
}) {
  const dt = new Date(date + 'T00:00:00');
  const year = dt.getFullYear();
  const month = dt.getMonth();
  const grid = getMonthGrid(year, month);
  const today = dateStr(new Date());

  return (
    <div className="pcal-month">
      <div className="pcal-month-grid">
        {DAY_NAMES.map(d => <div key={d} className="pcal-month-hdr">{d}</div>)}
        {grid.flat().map((cellDate, i) => {
          const de = cellDate ? (entriesByDate.get(cellDate) || []) : [];
          const dayNum = cellDate ? new Date(cellDate + 'T00:00:00').getDate() : null;
          const isToday = cellDate === today;
          const dimmed = !cellDate;
          return (
            <div
              key={i}
              className={`pcal-month-cell${dimmed ? ' pcal-month-dimmed' : ''}${isToday ? ' pcal-month-today' : ''}`}
              onClick={() => {
                if (cellDate) { onSelectDay(cellDate); onNavigateToDay(cellDate); }
              }}
            >
              {cellDate && (
                <>
                  <span className="pcal-month-num">{dayNum}</span>
                  <div className="pcal-month-pills">
                    {de.slice(0, 3).map(e => (
                      <div
                        key={e.id}
                        className="pcal-month-pill"
                        style={{ background: STATUS_COLORS[e.status] }}
                      >
                        {e.locationName.length > 14 ? e.locationName.slice(0, 14) + '\u2026' : e.locationName}
                      </div>
                    ))}
                    {de.length > 3 && <span className="pcal-month-more">+{de.length - 3} more</span>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Year View
// ---------------------------------------------------------------------------

function YearView({ date, entriesByDate, onNavigateToMonth }: {
  date: string;
  entriesByDate: Map<string, Entry[]>;
  onNavigateToMonth: (y: number, m: number) => void;
}) {
  const year = new Date(date + 'T00:00:00').getFullYear();

  const monthBlocks = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
      let total = 0, cost = 0, completed = 0;
      const dayCounts: number[] = Array(31).fill(0);
      for (const [d, de] of entriesByDate) {
        if (d.startsWith(prefix)) {
          total += de.length;
          const dayIdx = parseInt(d.slice(8), 10) - 1;
          dayCounts[dayIdx] = de.length;
          for (const e of de) {
            cost += e.cost;
            if (e.status === 'completed') completed++;
          }
        }
      }
      return { month: m, total, cost, completed, dayCounts };
    });
  }, [entriesByDate, year]);

  return (
    <div className="pcal-year">
      <div className="pcal-year-grid">
        {monthBlocks.map(mb => {
          const completionPct = mb.total > 0 ? Math.round((mb.completed / mb.total) * 100) : 0;
          return (
            <div key={mb.month} className="pcal-year-block" onClick={() => onNavigateToMonth(year, mb.month)}>
              <div className="pcal-year-block-hdr">{MONTH_NAMES[mb.month]}</div>
              <div className="pcal-year-block-stats">
                <span>{mb.total} entries</span>
                <span>&euro;{mb.cost.toLocaleString()}</span>
              </div>
              <div className="pcal-year-density">
                {mb.dayCounts.map((count, d) => (
                  <span
                    key={d}
                    className="pcal-year-sq"
                    style={{ background: densityColor(count) }}
                    title={`Day ${d + 1}: ${count} entries`}
                  />
                ))}
              </div>
              <div className="pcal-year-completion">
                <div className="pcal-year-comp-bar">
                  <div className="pcal-year-comp-fill" style={{ width: `${completionPct}%` }} />
                </div>
                <span className="pcal-year-comp-lbl">{mb.completed}/{mb.total} completed</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PlanCalendar({
  viewMode,
  selectedDate,
  entriesByDate,
  onNavigateToDay,
  onNavigateToMonth,
  onReassign,
}: PlanCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const sidePanelEntries = selectedDay ? (entriesByDate.get(selectedDay) || []) : [];

  const handleSelectDay = (d: string) => setSelectedDay(d);
  const handleClosePanel = () => setSelectedDay(null);

  return (
    <>
      <style>{CAL_CSS}</style>
      <div className="pcal-root">
        <div className="pcal-main">
          {viewMode === 'day' && (
            <DayView date={selectedDate} entriesByDate={entriesByDate} onReassign={onReassign} />
          )}
          {viewMode === 'week' && (
            <WeekView date={selectedDate} entriesByDate={entriesByDate} onNavigateToDay={onNavigateToDay} onSelectDay={handleSelectDay} />
          )}
          {viewMode === 'month' && (
            <MonthView date={selectedDate} entriesByDate={entriesByDate} onNavigateToDay={onNavigateToDay} onSelectDay={handleSelectDay} />
          )}
          {viewMode === 'year' && (
            <YearView date={selectedDate} entriesByDate={entriesByDate} onNavigateToMonth={onNavigateToMonth} />
          )}
        </div>
        {selectedDay && sidePanelEntries.length > 0 && (
          <SidePanel date={selectedDay} entries={sidePanelEntries} onReassign={onReassign} onClose={handleClosePanel} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CAL_CSS = `
/* Root layout */
.pcal-root{display:flex;flex:1;overflow:hidden;height:100%}
.pcal-main{flex:1;overflow-y:auto;overflow-x:hidden}

/* Side Panel */
.pcal-side{width:220px;flex-shrink:0;border-left:1px solid var(--color-border-tertiary);overflow-y:auto;background:var(--color-background-primary)}
.pcal-side-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--color-border-tertiary)}
.pcal-side-title{font-size:13px;font-weight:600;color:var(--color-text-primary)}
.pcal-side-close{background:none;border:none;font-size:18px;cursor:pointer;color:var(--color-text-secondary);padding:0 2px;line-height:1}
.pcal-side-close:hover{color:var(--color-text-primary)}
.pcal-side-count{padding:6px 12px;font-size:11px;color:var(--color-text-secondary);border-bottom:1px solid var(--color-border-tertiary)}
.pcal-side-list{padding:8px}
.pcal-side-card{padding:8px;border:1px solid var(--color-border-tertiary);border-radius:6px;margin-bottom:6px;font-size:11px}
.pcal-side-loc{font-weight:600;color:var(--color-text-primary);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pcal-side-meas{color:var(--color-text-secondary);margin-bottom:4px}
.pcal-side-row{display:flex;align-items:center;gap:6px;margin-bottom:2px}
.pcal-side-assign{padding:2px 4px;border:1px solid var(--color-border-tertiary);border-radius:3px;font-size:10px;font-family:inherit;background:transparent;color:var(--color-text-secondary);cursor:pointer;outline:none;max-width:110px}
.pcal-side-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.pcal-side-status{color:var(--color-text-secondary);text-transform:capitalize;font-size:10px}
.pcal-side-cost{font-weight:500;color:var(--color-text-primary)}

/* Day View */
.pcal-day{padding:0 0 16px}
.pcal-day-summary{display:flex;gap:20px;padding:12px 16px;border-bottom:1px solid var(--color-border-tertiary);font-size:13px;color:var(--color-text-secondary)}
.pcal-day-summary strong{color:var(--color-text-primary)}
.pcal-day-sum-item{display:inline-flex;gap:4px}
.pcal-day-timeline{padding:8px 0}
.pcal-day-slot{display:flex;min-height:44px;border-bottom:1px solid var(--color-border-tertiary)}
.pcal-day-slot-empty{border-bottom-style:dashed;border-bottom-color:var(--color-border-tertiary);opacity:0.6}
.pcal-day-hour{width:60px;flex-shrink:0;padding:8px 12px 8px 16px;font-size:11px;color:var(--color-text-tertiary);font-variant-numeric:tabular-nums;text-align:right}
.pcal-day-cards{flex:1;display:flex;flex-wrap:wrap;gap:6px;padding:6px 12px 6px 0}
.pcal-day-card{border:1px solid var(--color-border-tertiary);border-left:3px solid;border-radius:6px;padding:6px 10px;background:var(--color-background-primary);min-width:220px;max-width:340px;transition:border-color .15s}
.pcal-day-card:hover{border-color:var(--color-border-info)}
.pcal-day-card-loc{font-size:12px;font-weight:600;color:var(--color-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:1px}
.pcal-day-card-meas{font-size:11px;color:var(--color-text-secondary);margin-bottom:4px}
.pcal-day-card-meta{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--color-text-secondary)}
.pcal-day-card-assign{padding:2px 4px;border:1px solid var(--color-border-tertiary);border-radius:3px;font-size:10px;font-family:inherit;background:transparent;color:var(--color-text-secondary);cursor:pointer;outline:none;max-width:100px}
.pcal-day-card-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.pcal-day-card-cost{margin-left:auto;font-weight:500;color:var(--color-text-primary)}

/* Week View */
.pcal-week{padding:12px 16px;overflow-y:auto}
.pcal-week-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.pcal-week-col{border:1px solid var(--color-border-tertiary);border-radius:8px;padding:0;overflow:hidden;cursor:pointer;transition:border-color .15s;display:flex;flex-direction:column}
.pcal-week-col:hover{border-color:var(--color-border-info)}
.pcal-week-today{border-color:#378ADD;box-shadow:inset 0 0 0 1px #378ADD}
.pcal-week-hdr{display:flex;flex-direction:column;align-items:center;padding:8px 6px;background:var(--color-background-secondary);border-bottom:1px solid var(--color-border-tertiary)}
.pcal-week-today .pcal-week-hdr{background:#ebf3fb}
.pcal-week-dayname{font-size:10px;color:var(--color-text-tertiary);font-weight:500}
.pcal-week-daynum{font-size:16px;font-weight:600;color:var(--color-text-primary)}
.pcal-week-badge{display:inline-block;text-align:center;font-size:10px;font-weight:600;color:#378ADD;background:#ebf3fb;padding:2px 6px;border-radius:8px;margin:6px 8px 0}
.pcal-week-entries{padding:4px 8px 8px;display:flex;flex-direction:column;gap:3px;overflow-y:auto;max-height:200px}
.pcal-week-mini{display:flex;align-items:center;gap:4px}
.pcal-week-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.pcal-week-loc{font-size:10px;color:var(--color-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pcal-week-more{font-size:9px;color:var(--color-text-tertiary);padding-left:9px}

/* Month View */
.pcal-month{padding:12px 16px;overflow-y:auto}
.pcal-month-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px}
.pcal-month-hdr{padding:6px;text-align:center;font-size:11px;font-weight:500;color:var(--color-text-tertiary)}
.pcal-month-cell{min-height:90px;padding:4px 6px;border:1px solid var(--color-border-tertiary);border-radius:4px;cursor:pointer;position:relative;transition:background .1s}
.pcal-month-cell:hover{background:var(--color-background-secondary)}
.pcal-month-dimmed{border-color:transparent;cursor:default;background:transparent}
.pcal-month-dimmed:hover{background:transparent}
.pcal-month-today{border-color:#378ADD;box-shadow:inset 0 0 0 1.5px #378ADD}
.pcal-month-num{font-size:12px;font-weight:500;color:var(--color-text-primary)}
.pcal-month-pills{display:flex;flex-direction:column;gap:2px;margin-top:3px}
.pcal-month-pill{font-size:9px;color:#fff;padding:1px 4px;border-radius:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pcal-month-more{font-size:9px;color:var(--color-text-tertiary);padding-left:2px;margin-top:1px}

/* Year View */
.pcal-year{padding:16px;overflow-y:auto}
.pcal-year-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.pcal-year-block{border:1px solid var(--color-border-tertiary);border-radius:8px;padding:10px 12px;cursor:pointer;transition:border-color .15s}
.pcal-year-block:hover{border-color:var(--color-border-info)}
.pcal-year-block-hdr{font-size:13px;font-weight:600;color:var(--color-text-primary);margin-bottom:4px}
.pcal-year-block-stats{display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-secondary);margin-bottom:8px}
.pcal-year-density{display:flex;gap:1px;flex-wrap:wrap;margin-bottom:8px}
.pcal-year-sq{width:8px;height:8px;border-radius:1px}
.pcal-year-completion{display:flex;align-items:center;gap:6px}
.pcal-year-comp-bar{flex:1;height:4px;border-radius:2px;background:var(--color-border-tertiary);overflow:hidden}
.pcal-year-comp-fill{height:100%;border-radius:2px;background:#639922}
.pcal-year-comp-lbl{font-size:10px;color:var(--color-text-secondary);white-space:nowrap}

/* Mobile */
@media(max-width:768px){
  .pcal-root{flex-direction:column}
  .pcal-side{width:100%;border-left:none;border-top:1px solid var(--color-border-tertiary);max-height:260px}
  .pcal-year-grid{grid-template-columns:repeat(3,1fr)}
  .pcal-week-grid{grid-template-columns:repeat(7,1fr)}
}
`;
