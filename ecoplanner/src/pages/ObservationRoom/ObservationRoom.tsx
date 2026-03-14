import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Circle, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import * as L from 'leaflet';
import { useDatabase } from '../../context/DatabaseContext';
import type { HistoricalMeasurement } from '../../db';

function MapReady() { const map = useMap(); useEffect(() => { map.setView([46.15, 14.99], 8.2); setTimeout(() => map.invalidateSize(), 200); }, [map]); return null; }
function FlyTo({ lat, lng }: { lat: number; lng: number }) { const map = useMap(); const prev = useRef(''); useEffect(() => { const k = `${lat},${lng}`; if (k !== prev.current) { prev.current = k; map.flyTo([lat, lng], 12, { duration: 1 }); } }, [map, lat, lng]); return null; }

type Tab = 'all' | 'planned' | 'progress' | 'done';
type Program = 'River' | 'Lake' | 'Sea' | 'Soil';
interface MeasurementRecord { date: string; type: string; ph: string; temperature: string; conductivity: string; dissolved_o2: string; result: string; worker: string; }
interface Station { id: number; name: string; lat: number; lng: number; color: string; rating: string; status: string; measurement: string; lastPh: string; trend: string; tab: Tab | 'anomaly'; timeLabel: string; anomaly?: string; assignee?: string; program: Program; region: string; locationId?: string; previousMeasurements: MeasurementRecord[]; plannedMeasurements: MeasurementRecord[]; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const RATING_DISPLAY: Record<string, string> = { very_poor: 'Very poor', poor: 'Poor', moderate: 'Moderate', good: 'Good', very_good: 'Very good' };
const PROGRAM_COLORS: Record<Program, string> = { River: '#378ADD', Lake: '#1D9E75', Sea: '#6366F1', Soil: '#92400E' };
const RATING_COLORS: Record<string, string> = { 'Very poor': '#E24B4A', 'Poor': '#D85A30', 'Moderate': '#EF9F27', 'Good': '#639922', 'Very good': '#1D9E75' };

// pH-to-rating mapping for historical data
function phToRating(ph: number): string {
  if (ph < 5.5) return 'Very poor';
  if (ph < 6.2) return 'Poor';
  if (ph < 6.8) return 'Moderate';
  if (ph < 7.8) return 'Good';
  return 'Very good';
}

function dayOfYearToDate(day: number): string {
  const d = new Date(2026, 0, 1);
  d.setDate(d.getDate() + day - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const RIVERS = [
  { name: 'Sava', color: '#D85A30', coords: [[46.4922,13.7414],[46.4836,13.7839],[46.4754,13.8401],[46.4609,13.9001],[46.4443,13.9519],[46.4324,14.0623],[46.4081,14.0943],[46.3678,14.1135],[46.3444,14.1744],[46.2973,14.2291],[46.2419,14.2966],[46.2209,14.3537],[46.1689,14.3583],[46.1192,14.3795],[46.0839,14.4345],[46.0619,14.5368],[46.0740,14.6107],[46.0586,14.8225],[46.1318,14.9969],[46.1541,15.0518],[46.1333,15.0997],[46.0078,15.3156],[45.9592,15.4917],[45.9033,15.5911],[45.8959,15.6024]] as [number,number][] },
  { name: 'Drava', color: '#639922', coords: [[46.5881,15.0192],[46.5794,15.0411],[46.5707,15.0654],[46.5614,15.0935],[46.5686,15.1283],[46.5724,15.1674],[46.5608,15.2018],[46.5490,15.2395],[46.5453,15.2857],[46.5394,15.3424],[46.5356,15.3908],[46.5372,15.4439],[46.5428,15.4962],[46.5508,15.5512],[46.5558,15.6459],[46.5225,15.6804],[46.4941,15.7234],[46.4561,15.7654],[46.4201,15.8702],[46.4087,15.9117],[46.3970,15.9503],[46.3903,15.9963],[46.4048,16.0386],[46.4114,16.1544]] as [number,number][] },
  { name: 'Savinja', color: '#E24B4A', coords: [[46.3936,14.6931],[46.3838,14.7247],[46.3699,14.7648],[46.3564,14.8098],[46.3476,14.8529],[46.3394,14.9633],[46.3314,14.9903],[46.3108,15.0235],[46.2884,15.0584],[46.2710,15.0843],[46.2515,15.1648],[46.2309,15.2604],[46.2102,15.2782],[46.1846,15.2556],[46.1546,15.2356],[46.1256,15.2213],[46.1028,15.1837],[46.0839,15.1732]] as [number,number][] },
  { name: 'Krka', color: '#639922', coords: [[45.9081,14.8503],[45.8973,14.8755],[45.8842,14.9034],[45.8704,14.9321],[45.8597,14.9578],[45.8521,14.9811],[45.9042,15.0217],[45.8922,15.0604],[45.8679,15.0891],[45.8431,15.1207],[45.8040,15.1689],[45.7968,15.2143],[45.8123,15.2567],[45.8321,15.2948],[45.8465,15.3378],[45.8561,15.3812],[45.8673,15.4254],[45.8784,15.4698],[45.8912,15.5421],[45.8959,15.5824]] as [number,number][] },
  { name: 'Soča', color: '#1D9E75', coords: [[46.4095,13.7254],[46.3930,13.7440],[46.3804,13.7526],[46.3594,13.7392],[46.3414,13.6769],[46.3380,13.5523],[46.3278,13.5307],[46.2987,13.5191],[46.2481,13.5772],[46.1934,13.6518],[46.1830,13.7332],[46.1512,13.7456],[46.1189,13.7138],[46.0912,13.6854],[46.0614,13.6531],[46.0371,13.6417],[46.0108,13.6389],[45.9781,13.6408],[45.9560,13.6484],[45.9342,13.6498]] as [number,number][] },
  { name: 'Mura', color: '#EF9F27', coords: [[46.6733,15.9922],[46.6693,16.0218],[46.6612,16.0513],[46.6625,16.0867],[46.6598,16.1203],[46.6625,16.1664],[46.6547,16.2081],[46.6478,16.2498],[46.6354,16.2879],[46.6219,16.3253],[46.6081,16.3587],[46.5937,16.3832],[46.5794,16.4063],[46.5672,16.4282],[46.5649,16.4509]] as [number,number][] },
  { name: 'Kolpa', color: '#639922', coords: [[45.5294,14.7011],[45.5187,14.7358],[45.5098,14.7716],[45.5012,14.8093],[45.4989,14.8487],[45.4913,14.8872],[45.4831,14.9268],[45.4876,14.9654],[45.5024,15.0072],[45.5198,15.0431],[45.5392,15.0799],[45.5534,15.1154],[45.5687,15.1468],[45.5826,15.1772],[45.5994,15.2061],[45.6196,15.2375],[45.6342,15.2698],[45.6472,15.3142]] as [number,number][] },
  { name: 'Ljubljanica', color: '#EF9F27', coords: [[45.9635,14.2948],[45.9672,14.3092],[45.9718,14.3256],[45.9793,14.3467],[45.9894,14.3698],[45.9989,14.3918],[46.0034,14.4127],[46.0089,14.4343],[46.0178,14.4538],[46.0289,14.4712],[46.0394,14.4889],[46.0478,14.5027],[46.0515,14.5051],[46.0559,14.5148],[46.0594,14.5287],[46.0619,14.5368]] as [number,number][] },
];
const LAKES = [
  { name: 'Lake Bled', lat: 46.3616, lng: 14.0953, color: '#1D9E75' },
  { name: 'Lake Bohinj', lat: 46.2787, lng: 13.8868, color: '#639922' },
  { name: 'Lake Cerknica', lat: 45.7584, lng: 14.3884, color: '#EF9F27' },
  { name: 'Lake Ptuj', lat: 46.3970, lng: 15.9020, color: '#378ADD' },
  { name: 'Lake Velenje', lat: 46.3760, lng: 15.0883, color: '#D85A30' },
  { name: 'Lake Šmartinsko', lat: 46.2812, lng: 15.2677, color: '#639922' },
  { name: 'Lake Jasna', lat: 46.4756, lng: 13.7835, color: '#1D9E75' },
];
const LEGEND = [{ label: 'Very poor', color: '#E24B4A' },{ label: 'Poor', color: '#D85A30' },{ label: 'Moderate', color: '#EF9F27' },{ label: 'Good', color: '#639922' },{ label: 'Very good', color: '#1D9E75' }];

const iconCache = new Map<string, L.DivIcon>();
function makeIcon(color: string, pulse: boolean, selected: boolean = false): L.DivIcon { const key = color + (pulse ? '1' : '0') + (selected ? 's' : ''); const cached = iconCache.get(key); if (cached) return cached; const size = selected ? 30 : 24; const dotSize = selected ? 18 : 14; const ring = pulse ? `<div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:obs-pulse 1.5s infinite;top:0;left:0"></div>` : ''; const selRing = selected ? `<div style="position:absolute;width:${size + 6}px;height:${size + 6}px;border-radius:50%;border:2.5px solid ${color};opacity:0.7;top:-3px;left:-3px"></div>` : ''; const icon = L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -10], html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">${selRing}${ring}<div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div></div>` }); iconCache.set(key, icon); return icon; }

function Dropdown({ label, options, selected, onToggle, colorMap }: { label: string; options: string[]; selected: Set<string>; onToggle: (val: string) => void; colorMap?: Record<string, string>; }) { const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null); useEffect(() => { const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }, []); return (<div className="obs-dd" ref={ref}><button className={`obs-dd-btn${selected.size > 0 ? ' has-sel' : ''}`} onClick={() => setOpen(!open)}><span className="obs-dd-label">{label}</span>{selected.size > 0 && <span className="obs-dd-count">{selected.size}</span>}<svg className={`obs-dd-arrow${open ? ' open' : ''}`} width="10" height="10" viewBox="0 0 10 10"><path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></button>{open && (<div className="obs-dd-menu">{options.map(o => (<label key={o} className="obs-dd-option"><input type="checkbox" checked={selected.has(o)} onChange={() => onToggle(o)} />{colorMap?.[o] && <span className="obs-dd-dot" style={{ background: colorMap[o] }} />}<span>{o}</span></label>))}</div>)}</div>); }

function DetailPanel({ station, onClose }: { station: Station; onClose: () => void }) {
  const [detailTab, setDetailTab] = useState<'previous' | 'planned'>('previous');
  const navigate = useNavigate();
  const tc = station.trend === 'Declining' ? '#E24B4A' : station.trend === 'Improving' ? '#639922' : 'var(--color-text-secondary)';
  const rc = (r: string) => r === 'Pass' ? '#639922' : r === 'Warning' ? '#EF9F27' : r === 'Fail' ? '#E24B4A' : 'var(--color-text-secondary)';
  const records = detailTab === 'previous' ? station.previousMeasurements : station.plannedMeasurements;
  return (<div className="obs-detail"><div className="obs-detail-header"><button className="obs-detail-back" onClick={onClose}><svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 12L6 8l4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>Back to list</button></div>
    <div className="obs-detail-scroll"><div className="obs-detail-name">{station.name}</div>
      <div className="obs-detail-badges"><span className="obs-detail-badge" style={{ background: PROGRAM_COLORS[station.program] + '18', color: PROGRAM_COLORS[station.program] }}>{station.program}</span><span className="obs-detail-badge" style={{ background: RATING_COLORS[station.rating] + '18', color: RATING_COLORS[station.rating] }}>{station.rating}</span>{station.anomaly && <span className="obs-detail-badge" style={{ background: '#E24B4A18', color: '#E24B4A' }}>{station.anomaly}</span>}</div>
      <div className="obs-detail-info"><div className="obs-detail-row"><span>Status</span><span>{station.status}</span></div><div className="obs-detail-row"><span>Last measurement</span><span>{station.measurement}</span></div><div className="obs-detail-row"><span>Last pH</span><span>{station.lastPh}</span></div><div className="obs-detail-row"><span>Trend</span><span style={{ color: tc }}>{station.trend}</span></div><div className="obs-detail-row"><span>Region</span><span>{station.region}</span></div><div className="obs-detail-row"><span>Coordinates</span><span>{station.lat.toFixed(4)}, {station.lng.toFixed(4)}</span></div>{station.assignee && <div className="obs-detail-row"><span>Assigned to</span><span>{station.assignee}</span></div>}</div>
      {station.locationId && <button className="obs-detail-history-btn" onClick={() => navigate(`/locations/${station.locationId}`)}>View history</button>}
      <div className="obs-detail-tabs"><div className={`obs-detail-tab${detailTab === 'previous' ? ' active' : ''}`} onClick={() => setDetailTab('previous')}>Previous ({station.previousMeasurements.length})</div><div className={`obs-detail-tab${detailTab === 'planned' ? ' active' : ''}`} onClick={() => setDetailTab('planned')}>Planned ({station.plannedMeasurements.length})</div></div>
      <div className="obs-detail-table-wrap"><table className="obs-detail-table"><thead><tr><th>Date</th><th>Type</th><th>pH</th><th>Temp</th><th>O&#8322;</th><th>Result</th><th>Worker</th></tr></thead><tbody>{records.map((r, i) => (<tr key={i}><td className="obs-detail-date">{r.date}</td><td>{r.type}</td><td>{r.ph}</td><td>{r.temperature}</td><td>{r.dissolved_o2}</td><td><span style={{ color: rc(r.result), fontWeight: 500 }}>{r.result}</span></td><td>{r.worker}</td></tr>))}</tbody></table></div></div></div>);
}

function toggle(set: Set<string>, val: string): Set<string> { const next = new Set(set); if (next.has(val)) next.delete(val); else next.add(val); return next; }

export default function ObservationRoom() {
  const navigate = useNavigate();
  const db = useDatabase();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [fly, setFly] = useState<{ lat: number; lng: number } | null>(null);
  const [timeline, setTimeline] = useState(73); // day 73 = March 14
  const markerRefs = useRef<Record<number, L.Marker>>({});
  const listRef = useRef<HTMLDivElement>(null);

  // Load all historical measurements once
  const [historicalData, setHistoricalData] = useState<Map<string, HistoricalMeasurement[]>>(new Map());
  useEffect(() => {
    if (!db.ready) return;
    db.getAllHistoricalMeasurements().then(setHistoricalData);
  }, [db.ready, db.getAllHistoricalMeasurements]);

  const timelineDate = useMemo(() => dayOfYearToDate(timeline), [timeline]);

  // Layer 1: Build base station data (static, no timeline dependency)
  const baseStations = useMemo(() => {
    const userMap = new Map(db.users.map(u => [u.id, u]));
    const templateMap = new Map(db.measurementTemplates.map(t => [t.id, t]));
    const activityByLoc = new Map(db.activityItems.map(a => [a.location?.id, a]));
    const visitsByLoc = new Map<string, typeof db.visits>();
    for (const v of db.visits) { const arr = visitsByLoc.get(v.location_id) || []; arr.push(v); visitsByLoc.set(v.location_id, arr); }
    const measByVisit = new Map<string, typeof db.measurements>();
    for (const m of db.measurements) { const arr = measByVisit.get(m.visit_id) || []; arr.push(m); measByVisit.set(m.visit_id, arr); }

    return db.locations.map((loc, i) => {
      const locVisits = (visitsByLoc.get(loc.id) || []).sort((a, b) => b.planned_date.localeCompare(a.planned_date));
      const baseRating = RATING_DISPLAY[loc.rating] || 'Moderate';
      const desc = loc.description || '';
      let program: Program = 'River';
      if (desc.toLowerCase().includes('sea')) program = 'Sea';
      else if (desc.toLowerCase().includes('lake')) program = 'Lake';
      else if (desc.toLowerCase().includes('soil') || loc.environment_type === 'soil') program = 'Soil';
      const regionMatch = desc.match(/in (.+)$/);
      const region = regionMatch?.[1] || 'Unknown';
      const activity = activityByLoc.get(loc.id);
      const hasAnomaly = activity?.hasAnomaly || false;

      // Collect all measurement records with visit context
      const allLocMeas: { m: typeof db.measurements[0]; v: typeof db.visits[0] }[] = [];
      for (const v of locVisits) { for (const m of measByVisit.get(v.id) || []) { allLocMeas.push({ m, v }); } }
      allLocMeas.sort((a, b) => (b.m.measurement_date || b.v.planned_date).localeCompare(a.m.measurement_date || a.v.planned_date));

      return {
        id: i, locationId: loc.id, name: loc.name, lat: loc.latitude, lng: loc.longitude,
        baseRating, program, region, hasAnomaly,
        anomalyLabel: hasAnomaly ? (activity?.measurementType ? `${activity.measurementType} anomaly` : 'Anomaly') : undefined,
        anomalyTime: activity?.time,
        allVisits: locVisits, allLocMeas, userMap, templateMap,
      };
    });
  }, [db.locations, db.visits, db.measurements, db.users, db.measurementTemplates, db.activityItems]);

  // Layer 2: Project stations to the timeline date
  // "today" is the real-world cutoff — historical data after this is simulated/future
  const TODAY = '2026-03-14';

  const stations = useMemo((): Station[] => {
    // The effective date for data is the earlier of timeline and today
    // Looking into the past: we see real data. Looking into the future: we only see what's been measured up to today.
    const effectiveDataDate = timelineDate <= TODAY ? timelineDate : TODAY;

    return baseStations.map(base => {
      const locHist = historicalData.get(base.locationId) || [];

      // Only consider data that has actually been measured (before effective date)
      const chemHist = locHist.filter(h => h.measurement_type === 'Basic Chemistry' && h.date <= effectiveDataDate);
      const latestHist = chemHist.length > 0 ? chemHist[chemHist.length - 1] : null;
      const histPh = latestHist?.results?.ph;
      const rating = histPh != null ? phToRating(histPh) : base.baseRating;
      const lastPh = histPh != null ? histPh.toFixed(1) : '\u2014';

      // Trend from last 3 historical pH values
      let trend = 'Stable';
      if (chemHist.length >= 2) {
        const last3 = chemHist.slice(-3).map(h => h.results?.ph).filter((v): v is number => v != null);
        if (last3.length >= 2) {
          const diff = last3[last3.length - 1] - last3[0];
          if (diff > 0.3) trend = 'Improving'; else if (diff < -0.3) trend = 'Declining';
        }
      }

      // Latest measurement type from actually measured data
      const anyMeasured = locHist.filter(h => h.date <= effectiveDataDate);
      const latestAny = anyMeasured.length > 0 ? anyMeasured[anyMeasured.length - 1] : null;
      const measurement = latestAny?.measurement_type || 'No data';

      // Compute this location's typical measurement interval from its history
      // Then data is "stale" if last measurement is older than 1.5x that interval
      const measDates = anyMeasured.map(h => h.date).sort();
      let avgIntervalDays = 180; // default fallback
      if (measDates.length >= 2) {
        const first = new Date(measDates[0] + 'T00:00:00').getTime();
        const last = new Date(measDates[measDates.length - 1] + 'T00:00:00').getTime();
        avgIntervalDays = Math.round((last - first) / (measDates.length - 1) / 86400000);
      }
      const staleDays = Math.max(90, Math.round(avgIntervalDays * 1.5)); // at least 90 days grace

      const lastMeasDate = latestAny?.date;
      const daysSinceLastMeas = lastMeasDate
        ? Math.floor((new Date(timelineDate + 'T00:00:00').getTime() - new Date(lastMeasDate + 'T00:00:00').getTime()) / 86400000)
        : Infinity;
      const hasRecentData = daysSinceLastMeas <= staleDays;

      // Visits relative to timeline date
      const pastVisits = base.allVisits.filter(v => v.planned_date <= timelineDate);
      const futureVisits = base.allVisits.filter(v => v.planned_date > timelineDate);
      const latestPastVisit = pastVisits[0]; // sorted desc
      const nextFutureVisit = futureVisits.length > 0 ? futureVisits[futureVisits.length - 1] : null;
      const assigneeUser = (latestPastVisit?.assigned_to || nextFutureVisit?.assigned_to) ? base.userMap.get(latestPastVisit?.assigned_to || nextFutureVisit?.assigned_to || '') : null;

      // Color: rating color only if data is recent enough, otherwise gray (stale/no data)
      const ratingColor = hasRecentData ? (RATING_COLORS[rating] || '#639922') : '#888780';

      let sTab: Tab | 'anomaly'; let status: string; let timeLabel: string; let color: string; let anomaly: string | undefined;

      if (base.hasAnomaly && timelineDate >= TODAY) {
        sTab = 'anomaly'; anomaly = base.anomalyLabel; status = 'Anomaly detected';
        timeLabel = base.anomalyTime || 'Recently'; color = '#E24B4A';
      } else if (latestPastVisit?.status === 'in_progress' || (latestPastVisit && latestPastVisit.planned_date === timelineDate)) {
        sTab = 'progress'; status = 'In progress'; timeLabel = 'Active now'; color = '#378ADD';
      } else if (hasRecentData) {
        sTab = 'done';
        status = lastMeasDate ? `Measured ${fmtDate(lastMeasDate)}` : 'Measured';
        timeLabel = lastMeasDate ? fmtDate(lastMeasDate) : '\u2014';
        color = ratingColor;
      } else if (nextFutureVisit) {
        sTab = 'planned'; status = `Planned ${fmtDate(nextFutureVisit.planned_date)}`;
        timeLabel = fmtDate(nextFutureVisit.planned_date);
        color = '#888780';
      } else {
        sTab = 'planned';
        status = lastMeasDate ? `Stale (last: ${fmtDate(lastMeasDate)})` : 'No data';
        timeLabel = lastMeasDate ? fmtDate(lastMeasDate) : '\u2014';
        color = '#888780';
      }

      // Build measurement records relative to timeline date
      const previousMeasurements: MeasurementRecord[] = [];
      const plannedMeasurements: MeasurementRecord[] = [];

      // From historical data — only show results for actually measured records (before today)
      for (const h of locHist) {
        const isMeasured = h.date <= effectiveDataDate;
        const isPast = h.date <= timelineDate;
        if (isPast && isMeasured) {
          const res = h.results || {};
          previousMeasurements.push({
            date: h.date, type: h.measurement_type,
            ph: res.ph != null ? res.ph.toFixed(1) : '\u2014',
            temperature: res.temperature != null ? `${res.temperature.toFixed(1)}\u00B0C` : '\u2014',
            conductivity: res.conductivity != null ? `${res.conductivity.toFixed(0)} \u00B5S/cm` : '\u2014',
            dissolved_o2: res.oxygen != null ? `${res.oxygen.toFixed(1)} mg/L` : '\u2014',
            result: 'Pass', worker: '\u2014',
          });
        } else {
          plannedMeasurements.push({
            date: h.date, type: h.measurement_type,
            ph: '\u2014', temperature: '\u2014', conductivity: '\u2014', dissolved_o2: '\u2014',
            result: 'Scheduled', worker: '\u2014',
          });
        }
      }

      // Also include visit-based measurements from the pipeline
      for (const { m, v } of base.allLocMeas) {
        const tmpl = base.templateMap.get(m.measurement_template_id);
        const worker = m.recorded_by ? base.userMap.get(m.recorded_by)?.full_name || 'Unknown' : v.assigned_to ? base.userMap.get(v.assigned_to)?.full_name || 'Unassigned' : 'Unassigned';
        const date = m.measurement_date || v.planned_date;
        const isMeasured = date <= effectiveDataDate;
        if (date <= timelineDate && isMeasured) {
          const res = (m.results || {}) as Record<string, number>;
          previousMeasurements.push({
            date, type: tmpl?.name || 'Unknown',
            ph: res.ph != null ? res.ph.toFixed(1) : '\u2014',
            temperature: res.temperature != null ? `${res.temperature.toFixed(1)}\u00B0C` : '\u2014',
            conductivity: res.conductivity != null ? `${res.conductivity.toFixed(0)} \u00B5S/cm` : '\u2014',
            dissolved_o2: res.oxygen != null ? `${res.oxygen.toFixed(1)} mg/L` : '\u2014',
            result: m.pipeline_status === 'validated' ? 'Pass' : m.pipeline_status === 'rejected' ? 'Fail' : 'Pending',
            worker,
          });
        } else {
          plannedMeasurements.push({
            date, type: tmpl?.name || 'Unknown',
            ph: '\u2014', temperature: '\u2014', conductivity: '\u2014', dissolved_o2: '\u2014',
            result: 'Scheduled', worker,
          });
        }
      }

      previousMeasurements.sort((a, b) => b.date.localeCompare(a.date));
      plannedMeasurements.sort((a, b) => a.date.localeCompare(b.date));

      return {
        id: base.id, name: base.name, lat: base.lat, lng: base.lng, color, rating,
        status, measurement, lastPh, trend, tab: sTab, timeLabel, anomaly,
        assignee: assigneeUser?.full_name, program: base.program, region: base.region,
        locationId: base.locationId, previousMeasurements, plannedMeasurements,
      };
    });
  }, [baseStations, timelineDate, historicalData]);

  // Filter options derived from stations
  const allRegions = useMemo(() => Array.from(new Set(stations.map(s => s.region))).sort(), [stations]);
  const allPrograms: Program[] = ['River', 'Lake', 'Sea', 'Soil'];
  const allRatings = ['Very poor', 'Poor', 'Moderate', 'Good', 'Very good'];
  const allMeasurements = useMemo(() => Array.from(new Set(stations.map(s => s.measurement).filter(m => m !== 'No data'))).sort(), [stations]);
  const allAssignees = useMemo(() => Array.from(new Set(stations.filter(s => s.assignee).map(s => s.assignee!))).sort(), [stations]);

  const [filterRegions, setFilterRegions] = useState<Set<string>>(new Set());
  const [filterPrograms, setFilterPrograms] = useState<Set<string>>(new Set());
  const [filterRatings, setFilterRatings] = useState<Set<string>>(new Set());
  const [filterMeasurements, setFilterMeasurements] = useState<Set<string>>(new Set());
  const [filterAssignees, setFilterAssignees] = useState<Set<string>>(new Set());
  const activeFilterCount = filterRegions.size + filterPrograms.size + filterRatings.size + filterMeasurements.size + filterAssignees.size;

  const filtered = useMemo(() => stations.filter(s => {
    if (tab === 'planned' && s.tab !== 'planned') return false;
    if (tab === 'progress' && s.tab !== 'progress' && s.tab !== 'anomaly') return false;
    if (tab === 'done' && s.tab !== 'done') return false;
    if (query.trim()) { const q = query.toLowerCase(); if (!s.name.toLowerCase().includes(q) && !s.measurement.toLowerCase().includes(q)) return false; }
    if (filterRegions.size > 0 && !filterRegions.has(s.region)) return false;
    if (filterPrograms.size > 0 && !filterPrograms.has(s.program)) return false;
    if (filterRatings.size > 0 && !filterRatings.has(s.rating)) return false;
    if (filterMeasurements.size > 0 && !filterMeasurements.has(s.measurement)) return false;
    if (filterAssignees.size > 0 && (!s.assignee || !filterAssignees.has(s.assignee))) return false;
    return true;
  }), [stations, tab, query, filterRegions, filterPrograms, filterRatings, filterMeasurements, filterAssignees]);

  const visibleIdxSet = useMemo(() => new Set(filtered.map(s => s.id)), [filtered]);
  const selectedStation = useMemo(() => selectedIdx !== null ? stations.find(s => s.id === selectedIdx) || null : null, [selectedIdx, stations]);
  const handleStationSelect = useCallback((s: Station) => { setSelectedIdx(s.id); setFly({ lat: s.lat, lng: s.lng }); setTimeout(() => { markerRefs.current[s.id]?.openPopup(); }, 1100); }, []);
  const handleMarkerClick = useCallback((s: Station) => { setSelectedIdx(s.id); setFly({ lat: s.lat, lng: s.lng }); }, []);
  const clearFilters = useCallback(() => { setFilterRegions(new Set()); setFilterPrograms(new Set()); setFilterRatings(new Set()); setFilterMeasurements(new Set()); setFilterAssignees(new Set()); }, []);
  const trendColor = (t: string) => t === 'Declining' ? '#E24B4A' : t === 'Improving' ? '#639922' : 'var(--color-text-secondary)';
  const ratingBg = (c: string) => c === '#E24B4A' ? '#FCEBEB' : c === '#D85A30' ? '#FAECE7' : c === '#EF9F27' ? '#FAEEDA' : c === '#639922' ? '#EAF3DE' : '#E1F5EE';
  const ratingFg = (c: string) => { if (c === '#888780') return '#639922'; if (c === '#378ADD') return '#185FA5'; return c; };

  const CARD_HEIGHT = 62;
  const [scrollTop, setScrollTop] = useState(0);
  const [listHeight, setListHeight] = useState(600);
  useEffect(() => { const el = listRef.current; if (!el) return; const obs = new ResizeObserver(entries => { for (const entry of entries) setListHeight(entry.contentRect.height); }); obs.observe(el); return () => obs.disconnect(); }, [selectedStation]);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => { setScrollTop(e.currentTarget.scrollTop); }, []);
  const visibleRange = useMemo(() => { const buffer = 5; const start = Math.max(0, Math.floor(scrollTop / CARD_HEIGHT) - buffer); const end = Math.min(filtered.length, Math.ceil((scrollTop + listHeight) / CARD_HEIGHT) + buffer); return { start, end }; }, [scrollTop, listHeight, filtered.length]);

  return (<><div className="obs"><div className="obs-left">{selectedStation ? (<DetailPanel station={selectedStation} onClose={() => setSelectedIdx(null)} />) : (<><div className="obs-left-hdr"><div className="obs-title">Observation room</div><div className="obs-tabs">{(['all', 'planned', 'progress', 'done'] as Tab[]).map(t => (<div key={t} className={`obs-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t === 'all' ? 'All' : t === 'planned' ? 'Planned' : t === 'progress' ? 'Active' : 'Done'}</div>))}</div><input className="search-box" placeholder="Search locations, measurements..." value={query} onChange={e => setQuery(e.target.value)} /></div>
    <div className="obs-filters-wrap"><div className="obs-filters"><Dropdown label="Region" options={allRegions} selected={filterRegions} onToggle={v => setFilterRegions(s => toggle(s, v))} /><Dropdown label="Program" options={allPrograms} selected={filterPrograms} onToggle={v => setFilterPrograms(s => toggle(s, v))} colorMap={PROGRAM_COLORS} /><Dropdown label="Rating" options={allRatings} selected={filterRatings} onToggle={v => setFilterRatings(s => toggle(s, v))} colorMap={RATING_COLORS} /></div><div className="obs-filters"><Dropdown label="Measurement" options={allMeasurements} selected={filterMeasurements} onToggle={v => setFilterMeasurements(s => toggle(s, v))} /><Dropdown label="Worker" options={allAssignees} selected={filterAssignees} onToggle={v => setFilterAssignees(s => toggle(s, v))} />{activeFilterCount > 0 && <button className="obs-filter-clear" onClick={clearFilters}>Clear ({activeFilterCount})</button>}</div></div>
    <div className="obs-count">{filtered.length} of {stations.length} stations &middot; {fmtDate(timelineDate)}</div>
    <div className="obs-list" ref={listRef} onScroll={handleScroll}>{filtered.length === 0 && <div className="obs-empty">No matching stations</div>}{filtered.length > 0 && (<div style={{ height: filtered.length * CARD_HEIGHT, position: 'relative' }}>{filtered.slice(visibleRange.start, visibleRange.end).map((s, vi) => { const idx = visibleRange.start + vi; const isAnomaly = s.tab === 'anomaly'; const isSelected = selectedIdx === s.id; const statusClass = isAnomaly ? 'st-anomaly' : s.tab === 'progress' ? 'st-progress' : s.tab === 'done' ? 'st-completed' : 'st-planned'; return (<div key={s.id} className={`obs-card${isAnomaly ? ' highlight' : ''}${isSelected ? ' selected' : ''}`} style={{ position: 'absolute', top: idx * CARD_HEIGHT, left: 0, right: 0 }} onClick={() => handleStationSelect(s)}><div className="obs-card-top"><div className={`obs-card-status ${statusClass}`} /><div className="obs-card-title">{s.name}</div><div className="obs-card-time">{s.timeLabel}</div></div><div className="obs-card-body">{isAnomaly && s.anomaly && <span className="obs-card-tag tag-anomaly">{s.anomaly}</span>}<span className="obs-card-tag tag-program" style={{ background: PROGRAM_COLORS[s.program] + '18', color: PROGRAM_COLORS[s.program] }}>{s.program}</span><span className="obs-card-tag tag-type">{s.measurement}</span>{s.assignee && <span className="obs-card-tag tag-assignee">{s.assignee}</span>}</div></div>); })}</div>)}</div></>)}</div>
    <div className="obs-right"><div className="map-container"><MapContainer id="obs-map" center={[46.15, 14.99]} zoom={8} minZoom={3} maxZoom={18} style={{ width: '100%', height: '100%' }} zoomControl={false} scrollWheelZoom={true}><MapReady /><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" maxZoom={18} />{fly && <FlyTo lat={fly.lat} lng={fly.lng} />}
      {RIVERS.map(r => (<Polyline key={r.name} positions={r.coords} pathOptions={{ color: r.color, weight: 4, opacity: 0.8, lineJoin: 'round', lineCap: 'round' }}><Popup>{r.name}</Popup></Polyline>))}
      {LAKES.map(l => (<Circle key={l.name} center={[l.lat, l.lng]} radius={800} pathOptions={{ color: l.color, fillColor: l.color, fillOpacity: 0.3, weight: 2 }}><Popup>{l.name}</Popup></Circle>))}
      {stations.map(s => { if (!visibleIdxSet.has(s.id)) return null; const isPulse = s.color === '#378ADD' || s.color === '#E24B4A'; const isSelected = selectedIdx === s.id; return (<Marker key={s.id} position={[s.lat, s.lng]} icon={makeIcon(s.color, isPulse, isSelected)} ref={r => { if (r) markerRefs.current[s.id] = r; }} eventHandlers={{ click: () => handleMarkerClick(s) }}><Popup maxWidth={220} minWidth={180}><div><div className="popup-title">{s.name}</div><span className="popup-rating" style={{ background: ratingBg(s.color), color: ratingFg(s.color) }}>{s.rating}</span><div style={{ marginTop: 8 }}><div className="popup-row"><span>Program</span><span className="val">{s.program}</span></div><div className="popup-row"><span>Status</span><span className="val">{s.status}</span></div><div className="popup-row"><span>Measurement</span><span className="val">{s.measurement}</span></div><div className="popup-row"><span>Last pH</span><span className="val">{s.lastPh}</span></div><div className="popup-row"><span>Trend</span><span className="val" style={{ color: trendColor(s.trend) }}>{s.trend}</span></div>{s.assignee && <div className="popup-row"><span>Worker</span><span className="val">{s.assignee}</span></div>}</div>{s.locationId && <button className="popup-history-btn" onClick={(e) => { e.stopPropagation(); navigate(`/locations/${s.locationId}`); }}>View history</button>}</div></Popup></Marker>); })}
    </MapContainer></div>
    <div className="live-badge"><span className="live-dot" />{filtered.length} stations &middot; {fmtDate(timelineDate)}</div>
    <div className="map-legend">{LEGEND.map(l => (<span key={l.label} className="ml-item"><span className="ml-bar" style={{ background: l.color }} />{l.label}</span>))}</div>
    <div className="timeline-bar"><span>View as of:</span><input type="range" min={1} max={365} value={timeline} onChange={e => setTimeline(Number(e.target.value))} /><div className="timeline-date">{fmtDate(timelineDate)}, 2026</div></div></div></div>
    <style>{CSS}</style></>);
}

const CSS = `.obs{font-family:var(--font-sans);display:grid;grid-template-columns:340px minmax(0,1fr);height:100%;overflow:hidden}.obs-left{display:flex;flex-direction:column;border-right:0.5px solid var(--color-border-tertiary);background:var(--color-background-primary);overflow:hidden;min-height:0}.obs-left-hdr{padding:12px 14px;border-bottom:0.5px solid var(--color-border-tertiary);display:flex;flex-direction:column;gap:8px;flex-shrink:0}.obs-title{font-size:15px;font-weight:500;color:var(--color-text-primary)}.obs-tabs{display:flex;gap:0;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);overflow:hidden}.obs-tab{flex:1;text-align:center;padding:5px 0;font-size:11px;font-weight:500;cursor:pointer;border:none;background:transparent;color:var(--color-text-secondary);transition:all .15s}.obs-tab.active{background:var(--color-text-info);color:white}.obs-tab:not(.active):hover{background:var(--color-background-secondary)}.search-box{padding:7px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:12px;color:var(--color-text-primary);background:var(--color-background-secondary);font-family:var(--font-sans);width:100%;outline:none;box-sizing:border-box}.obs-filters-wrap{border-bottom:0.5px solid var(--color-border-tertiary);flex-shrink:0;padding:6px 10px;display:flex;flex-direction:column;gap:4px}.obs-filters{display:flex;flex-wrap:nowrap;gap:3px;align-items:center}.obs-filter-clear{border:none;background:none;color:var(--color-text-info);font-size:9px;cursor:pointer;font-family:var(--font-sans);padding:1px 2px;flex-shrink:0}.obs-filter-clear:hover{text-decoration:underline}.obs-dd{position:relative;flex:1;min-width:0}.obs-dd-btn{display:flex;align-items:center;gap:2px;padding:3px 5px;border:0.5px solid var(--color-border-tertiary);border-radius:4px;background:var(--color-background-primary);cursor:pointer;font-family:var(--font-sans);font-size:9px;font-weight:500;color:var(--color-text-secondary);transition:.12s;width:100%;overflow:hidden}.obs-dd-btn:hover{border-color:var(--color-border-secondary)}.obs-dd-btn.has-sel{border-color:var(--color-border-info);background:var(--color-background-info);color:var(--color-text-info)}.obs-dd-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.obs-dd-count{background:var(--color-text-info);color:#fff;font-size:8px;font-weight:600;padding:0 4px;border-radius:6px;min-width:14px;text-align:center;line-height:14px}.obs-dd-arrow{transition:transform .15s;flex-shrink:0}.obs-dd-arrow.open{transform:rotate(180deg)}.obs-dd-menu{position:absolute;top:100%;left:0;z-index:500;background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,.1);margin-top:2px;min-width:140px;max-height:200px;overflow-y:auto;padding:4px 0}.obs-dd-option{display:flex;align-items:center;gap:6px;padding:5px 10px;font-size:11px;cursor:pointer;color:var(--color-text-secondary);white-space:nowrap}.obs-dd-option:hover{background:var(--color-background-secondary)}.obs-dd-option input{width:12px;height:12px;margin:0;accent-color:var(--color-text-info)}.obs-dd-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}.obs-count{padding:5px 14px;font-size:10px;color:var(--color-text-tertiary);border-bottom:0.5px solid var(--color-border-tertiary);flex-shrink:0}.obs-list{flex:1;min-height:0;overflow-y:auto;padding:8px}.obs-empty{text-align:center;padding:20px;font-size:11px;color:var(--color-text-tertiary)}.obs-card{padding:10px 12px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);cursor:pointer;transition:all .15s;box-sizing:border-box;height:56px;overflow:hidden}.obs-card:hover{border-color:var(--color-border-secondary);background:var(--color-background-secondary)}.obs-card.selected{border-color:var(--color-border-info);background:var(--color-background-info)}.obs-card.highlight{border-color:var(--color-border-danger);background:var(--color-background-danger)}.obs-card-top{display:flex;align-items:center;gap:8px;margin-bottom:4px}.obs-card-status{width:8px;height:8px;border-radius:50%;flex-shrink:0}.st-completed{background:#639922}.st-progress{background:#378ADD}.st-planned{background:var(--color-border-secondary)}.st-anomaly{background:#E24B4A}.obs-card-title{font-size:12px;font-weight:500;color:var(--color-text-primary);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.obs-card-time{font-size:10px;color:var(--color-text-tertiary)}.obs-card-body{font-size:11px;color:var(--color-text-secondary);display:flex;gap:4px;flex-wrap:wrap}.obs-card-tag{padding:1px 6px;border-radius:3px;font-size:10px}.tag-type{background:var(--color-background-info);color:var(--color-text-info)}.tag-program{font-weight:500}.tag-assignee{background:var(--color-background-secondary);color:var(--color-text-secondary)}.tag-anomaly{background:var(--color-background-danger);color:var(--color-text-danger)}.obs-detail{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden}.obs-detail-header{padding:8px 12px;border-bottom:0.5px solid var(--color-border-tertiary);flex-shrink:0}.obs-detail-back{display:flex;align-items:center;gap:4px;border:none;background:none;cursor:pointer;font-family:var(--font-sans);font-size:12px;color:var(--color-text-info);padding:2px 0}.obs-detail-back:hover{text-decoration:underline}.obs-detail-scroll{flex:1;overflow-y:auto;min-height:0;padding:12px 14px}.obs-detail-name{font-size:15px;font-weight:600;color:var(--color-text-primary);margin-bottom:8px}.obs-detail-badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.obs-detail-badge{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}.obs-detail-info{border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:8px 12px;margin-bottom:14px}.obs-detail-row{display:flex;justify-content:space-between;font-size:11px;padding:3px 0;color:var(--color-text-secondary)}.obs-detail-row span:last-child{color:var(--color-text-primary);font-weight:500;text-align:right}.obs-detail-history-btn{display:block;width:100%;margin-bottom:14px;padding:7px 0;border:1px solid var(--color-text-info);border-radius:var(--border-radius-md);background:transparent;color:var(--color-text-info);font-size:11px;font-weight:500;cursor:pointer;font-family:var(--font-sans);transition:.15s}.obs-detail-history-btn:hover{background:var(--color-text-info);color:white}.obs-detail-tabs{display:flex;gap:0;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);overflow:hidden;margin-bottom:10px}.obs-detail-tab{flex:1;text-align:center;padding:6px 0;font-size:11px;font-weight:500;cursor:pointer;background:transparent;color:var(--color-text-secondary);transition:all .15s}.obs-detail-tab.active{background:var(--color-text-info);color:white}.obs-detail-tab:not(.active):hover{background:var(--color-background-secondary)}.obs-detail-table-wrap{overflow-x:auto;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md)}.obs-detail-table{width:100%;border-collapse:collapse;font-size:10px;min-width:480px}.obs-detail-table th{text-align:left;padding:6px 8px;background:var(--color-background-secondary);color:var(--color-text-secondary);font-weight:500;border-bottom:0.5px solid var(--color-border-tertiary);white-space:nowrap;position:sticky;top:0}.obs-detail-table td{padding:5px 8px;border-bottom:0.5px solid var(--color-border-tertiary);color:var(--color-text-primary);white-space:nowrap}.obs-detail-table tr:last-child td{border-bottom:none}.obs-detail-table tr:hover td{background:var(--color-background-secondary)}.obs-detail-date{font-family:monospace;font-size:10px}.obs-right{position:relative;display:flex;flex-direction:column;overflow:hidden}.obs-right .map-container{flex:1;position:relative}.obs-right #obs-map{position:absolute;top:0;left:0;right:0;bottom:0;z-index:0}.live-badge{position:absolute;top:10px;right:10px;z-index:400;background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:4px 10px;font-size:11px;color:var(--color-text-primary);display:flex;align-items:center;gap:6px}.live-dot{width:6px;height:6px;border-radius:50%;background:#E24B4A;animation:obs-blink 1.5s infinite}.map-legend{position:absolute;bottom:52px;left:10px;background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:8px 10px;font-size:10px;display:flex;gap:8px;align-items:center;z-index:400}.ml-item{display:flex;align-items:center;gap:4px;color:var(--color-text-secondary)}.ml-bar{width:16px;height:4px;border-radius:2px}.timeline-bar{padding:8px 14px;border-top:0.5px solid var(--color-border-tertiary);background:var(--color-background-primary);display:flex;align-items:center;gap:10px;flex-shrink:0;z-index:1}.timeline-bar span{font-size:11px;color:var(--color-text-secondary);white-space:nowrap}.timeline-bar input[type=range]{flex:1}.timeline-date{font-size:12px;font-weight:500;color:var(--color-text-primary);min-width:100px}.popup-title{font-weight:500;font-size:13px;margin-bottom:4px}.popup-rating{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:500}.popup-row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:var(--color-text-secondary);gap:8px}.popup-row .val{color:var(--color-text-primary);font-weight:500;text-align:right}.popup-history-btn{display:block;width:100%;margin-top:8px;padding:5px 0;border:1px solid var(--color-text-info);border-radius:4px;background:transparent;color:var(--color-text-info);font-size:11px;font-weight:500;cursor:pointer;font-family:var(--font-sans);transition:.15s}.popup-history-btn:hover{background:var(--color-text-info);color:white}@keyframes obs-blink{0%,100%{opacity:1}50%{opacity:.3}}@keyframes obs-pulse{0%{transform:scale(1);opacity:.5}100%{transform:scale(1.8);opacity:0}}@media(max-width:768px){.obs{grid-template-columns:1fr;grid-template-rows:auto 1fr}.obs-left{max-height:45vh}}`;
