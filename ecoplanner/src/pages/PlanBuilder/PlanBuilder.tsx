import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, List, Calendar } from 'lucide-react';
import type { Entry, Rating, Freq, Status, ViewMode, EmergencyEvent, Program } from './planData';
import type { Visit, Measurement } from '../../types';
import {
  WORKERS, WATERWAYS, MEASUREMENTS, RATINGS, FREQS, PROGRAMS,
  RATING_COLORS, RATING_LABELS, FREQ_LABELS, STATUS_COLORS, MEAS_ICONS,
  workerName, formatDate, groupEntriesByDate,
  dateStr, addDays, getWeekStart,
} from './planData';
import { useDatabase } from '../../context/DatabaseContext';
import PlanCalendar from './PlanCalendar';
import EmergencyPanel from './EmergencyPanel';
import AddEntryModal from './AddEntryModal';
import NotificationPanel from './NotificationPanel';
import type { Notification } from './planData';

const ROW_HEIGHT = 44;
const OVERSCAN = 10;
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PlanBuilder() {
  const { planBuilderEntries, addVisits, addMeasurements, updateVisit, updateMeasurement, monitoringPlans, measurements: dbMeasurements, visits: dbVisits } = useDatabase();
  const [entries, setEntries] = useState(planBuilderEntries);

  // Sync when shared context changes (e.g. PlanGenerator confirms suggestions)
  useEffect(() => {
    setEntries(prev => {
      const prevIds = new Set(prev.map(e => e.id));
      const newOnes = planBuilderEntries.filter(e => !prevIds.has(e.id));
      if (newOnes.length === 0) return prev;
      return [...prev, ...newOnes];
    });
  }, [planBuilderEntries]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const flashRows = useCallback((ids: Iterable<string>) => {
    const s = new Set(ids);
    setFlashIds(s);
    setTimeout(() => setFlashIds(new Set()), 1500);
  }, []);

  // Worker ID (w1,w2) → User ID (u2,u4) mapping for visits/measurements
  const workerToUser: Record<string, string> = { w1: 'u2', w2: 'u4', w3: 'u2', w4: 'u4', w5: 'u2', w6: 'u4', w7: 'u2', w8: 'u4', w9: 'u2', w10: 'u4' };

  // Sync PlanBuilder entries to Visit + Measurement records in the database
  const syncEntriesToVisits = useCallback((updatedEntries: Entry[]) => {
    const planId = monitoringPlans[0]?.id ?? 'p1';
    const existingVisitIds = new Set(dbVisits.map(v => v.id));
    const existingMeasIds = new Set(dbMeasurements.map(m => m.id));

    const newVisits: Visit[] = [];
    const newMeasurements: Measurement[] = [];

    for (const e of updatedEntries) {
      const visitId = `plb-v-${e.id}`;
      const measId = `plb-m-${e.id}`;
      const userId = workerToUser[e.assigneeId] || e.assigneeId || '';
      const visitStatus = e.status === 'cancelled' ? 'cancelled' as const : 'planned' as const;
      const pipelineStatus = e.status === 'cancelled' ? 'rejected' as const : 'pending_sample' as const;

      if (existingVisitIds.has(visitId)) {
        // Update existing
        updateVisit(visitId, {
          planned_date: e.nextDate,
          status: visitStatus,
          assigned_to: userId,
        });
        updateMeasurement(measId, {
          planned_date: e.nextDate,
          status: e.status === 'cancelled' ? 'cancelled' : 'planned',
          assignee_id: userId,
          pipeline_status: pipelineStatus,
        });
      } else {
        // Create new
        newVisits.push({
          id: visitId,
          plan_id: planId,
          location_id: e.locationId,
          planned_date: e.nextDate,
          status: visitStatus,
          assigned_to: userId,
          logistics_cost: 50,
        });
        newMeasurements.push({
          id: measId,
          location_id: e.locationId,
          measurement_template_id: '',
          plan_entry_id: e.id,
          visit_id: visitId,
          assignee_id: userId,
          status: e.status === 'cancelled' ? 'cancelled' : 'planned',
          pipeline_status: pipelineStatus,
          planned_date: e.nextDate,
          analysis_cost: e.cost,
        });
      }
    }

    if (newVisits.length > 0) addVisits(newVisits);
    if (newMeasurements.length > 0) addMeasurements(newMeasurements);
  }, [dbVisits, dbMeasurements, monitoringPlans, addVisits, addMeasurements, updateVisit, updateMeasurement]);

  const [search, setSearch] = useState('');
  const [filterRating, setFilterRating] = useState<Rating | ''>('');
  const [filterMeas, setFilterMeas] = useState('');
  const [filterWorker, setFilterWorker] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRiver, setFilterRiver] = useState('');
  const [filterProgram, setFilterProgram] = useState<Program | ''>('');
  const [sortKey, setSortKey] = useState<'location' | 'measurement' | 'rating' | 'assignee' | 'date' | 'status'>('location');
  const [sortAsc, setSortAsc] = useState(true);
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);

  // New state for calendar views + emergency
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedDate, setSelectedDate] = useState('2026-03-14');
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false);
  const [emergencyEvents, setEmergencyEvents] = useState<EmergencyEvent[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  let _nid = useRef(0);
  const pushNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => [{
      ...n,
      id: `ntf-${++_nid.current}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    }, ...prev]);
  }, []);
  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);
  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);
  const clearNotifications = useCallback(() => setNotifications([]), []);

  // Memoized entries by date
  const entriesByDate = useMemo(() => groupEntriesByDate(entries), [entries]);

  // Filtered + sorted list (for table view)
  const filtered = useMemo(() => {
    let list = entries;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.locationName.toLowerCase().includes(q) ||
        e.locationCode.toLowerCase().includes(q) ||
        e.measurement.toLowerCase().includes(q) ||
        workerName(e.assigneeId).toLowerCase().includes(q)
      );
    }
    if (filterRating) list = list.filter(e => e.rating === filterRating);
    if (filterMeas) list = list.filter(e => e.measurement === filterMeas);
    if (filterWorker === '__unassigned') list = list.filter(e => !e.assigneeId);
    else if (filterWorker) list = list.filter(e => e.assigneeId === filterWorker);
    if (filterStatus) list = list.filter(e => e.status === filterStatus);
    if (filterRiver) list = list.filter(e => e.river === filterRiver);
    if (filterProgram) list = list.filter(e => e.program === filterProgram);

    const dir = sortAsc ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'location': return a.locationName.localeCompare(b.locationName) * dir;
        case 'measurement': return a.measurement.localeCompare(b.measurement) * dir;
        case 'rating': return (RATINGS.indexOf(a.rating) - RATINGS.indexOf(b.rating)) * dir;
        case 'assignee': return workerName(a.assigneeId).localeCompare(workerName(b.assigneeId)) * dir;
        case 'date': return a.nextDate.localeCompare(b.nextDate) * dir;
        case 'status': return a.status.localeCompare(b.status) * dir;
      }
    });
    return list;
  }, [entries, search, filterRating, filterMeas, filterWorker, filterStatus, filterRiver, filterProgram, sortKey, sortAsc]);

  // Virtual window
  const totalHeight = filtered.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(filtered.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleEntries = filtered.slice(startIdx, endIdx);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setContainerHeight(e.contentRect.height));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sortArrow = (key: typeof sortKey) => sortKey === key ? (sortAsc ? ' \u25B2' : ' \u25BC') : '';

  // Selection
  const allSelected = selected.size > 0 && filtered.every(e => selected.has(e.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(e => e.id)));
  };

  const toggleOne = (id: string, idx: number, shiftKey: boolean) => {
    if (shiftKey && lastClickedIdx !== null) {
      const start = Math.min(lastClickedIdx, idx);
      const end = Math.max(lastClickedIdx, idx);
      const next = new Set(selected);
      for (let i = start; i <= end; i++) next.add(filtered[i].id);
      setSelected(next);
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }
    setLastClickedIdx(idx);
  };

  // Auto-assign rules
  const [showRules, setShowRules] = useState(false);
  const [showWorkerPanel, setShowWorkerPanel] = useState(false);
  const [autoRules, setAutoRules] = useState<{ id: string; waterway: string; region: string; primaryWorker: string; backupWorker: string; enabled: boolean }[]>([
    { id: 'ar1', waterway: 'Sava', region: 'Osrednjeslovenska', primaryWorker: 'w1', backupWorker: 'w9', enabled: true },
    { id: 'ar2', waterway: 'Drava', region: 'Podravska', primaryWorker: 'w2', backupWorker: 'w7', enabled: true },
    { id: 'ar3', waterway: 'Savinja', region: 'Savinjska', primaryWorker: 'w4', backupWorker: 'w9', enabled: true },
    { id: 'ar4', waterway: 'Krka', region: 'Dolenjska', primaryWorker: 'w5', backupWorker: 'w10', enabled: true },
    { id: 'ar5', waterway: 'Soča', region: 'Primorska', primaryWorker: 'w6', backupWorker: 'w3', enabled: true },
    { id: 'ar6', waterway: 'Mura', region: 'Pomurska', primaryWorker: 'w7', backupWorker: 'w2', enabled: true },
    { id: 'ar7', waterway: 'Kolpa', region: 'Dolenjska', primaryWorker: 'w5', backupWorker: 'w10', enabled: false },
    { id: 'ar8', waterway: 'Meža', region: 'Koroška', primaryWorker: 'w8', backupWorker: 'w4', enabled: true },
  ]);

  // Bulk actions
  const bulkAssign = (workerId: string) => {
    const wName = workerName(workerId);
    const affected = entries.filter(e => selected.has(e.id));
    const updated = affected.map(e => ({ ...e, assigneeId: workerId }));
    setEntries(prev => prev.map(e => selected.has(e.id) ? { ...e, assigneeId: workerId } : e));
    if (workerId) {
      for (const e of affected.slice(0, 20)) {
        pushNotification({ type: 'assigned', workerId, workerName: wName, entryId: e.id, locationName: e.locationName, measurement: e.measurement, message: `${wName}: assigned ${e.measurement} at ${e.locationName}` });
      }
      if (affected.length > 20) {
        pushNotification({ type: 'assigned', workerId, workerName: wName, entryId: '', locationName: '', measurement: '', message: `${wName}: assigned ${affected.length - 20} more entries` });
      }
      showToast(`Assigned ${affected.length} entries to ${wName}`, 'success');
    } else {
      showToast(`Unassigned ${affected.length} entries`, 'info');
    }
    syncEntriesToVisits(updated);
    flashRows(affected.map(e => e.id));
    setSelected(new Set());
  };

  const bulkSetFreq = (freq: Freq) => {
    const affected = entries.filter(e => selected.has(e.id));
    setEntries(prev => prev.map(e => selected.has(e.id) ? { ...e, frequency: freq } : e));
    showToast(`Set frequency to ${FREQ_LABELS[freq]} for ${affected.length} entries`, 'success');
    flashRows(affected.map(e => e.id));
    setSelected(new Set());
  };

  const bulkSetStatus = (status: Status) => {
    const affected = entries.filter(e => selected.has(e.id));
    const updated = affected.map(e => ({ ...e, status }));
    setEntries(prev => prev.map(e => selected.has(e.id) ? { ...e, status } : e));
    showToast(`Set status to ${status.replace('_', ' ')} for ${affected.length} entries`, 'success');
    syncEntriesToVisits(updated);
    flashRows(affected.map(e => e.id));
    setSelected(new Set());
  };

  const bulkSetDate = (date: string) => {
    const affected = entries.filter(e => selected.has(e.id));
    const updated = affected.map(e => ({ ...e, nextDate: date }));
    setEntries(prev => prev.map(e => selected.has(e.id) ? { ...e, nextDate: date } : e));
    showToast(`Set date to ${formatDate(date)} for ${affected.length} entries`, 'success');
    syncEntriesToVisits(updated);
    flashRows(affected.map(e => e.id));
    setSelected(new Set());
  };

  const bulkSetRating = (rating: Rating) => {
    const affected = entries.filter(e => selected.has(e.id));
    setEntries(prev => prev.map(e => selected.has(e.id) ? { ...e, rating } : e));
    showToast(`Set rating to ${RATING_LABELS[rating]} for ${affected.length} entries`, 'success');
    flashRows(affected.map(e => e.id));
    setSelected(new Set());
  };

  const bulkCancel = () => {
    const affected = entries.filter(e => selected.has(e.id));
    const updatedEntries: Entry[] = [];
    setEntries(prev => prev.map(e => {
      if (!selected.has(e.id)) return e;
      const rule = autoRules.find(r => r.enabled && r.waterway === e.river);
      let updated: Entry;
      if (rule) {
        const newAssignee = e.assigneeId === rule.primaryWorker ? rule.backupWorker : rule.primaryWorker;
        updated = { ...e, status: 'planned' as Status, assigneeId: newAssignee };
      } else {
        updated = { ...e, status: 'cancelled' as Status };
      }
      updatedEntries.push(updated);
      return updated;
    }));
    for (const e of affected.slice(0, 20)) {
      const oldWorker = e.assigneeId;
      const rule = autoRules.find(r => r.enabled && r.waterway === e.river);
      if (rule) {
        const newAssignee = e.assigneeId === rule.primaryWorker ? rule.backupWorker : rule.primaryWorker;
        const newName = workerName(newAssignee);
        if (oldWorker) {
          pushNotification({ type: 'cancelled', workerId: oldWorker, workerName: workerName(oldWorker), entryId: e.id, locationName: e.locationName, measurement: e.measurement, message: `${workerName(oldWorker)}: ${e.measurement} at ${e.locationName} reassigned to ${newName}` });
        }
        pushNotification({ type: 'assigned', workerId: newAssignee, workerName: newName, entryId: e.id, locationName: e.locationName, measurement: e.measurement, message: `${newName}: assigned ${e.measurement} at ${e.locationName} (reassignment)` });
      } else if (oldWorker) {
        pushNotification({ type: 'cancelled', workerId: oldWorker, workerName: workerName(oldWorker), entryId: e.id, locationName: e.locationName, measurement: e.measurement, message: `${workerName(oldWorker)}: ${e.measurement} at ${e.locationName} cancelled` });
      }
    }
    syncEntriesToVisits(updatedEntries);
    showToast(`Cancelled & reassigned ${affected.length} entries`, 'warning');
    flashRows(affected.map(e => e.id));
    setSelected(new Set());
  };

  const assignAllVisible = (workerId: string) => {
    const wName = workerName(workerId);
    const visibleIds = new Set(filtered.map(e => e.id));
    const updated = filtered.map(e => ({ ...e, assigneeId: workerId }));
    setEntries(prev => prev.map(e => visibleIds.has(e.id) ? { ...e, assigneeId: workerId } : e));
    if (workerId) {
      pushNotification({ type: 'assigned', workerId, workerName: wName, entryId: '', locationName: '', measurement: '', message: `${wName}: assigned ${updated.length} visible entries` });
      showToast(`Assigned ${updated.length} visible entries to ${wName}`, 'success');
    }
    syncEntriesToVisits(updated);
    flashRows(visibleIds);
  };

  const autoAssignByRules = () => {
    let assignCount = 0;
    const assignedWorkers = new Set<string>();
    const assignedIds: string[] = [];
    const updatedEntries: Entry[] = [];
    setEntries(prev => prev.map(e => {
      if (e.assigneeId) return e;
      const rule = autoRules.find(r => r.enabled && r.waterway === e.river);
      if (rule) {
        assignCount++;
        assignedWorkers.add(rule.primaryWorker);
        assignedIds.push(e.id);
        const updated = { ...e, assigneeId: rule.primaryWorker };
        updatedEntries.push(updated);
        return updated;
      }
      return e;
    }));
    for (const wid of assignedWorkers) {
      pushNotification({ type: 'assigned', workerId: wid, workerName: workerName(wid), entryId: '', locationName: '', measurement: '', message: `${workerName(wid)}: auto-assigned entries by rules` });
    }
    if (assignCount > 0) {
      syncEntriesToVisits(updatedEntries);
      showToast(`Auto-assigned ${assignCount} entries to ${assignedWorkers.size} workers`, 'success');
      flashRows(assignedIds);
    } else {
      showToast('No unassigned entries matched any rules', 'info');
    }
  };

  const inlineAssign = (entryId: string, workerId: string) => {
    const entry = entries.find(e => e.id === entryId);
    const oldWorker = entry?.assigneeId;
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, assigneeId: workerId } : e));
    if (entry) {
      const updated = { ...entry, assigneeId: workerId };
      if (workerId) {
        const wName = workerName(workerId);
        pushNotification({ type: 'assigned', workerId, workerName: wName, entryId, locationName: entry.locationName, measurement: entry.measurement, message: `${wName}: assigned ${entry.measurement} at ${entry.locationName}` });
        showToast(`Assigned to ${wName}`, 'success');
      } else {
        showToast('Unassigned entry', 'info');
      }
      if (oldWorker && oldWorker !== workerId) {
        pushNotification({ type: 'cancelled', workerId: oldWorker, workerName: workerName(oldWorker), entryId, locationName: entry.locationName, measurement: entry.measurement, message: `${workerName(oldWorker)}: unassigned from ${entry.measurement} at ${entry.locationName}` });
      }
      syncEntriesToVisits([updated]);
      flashRows([entryId]);
    }
  };

  // Stats
  const unassignedCount = entries.filter(e => !e.assigneeId).length;
  const totalCost = entries.reduce((s, e) => s + e.cost, 0);
  const filteredLocations = useMemo(() => new Set(filtered.map(e => e.locationId)).size, [filtered]);

  // Worker workload stats
  const workerStats = useMemo(() => {
    const map = new Map<string, { count: number; cost: number; rivers: Set<string> }>();
    for (const w of WORKERS) {
      if (w.id) map.set(w.id, { count: 0, cost: 0, rivers: new Set() });
    }
    for (const e of entries) {
      if (e.assigneeId && map.has(e.assigneeId)) {
        const s = map.get(e.assigneeId)!;
        s.count++;
        s.cost += e.cost;
        s.rivers.add(e.river);
      }
    }
    return map;
  }, [entries]);

  // --- Date navigation ---
  const navigateDate = (dir: number) => {
    if (viewMode === 'day') {
      setSelectedDate(addDays(selectedDate, dir));
    } else if (viewMode === 'week') {
      setSelectedDate(addDays(selectedDate, dir * 7));
    } else if (viewMode === 'month') {
      const dt = new Date(selectedDate + 'T00:00:00');
      dt.setMonth(dt.getMonth() + dir);
      setSelectedDate(dateStr(dt));
    } else if (viewMode === 'year') {
      const dt = new Date(selectedDate + 'T00:00:00');
      dt.setFullYear(dt.getFullYear() + dir);
      setSelectedDate(dateStr(dt));
    }
  };

  const goToToday = () => setSelectedDate(dateStr(new Date()));

  const navigateToDay = useCallback((d: string) => {
    setSelectedDate(d);
    setViewMode('day');
  }, []);

  const navigateToMonth = useCallback((year: number, month: number) => {
    setSelectedDate(`${year}-${String(month + 1).padStart(2, '0')}-01`);
    setViewMode('month');
  }, []);

  const dateLabel = useMemo(() => {
    const dt = new Date(selectedDate + 'T00:00:00');
    if (viewMode === 'day') return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (viewMode === 'week') {
      const ws = getWeekStart(selectedDate);
      const we = addDays(ws, 6);
      return `${formatDate(ws)} – ${formatDate(we)}, ${dt.getFullYear()}`;
    }
    if (viewMode === 'month') return `${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`;
    return `${dt.getFullYear()}`;
  }, [viewMode, selectedDate]);

  // Emergency handlers
  const handleEmergencyDeploy = useCallback((newEntries: Entry[], event: EmergencyEvent) => {
    setEntries(prev => [...prev, ...newEntries]);
    setEmergencyEvents(prev => [...prev, event]);
    // Notify all assigned workers
    const workerIds = new Set(newEntries.map(e => e.assigneeId).filter(Boolean));
    for (const wid of workerIds) {
      const wEntries = newEntries.filter(e => e.assigneeId === wid);
      pushNotification({ type: 'emergency', workerId: wid, workerName: workerName(wid), entryId: '', locationName: event.affectedWaterways.join(', '), measurement: '', message: `EMERGENCY: ${workerName(wid)} deployed to ${event.title} (${wEntries.length} measurements)` });
    }
  }, [pushNotification]);

  const handleUpdateEventStatus = useCallback((eventId: string, status: EmergencyEvent['status']) => {
    setEmergencyEvents(prev => prev.map(e => e.id === eventId ? { ...e, status } : e));
  }, []);

  // Add entry modal
  const [showAddEntry, setShowAddEntry] = useState(false);

  const handleAddEntry = useCallback((entry: Entry) => {
    setEntries(prev => [...prev, entry]);
    setShowAddEntry(false);
    // Notify assigned worker
    if (entry.assigneeId) {
      pushNotification({ type: 'added', workerId: entry.assigneeId, workerName: workerName(entry.assigneeId), entryId: entry.id, locationName: entry.locationName, measurement: entry.measurement, message: `${workerName(entry.assigneeId)}: new ${entry.measurement} at ${entry.locationName} on ${entry.nextDate}` });
    }
  }, [pushNotification]);

  const isCalendarView = viewMode !== 'table';
  const VIEW_MODES: { key: ViewMode; label: string; icon?: 'list' | 'cal' }[] = [
    { key: 'table', label: 'Table', icon: 'list' },
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
  ];
  const activeEmergencyCount = emergencyEvents.filter(e => e.status === 'active').length;

  return (
    <>
      <style>{CSS}</style>
      <div className="plb">
        {/* Top bar - row 1: title + stats */}
        <div className="plb-top">
          <div className="plb-top-left">
            <span className="plb-title">Plan Builder</span>
            <span className="plb-badge-active">Active</span>
            <span className="plb-count">{filteredLocations.toLocaleString()} locations · {filtered.length.toLocaleString()} entries</span>
            {unassignedCount > 0 && <span className="plb-badge-warn">{unassignedCount} unassigned</span>}
            <span className="plb-cost">€{totalCost.toLocaleString()}</span>
          </div>
          <div className="plb-top-right">
            <NotificationPanel
              notifications={notifications}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllNotificationsRead}
              onClear={clearNotifications}
            />
            <button className="plb-btn plb-btn-emergency" onClick={() => setShowEmergencyPanel(true)}>
              <AlertTriangle size={12} />
              Emergency
              {activeEmergencyCount > 0 && <span className="plb-emergency-count">{activeEmergencyCount}</span>}
            </button>
            <button className="plb-btn plb-btn-primary" onClick={() => setShowAddEntry(true)}>+ Add entry</button>
          </div>
        </div>

        {/* Toolbar - row 2: view toggle + date nav + actions */}
        <div className="plb-toolbar">
          <div className="plb-view-toggle">
            {VIEW_MODES.map(vm => (
              <button
                key={vm.key}
                className={`plb-view-btn${viewMode === vm.key ? ' plb-view-active' : ''}`}
                onClick={() => setViewMode(vm.key)}
              >
                {vm.icon === 'list' && <List size={12} />}
                {vm.icon === 'cal' && <Calendar size={12} />}
                {vm.label}
              </button>
            ))}
          </div>
          {isCalendarView && (
            <div className="plb-datenav">
              <button className="plb-datenav-arrow" onClick={() => navigateDate(-1)}><ChevronLeft size={14} /></button>
              <span className="plb-datenav-label">{dateLabel}</span>
              <button className="plb-datenav-arrow" onClick={() => navigateDate(1)}><ChevronRight size={14} /></button>
              <button className="plb-datenav-today" onClick={goToToday}>
                {viewMode === 'week' ? 'This week' : 'Today'}
              </button>
            </div>
          )}
          <div className="plb-toolbar-right">
            <button className="plb-btn" onClick={() => setShowWorkerPanel(!showWorkerPanel)}>
              {showWorkerPanel ? 'Hide' : 'Show'} workload
            </button>
            <button className="plb-btn" onClick={() => setShowRules(!showRules)}>Rules</button>
            <button className="plb-btn">Export</button>
          </div>
        </div>

        {/* Add entry modal */}
        {showAddEntry && (
          <AddEntryModal
            entries={entries}
            defaultDate={selectedDate}
            onAdd={handleAddEntry}
            onClose={() => setShowAddEntry(false)}
          />
        )}

        {/* Filters bar (table view) */}
        {viewMode === 'table' && (
          <div className="plb-filters">
            <input className="plb-search" placeholder="Search locations, measurements, workers..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="plb-filter" value={filterProgram} onChange={e => setFilterProgram(e.target.value as Program | '')}>
              <option value="">All programs</option>
              {PROGRAMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <select className="plb-filter" value={filterRiver} onChange={e => setFilterRiver(e.target.value)}>
              <option value="">All waterways ({WATERWAYS.length})</option>
              {WATERWAYS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="plb-filter" value={filterRating} onChange={e => setFilterRating(e.target.value as Rating | '')}>
              <option value="">All ratings</option>
              {RATINGS.map(r => <option key={r} value={r}>{RATING_LABELS[r]}</option>)}
            </select>
            <select className="plb-filter" value={filterMeas} onChange={e => setFilterMeas(e.target.value)}>
              <option value="">All measurements</option>
              {MEASUREMENTS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
            <select className="plb-filter" value={filterWorker} onChange={e => setFilterWorker(e.target.value)}>
              <option value="">All workers</option>
              <option value="__unassigned">Unassigned only</option>
              {WORKERS.filter(w => w.id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select className="plb-filter" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
            </select>
            {(search || filterRating || filterMeas || filterWorker || filterStatus || filterRiver || filterProgram) && (
              <button className="plb-clear" onClick={() => { setSearch(''); setFilterRating(''); setFilterMeas(''); setFilterWorker(''); setFilterStatus(''); setFilterRiver(''); setFilterProgram(''); }}>
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Bulk action bar (table view) */}
        {viewMode === 'table' && someSelected && (
          <div className="plb-bulk">
            <span className="plb-bulk-count">{selected.size} selected</span>
            <select className="plb-bulk-select" defaultValue="" onChange={e => { if (e.target.value) { bulkAssign(e.target.value); e.target.value = ''; } }}>
              <option value="" disabled>Assignee...</option>
              {WORKERS.filter(w => w.id).map(w => <option key={w.id} value={w.id}>{w.name} ({w.region})</option>)}
              <option value="">Unassign all</option>
            </select>
            <select className="plb-bulk-select" defaultValue="" onChange={e => { if (e.target.value) { bulkSetStatus(e.target.value as Status); e.target.value = ''; } }}>
              <option value="" disabled>Status...</option>
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="plb-bulk-select" defaultValue="" onChange={e => { if (e.target.value) { bulkSetFreq(e.target.value as Freq); e.target.value = ''; } }}>
              <option value="" disabled>Frequency...</option>
              {FREQS.map(f => <option key={f} value={f}>{FREQ_LABELS[f]}</option>)}
            </select>
            <select className="plb-bulk-select" defaultValue="" onChange={e => { if (e.target.value) { bulkSetRating(e.target.value as Rating); e.target.value = ''; } }}>
              <option value="" disabled>Rating...</option>
              {RATINGS.map(r => <option key={r} value={r}>{RATING_LABELS[r]}</option>)}
            </select>
            <input className="plb-bulk-date" type="date" onChange={e => { if (e.target.value) { bulkSetDate(e.target.value); e.target.value = ''; } }} />
            <button className="plb-bulk-btn plb-bulk-btn-warn" onClick={bulkCancel}>
              Cancel &amp; reassign
            </button>
            <button className="plb-bulk-clear" onClick={() => setSelected(new Set())}>Deselect all</button>
          </div>
        )}

        {/* Quick assign bar (table view, nothing selected) */}
        {viewMode === 'table' && !someSelected && unassignedCount > 0 && (
          <div className="plb-quick-assign">
            <span className="plb-qa-label">{unassignedCount} unassigned entries</span>
            <button className="plb-qa-btn" onClick={autoAssignByRules}>Auto-assign all by rules</button>
            <select className="plb-bulk-select" defaultValue="" onChange={e => { if (e.target.value) assignAllVisible(e.target.value); e.target.value = ''; }}>
              <option value="" disabled>Assign all visible to...</option>
              {WORKERS.filter(w => w.id).map(w => <option key={w.id} value={w.id}>{w.name} ({w.region})</option>)}
            </select>
          </div>
        )}

        {/* Worker workload panel */}
        {showWorkerPanel && (
          <div className="plb-workers">
            {WORKERS.filter(w => w.id).map(w => {
              const stats = workerStats.get(w.id);
              const pct = stats ? Math.round((stats.count / entries.length) * 100) : 0;
              return (
                <div key={w.id} className="plb-worker-card" onClick={() => { setFilterWorker(w.id); setShowWorkerPanel(false); }}>
                  <div className="plb-worker-top">
                    <span className="plb-worker-name">{w.name}</span>
                    <span className="plb-worker-region">{w.region}</span>
                  </div>
                  <div className="plb-worker-stats">
                    <span>{stats?.count ?? 0} entries</span>
                    <span>€{(stats?.cost ?? 0).toLocaleString()}</span>
                    <span>{stats?.rivers.size ?? 0} waterways</span>
                  </div>
                  <div className="plb-worker-bar"><div className="plb-worker-fill" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}

        {/* Auto-assign rules drawer */}
        {showRules && (
          <div className="plb-rules">
            <div className="plb-rules-hdr">
              <span className="plb-rules-title">Auto-assignment rules</span>
              <span className="plb-rules-desc">When a visit is cancelled or rescheduled, entries are automatically reassigned to the backup worker.</span>
            </div>
            <div className="plb-rules-list">
              {autoRules.map(rule => (
                <div key={rule.id} className={`plb-rule${rule.enabled ? '' : ' plb-rule-disabled'}`}>
                  <label className="plb-rule-toggle">
                    <input type="checkbox" checked={rule.enabled} onChange={() => setAutoRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))} />
                  </label>
                  <span className="plb-rule-waterway">{rule.waterway}</span>
                  <span className="plb-rule-arrow">Primary:</span>
                  <select className="plb-rule-select" value={rule.primaryWorker} onChange={e => setAutoRules(prev => prev.map(r => r.id === rule.id ? { ...r, primaryWorker: e.target.value } : r))}>
                    {WORKERS.filter(w => w.id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <span className="plb-rule-arrow">Backup:</span>
                  <select className="plb-rule-select" value={rule.backupWorker} onChange={e => setAutoRules(prev => prev.map(r => r.id === rule.id ? { ...r, backupWorker: e.target.value } : r))}>
                    {WORKERS.filter(w => w.id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button className="plb-rules-add" onClick={() => setAutoRules(prev => [...prev, { id: `ar${Date.now()}`, waterway: WATERWAYS[0], region: '', primaryWorker: 'w1', backupWorker: 'w2', enabled: true }])}>
              + Add rule
            </button>
          </div>
        )}

        {/* Table view (preserved exactly) */}
        {viewMode === 'table' && (
          <>
            <div className="plb-thead">
              <div className="plb-th plb-th-check">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </div>
              <div className="plb-th plb-th-loc" onClick={() => handleSort('location')}>Location{sortArrow('location')}</div>
              <div className="plb-th plb-th-rating" onClick={() => handleSort('rating')}>Rating{sortArrow('rating')}</div>
              <div className="plb-th plb-th-meas" onClick={() => handleSort('measurement')}>Measurement{sortArrow('measurement')}</div>
              <div className="plb-th plb-th-freq">Freq</div>
              <div className="plb-th plb-th-assignee" onClick={() => handleSort('assignee')}>Assignee{sortArrow('assignee')}</div>
              <div className="plb-th plb-th-status" onClick={() => handleSort('status')}>Status{sortArrow('status')}</div>
              <div className="plb-th plb-th-date" onClick={() => handleSort('date')}>Next date{sortArrow('date')}</div>
              <div className="plb-th plb-th-cost">Cost</div>
            </div>

            <div className="plb-body" ref={scrollRef} onScroll={handleScroll}>
              <div style={{ height: totalHeight, position: 'relative' }}>
                {visibleEntries.map((entry, vi) => {
                  const realIdx = startIdx + vi;
                  const isSelected = selected.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      className={`plb-row${isSelected ? ' plb-row-selected' : ''}${flashIds.has(entry.id) ? ' plb-row-flash' : ''}`}
                      style={{ position: 'absolute', top: realIdx * ROW_HEIGHT, height: ROW_HEIGHT }}
                      onClick={(e) => toggleOne(entry.id, realIdx, e.shiftKey)}
                    >
                      <div className="plb-td plb-th-check">
                        <input type="checkbox" checked={isSelected} readOnly />
                      </div>
                      <div className="plb-td plb-th-loc">
                        <div className="plb-loc-name">{entry.locationName}</div>
                        <div className="plb-loc-code">{entry.locationCode}</div>
                      </div>
                      <div className="plb-td plb-th-rating">
                        <span className="plb-rating-tag" style={{ background: RATING_COLORS[entry.rating] }}>
                          {RATING_LABELS[entry.rating]}
                        </span>
                      </div>
                      <div className="plb-td plb-th-meas">
                        <span className="plb-meas-dot" style={{ background: MEAS_ICONS[entry.measurement]?.color || '#999' }} />
                        {entry.measurement}
                      </div>
                      <div className="plb-td plb-th-freq">{FREQ_LABELS[entry.frequency]}</div>
                      <div className="plb-td plb-th-assignee" onClick={e => e.stopPropagation()}>
                        <select
                          className={`plb-inline-assign${!entry.assigneeId ? ' plb-unassigned' : ''}`}
                          value={entry.assigneeId}
                          onChange={e => inlineAssign(entry.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {WORKERS.filter(w => w.id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </div>
                      <div className="plb-td plb-th-status">
                        <span className="plb-status-dot" style={{ background: STATUS_COLORS[entry.status] }} />
                        <span className="plb-status-label">{entry.status.replace('_', ' ')}</span>
                      </div>
                      <div className="plb-td plb-th-date">{formatDate(entry.nextDate)}</div>
                      <div className="plb-td plb-th-cost">€{entry.cost}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Calendar views */}
        {isCalendarView && (
          <PlanCalendar
            viewMode={viewMode}
            selectedDate={selectedDate}
            entriesByDate={entriesByDate}
            entries={entries}
            onNavigateToDay={navigateToDay}
            onNavigateToMonth={navigateToMonth}
            onReassign={inlineAssign}
          />
        )}

        {/* Emergency panel */}
        {showEmergencyPanel && (
          <EmergencyPanel
            entries={entries}
            emergencyEvents={emergencyEvents}
            selectedDate={selectedDate}
            onClose={() => setShowEmergencyPanel(false)}
            onDeploy={handleEmergencyDeploy}
            onUpdateEventStatus={handleUpdateEventStatus}
          />
        )}

        {/* Toast notification */}
        {toast && (
          <div className={`plb-toast plb-toast-${toast.type}`}>
            <span className="plb-toast-icon">
              {toast.type === 'success' ? '✓' : toast.type === 'warning' ? '!' : 'i'}
            </span>
            <span className="plb-toast-msg">{toast.message}</span>
            <button className="plb-toast-close" onClick={() => setToast(null)}>&times;</button>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
.plb{font-family:var(--font-sans);display:flex;flex-direction:column;height:calc(100vh - 64px);background:var(--color-background-primary);overflow:hidden}

/* Top bar */
.plb-top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:0.5px solid var(--color-border-tertiary);flex-shrink:0;flex-wrap:wrap;gap:8px}
.plb-top-left,.plb-top-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.plb-title{font-size:16px;font-weight:600;color:var(--color-text-primary)}
.plb-badge-active{font-size:10px;padding:2px 8px;border-radius:var(--border-radius-md);background:#EFF6E8;color:#639922;font-weight:500}
.plb-badge-warn{font-size:10px;padding:2px 8px;border-radius:var(--border-radius-md);background:#FCEBEB;color:#E24B4A;font-weight:500}
.plb-count{font-size:12px;color:var(--color-text-secondary)}
.plb-cost{font-size:12px;color:var(--color-text-secondary);font-weight:500}
.plb-btn{font-size:11px;padding:5px 12px;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:transparent;color:var(--color-text-primary);cursor:pointer;font-family:var(--font-sans);display:flex;align-items:center;gap:4px}
.plb-btn:hover{background:var(--color-background-secondary)}
.plb-btn-primary{background:#378ADD;color:white;border-color:transparent}
.plb-btn-primary:hover{background:#2a7acc;color:white}

/* Emergency button */
.plb-btn-emergency{border-color:#E24B4A44;color:#E24B4A;font-weight:500}
.plb-btn-emergency:hover{background:#FCEBEB}
.plb-emergency-count{font-size:9px;background:#E24B4A;color:white;padding:0 5px;border-radius:8px;font-weight:600;line-height:16px}

/* Toolbar row */
.plb-toolbar{display:flex;align-items:center;gap:10px;padding:6px 16px;border-bottom:0.5px solid var(--color-border-tertiary);flex-shrink:0;flex-wrap:wrap}
.plb-toolbar-right{display:flex;align-items:center;gap:6px;margin-left:auto}

/* Add entry inline form */
.plb-add-entry{display:flex;align-items:center;gap:6px;padding:8px 16px;background:#EBF3FB;border-bottom:0.5px solid #378ADD44;flex-shrink:0;flex-wrap:wrap}

/* View mode toggle */
.plb-view-toggle{display:flex;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);overflow:hidden}
.plb-view-btn{padding:4px 10px;font-size:10px;font-family:var(--font-sans);border:none;background:var(--color-background-primary);color:var(--color-text-secondary);cursor:pointer;display:flex;align-items:center;gap:3px;border-right:0.5px solid var(--color-border-tertiary);white-space:nowrap}
.plb-view-btn:last-child{border-right:none}
.plb-view-btn:hover{background:var(--color-background-secondary)}
.plb-view-active{background:#EBF3FB;color:#378ADD;font-weight:600}

/* Date navigation (inline in toolbar) */
.plb-datenav{display:flex;align-items:center;gap:6px}
.plb-datenav-arrow{background:none;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);cursor:pointer;padding:2px 5px;display:flex;align-items:center;color:var(--color-text-secondary)}
.plb-datenav-arrow:hover{background:var(--color-background-secondary);color:var(--color-text-primary)}
.plb-datenav-label{font-size:12px;font-weight:600;color:var(--color-text-primary);min-width:160px;text-align:center}
.plb-datenav-today{font-size:10px;padding:3px 8px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);background:var(--color-background-primary);color:var(--color-text-primary);cursor:pointer;font-family:var(--font-sans)}
.plb-datenav-today:hover{background:var(--color-background-secondary)}

/* Filters */
.plb-filters{display:flex;align-items:center;gap:6px;padding:8px 16px;border-bottom:0.5px solid var(--color-border-tertiary);flex-shrink:0;overflow-x:auto;flex-wrap:wrap}
.plb-search{padding:6px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:12px;color:var(--color-text-primary);background:var(--color-background-secondary);font-family:var(--font-sans);outline:none;min-width:220px;flex:1;box-sizing:border-box}
.plb-search:focus{border-color:var(--color-border-info)}
.plb-filter{padding:6px 8px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:11px;color:var(--color-text-primary);background:var(--color-background-primary);font-family:var(--font-sans);outline:none;cursor:pointer}
.plb-filter:focus{border-color:var(--color-border-info)}
.plb-clear{font-size:11px;color:#E24B4A;background:none;border:none;cursor:pointer;font-family:var(--font-sans);font-weight:500;white-space:nowrap}
.plb-clear:hover{text-decoration:underline}

/* Bulk action bar */
.plb-bulk{display:flex;align-items:center;gap:10px;padding:8px 16px;background:#EBF3FB;border-bottom:0.5px solid #378ADD44;flex-shrink:0;flex-wrap:wrap}
.plb-bulk-count{font-size:12px;font-weight:600;color:#378ADD}
.plb-bulk-select{padding:5px 8px;border:0.5px solid #378ADD44;border-radius:var(--border-radius-md);font-size:11px;color:var(--color-text-primary);background:white;font-family:var(--font-sans);cursor:pointer;outline:none}
.plb-bulk-clear{font-size:11px;color:var(--color-text-secondary);background:none;border:none;cursor:pointer;font-family:var(--font-sans);margin-left:auto}
.plb-bulk-clear:hover{color:var(--color-text-primary)}
.plb-bulk-date{padding:4px 6px;border:0.5px solid #378ADD44;border-radius:var(--border-radius-md);font-size:11px;color:var(--color-text-primary);background:white;font-family:var(--font-sans);cursor:pointer;outline:none}

/* Table header */
.plb-thead{display:flex;align-items:center;padding:0 16px;border-bottom:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary);flex-shrink:0;height:34px}
.plb-th{font-size:11px;font-weight:500;color:var(--color-text-secondary);cursor:pointer;user-select:none;padding:0 6px;white-space:nowrap;display:flex;align-items:center}
.plb-th:hover{color:var(--color-text-primary)}

/* Column widths */
.plb-th-check{width:32px;flex-shrink:0;cursor:default;justify-content:center}
.plb-th-loc{flex:2;min-width:180px}
.plb-th-rating{width:80px;flex-shrink:0}
.plb-th-meas{flex:1.2;min-width:120px}
.plb-th-freq{width:60px;flex-shrink:0;cursor:default}
.plb-th-assignee{flex:1.5;min-width:150px}
.plb-th-status{width:100px;flex-shrink:0}
.plb-th-date{width:80px;flex-shrink:0}
.plb-th-cost{width:60px;flex-shrink:0;cursor:default}

/* Scrolling body */
.plb-body{flex:1;overflow-y:auto;overflow-x:hidden;position:relative}

/* Table rows */
.plb-row{display:flex;align-items:center;padding:0 16px;border-bottom:0.5px solid var(--color-border-tertiary);cursor:pointer;transition:background .1s;width:100%;box-sizing:border-box}
.plb-row:hover{background:var(--color-background-secondary)}
.plb-row-selected{background:#EBF3FB !important}
.plb-td{font-size:12px;color:var(--color-text-primary);padding:0 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;height:100%}

/* Location cell */
.plb-loc-name{font-weight:500;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.plb-loc-code{font-size:10px;color:var(--color-text-tertiary);margin-top:1px}
.plb-th-loc .plb-td-inner{display:flex;flex-direction:column}

/* Measurement dot */
.plb-meas-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-right:6px;display:inline-block}

/* Rating tag */
.plb-rating-tag{font-size:9px;padding:1px 6px;border-radius:3px;color:white;font-weight:500;white-space:nowrap}

/* Inline assign dropdown */
.plb-inline-assign{padding:3px 4px;border:0.5px solid var(--color-border-tertiary);border-radius:4px;font-size:11px;color:var(--color-text-primary);background:transparent;font-family:var(--font-sans);cursor:pointer;outline:none;width:100%;max-width:140px}
.plb-inline-assign:focus{border-color:#378ADD}
.plb-unassigned{color:#E24B4A;border-color:#E24B4A44;background:#FCEBEB}

/* Status */
.plb-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-right:4px}
.plb-status-label{font-size:11px;text-transform:capitalize}

/* Checkbox */
.plb-th-check input[type=checkbox]{width:14px;height:14px;cursor:pointer;accent-color:#378ADD}

/* Quick assign bar */
.plb-quick-assign{display:flex;align-items:center;gap:10px;padding:6px 16px;background:#FDF3E3;border-bottom:0.5px solid #BA751744;flex-shrink:0;flex-wrap:wrap}
.plb-qa-label{font-size:12px;font-weight:500;color:#BA7517}
.plb-qa-btn{font-size:11px;padding:4px 12px;border:0.5px solid #BA7517;border-radius:var(--border-radius-md);background:#BA7517;color:white;cursor:pointer;font-family:var(--font-sans);font-weight:500}
.plb-qa-btn:hover{opacity:0.9}

/* Bulk cancel button */
.plb-bulk-btn{font-size:11px;padding:4px 12px;border-radius:var(--border-radius-md);cursor:pointer;font-family:var(--font-sans);font-weight:500;border:none}
.plb-bulk-btn-warn{background:#BA7517;color:white}
.plb-bulk-btn-warn:hover{opacity:0.9}

/* Worker workload panel */
.plb-workers{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;padding:10px 16px;border-bottom:0.5px solid var(--color-border-tertiary);background:var(--color-background-secondary);flex-shrink:0;max-height:180px;overflow-y:auto}
.plb-worker-card{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:8px 10px;cursor:pointer;transition:all .15s}
.plb-worker-card:hover{border-color:var(--color-border-info);background:var(--color-background-info)}
.plb-worker-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.plb-worker-name{font-size:12px;font-weight:500;color:var(--color-text-primary)}
.plb-worker-region{font-size:9px;color:var(--color-text-tertiary);background:var(--color-background-secondary);padding:1px 5px;border-radius:3px}
.plb-worker-stats{display:flex;gap:8px;font-size:10px;color:var(--color-text-secondary);margin-bottom:4px}
.plb-worker-bar{height:4px;border-radius:2px;background:var(--color-border-tertiary);overflow:hidden}
.plb-worker-fill{height:100%;border-radius:2px;background:#378ADD;transition:width .3s}

/* Auto-assign rules */
.plb-rules{padding:12px 16px;border-bottom:0.5px solid var(--color-border-tertiary);background:var(--color-background-primary);flex-shrink:0;max-height:280px;overflow-y:auto}
.plb-rules-hdr{margin-bottom:10px}
.plb-rules-title{font-size:13px;font-weight:600;color:var(--color-text-primary);display:block;margin-bottom:2px}
.plb-rules-desc{font-size:11px;color:var(--color-text-secondary)}
.plb-rules-list{display:flex;flex-direction:column;gap:6px}
.plb-rule{display:flex;align-items:center;gap:8px;padding:6px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:11px;flex-wrap:wrap}
.plb-rule-disabled{opacity:0.45}
.plb-rule-toggle input{width:14px;height:14px;accent-color:#378ADD;cursor:pointer}
.plb-rule-waterway{font-weight:500;color:var(--color-text-primary);min-width:80px}
.plb-rule-arrow{color:var(--color-text-tertiary);font-size:10px}
.plb-rule-select{padding:2px 4px;border:0.5px solid var(--color-border-tertiary);border-radius:4px;font-size:11px;font-family:var(--font-sans);outline:none;background:var(--color-background-secondary);color:var(--color-text-primary);cursor:pointer}
.plb-rules-add{margin-top:8px;font-size:11px;color:#378ADD;background:none;border:none;cursor:pointer;font-family:var(--font-sans);font-weight:500;padding:0}
.plb-rules-add:hover{text-decoration:underline}

/* Mobile */
@media(max-width:768px){
  .plb-th-rating,.plb-th-freq,.plb-th-cost,.plb-th-date{display:none}
  .plb-td.plb-th-rating,.plb-td.plb-th-freq,.plb-td.plb-th-cost,.plb-td.plb-th-date{display:none}
  .plb-th-loc{min-width:120px}
  .plb-th-meas{min-width:80px}
  .plb-search{min-width:140px}
}
@media(max-width:480px){
  .plb-th-status{display:none}
  .plb-td.plb-th-status{display:none}
  .plb-top{padding:8px 10px}
  .plb-filters{padding:6px 10px}
  .plb-thead,.plb-row{padding:0 10px}
}

/* Toast */
.plb-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:var(--border-radius-md);font-size:13px;font-family:var(--font-sans);box-shadow:0 4px 16px rgba(0,0,0,.15);animation:plb-toast-in .3s ease;white-space:nowrap}
.plb-toast-success{background:#059669;color:white}
.plb-toast-warning{background:#BA7517;color:white}
.plb-toast-info{background:#378ADD;color:white}
.plb-toast-icon{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.plb-toast-msg{font-weight:500}
.plb-toast-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:16px;cursor:pointer;padding:0 0 0 4px;line-height:1}
.plb-toast-close:hover{color:white}

/* Row flash */
.plb-row-flash{animation:plb-flash 1.5s ease}
@keyframes plb-flash{0%{background:#D1FAE5}30%{background:#D1FAE5}100%{background:transparent}}
@keyframes plb-toast-in{0%{opacity:0;transform:translateX(-50%) translateY(12px)}100%{opacity:1;transform:translateX(-50%) translateY(0)}}
`;
