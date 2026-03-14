import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import type {
  User, Location, MeasurementTemplate, MonitoringPlan, PlanEntry,
  Visit, Measurement, Notification, BudgetTracking, DashboardStats,
  ActivityItem,
} from '../types';
import * as mock from '../data/mockData';
import type { Entry } from '../pages/PlanBuilder/planData';
import type { HistoricalMeasurement } from '../db';
import { supabase } from '../db/supabase';
import { seedSupabaseDatabase } from '../db/seedSupabase';
import { db as localDb } from '../db';

// ── IndexedDB cache helpers ──

const CACHE_TS_KEY = 'ecoplanner_cache_ts';

async function loadFromCache() {
  const [users, locations, measurementTemplates, monitoringPlans, planEntries,
    visits, measurements, notifications, budgetTracking, dashboardStats,
    activityItems, monthlyBudgetData, planBuilderEntries] = await Promise.all([
    localDb.users.toArray(),
    localDb.locations.toArray(),
    localDb.measurementTemplates.toArray(),
    localDb.monitoringPlans.toArray(),
    localDb.planEntries.toArray(),
    localDb.visits.toArray(),
    localDb.measurements.toArray(),
    localDb.notifications.toArray(),
    localDb.budgetTracking.toArray(),
    localDb.dashboardStats.toArray(),
    localDb.activityItems.toArray(),
    localDb.monthlyBudgetData.toArray(),
    localDb.planBuilderEntries.toArray(),
  ]);
  return { users, locations, measurementTemplates, monitoringPlans, planEntries,
    visits, measurements, notifications, budgetTracking, dashboardStats,
    activityItems, monthlyBudgetData, planBuilderEntries };
}

async function writeToCache(data: {
  users: User[]; locations: Location[]; measurementTemplates: MeasurementTemplate[];
  monitoringPlans: MonitoringPlan[]; planEntries: PlanEntry[]; visits: Visit[];
  measurements: Measurement[]; notifications: Notification[]; budgetTracking: BudgetTracking[];
  dashboardStats: { id: string; activePlans: number; visitsThisMonth: number; pendingVisits: number; budgetUsed: number; totalBudget: number; anomalyCount: number }[];
  activityItems: { id: string; location_id: string; status: string; measurementType: string; assignee: string; time: string; hasAnomaly: boolean; pipelineStatus: string; lastPh?: number; phTrend?: string; phHistory?: number[] }[];
  monthlyBudgetData: { id: string; month: string; analysis: number; logistics: number; target: number }[];
  planBuilderEntries: Entry[];
}) {
  await Promise.all([
    localDb.users.clear().then(() => localDb.users.bulkPut(data.users)),
    localDb.locations.clear().then(() => localDb.locations.bulkPut(data.locations)),
    localDb.measurementTemplates.clear().then(() => localDb.measurementTemplates.bulkPut(data.measurementTemplates)),
    localDb.monitoringPlans.clear().then(() => localDb.monitoringPlans.bulkPut(data.monitoringPlans)),
    localDb.planEntries.clear().then(() => localDb.planEntries.bulkPut(data.planEntries)),
    localDb.visits.clear().then(() => localDb.visits.bulkPut(data.visits)),
    localDb.measurements.clear().then(() => localDb.measurements.bulkPut(data.measurements)),
    localDb.notifications.clear().then(() => localDb.notifications.bulkPut(data.notifications)),
    localDb.budgetTracking.clear().then(() => localDb.budgetTracking.bulkPut(data.budgetTracking)),
    localDb.dashboardStats.clear().then(() => localDb.dashboardStats.bulkPut(data.dashboardStats as any)),
    localDb.activityItems.clear().then(() => localDb.activityItems.bulkPut(data.activityItems as any)),
    localDb.monthlyBudgetData.clear().then(() => localDb.monthlyBudgetData.bulkPut(data.monthlyBudgetData as any)),
    localDb.planBuilderEntries.clear().then(() => localDb.planBuilderEntries.bulkPut(data.planBuilderEntries)),
  ]);
  localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
}

// ── The single source of truth ──

export interface Database {
  // Loading state
  ready: boolean;

  // Core data
  users: User[];
  locations: Location[];
  measurementTemplates: MeasurementTemplate[];
  monitoringPlans: MonitoringPlan[];
  planEntries: PlanEntry[];
  visits: Visit[];
  measurements: Measurement[];
  notifications: Notification[];
  budgetTracking: BudgetTracking[];
  dashboardStats: DashboardStats;
  activityItems: ActivityItem[];
  monthlyBudgetData: typeof mock.monthlyBudgetData;

  // PlanBuilder entries
  planBuilderEntries: Entry[];

  // Mutation methods
  updateMeasurement: (id: string, updates: Partial<Measurement>) => void;
  addMeasurements: (items: Measurement[]) => void;
  addVisits: (items: Visit[]) => void;
  updateVisit: (id: string, updates: Partial<Visit>) => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
  addPlanBuilderEntries: (entries: Entry[]) => void;
  removePlanBuilderEntries: (ids: string[]) => void;
  removeMeasurements: (ids: string[]) => void;
  removeVisits: (ids: string[]) => void;

  // Historical data access
  getHistoricalMeasurements: (locationId: string) => Promise<HistoricalMeasurement[]>;
  getHistoricalByType: (locationId: string, measurementType: string) => Promise<HistoricalMeasurement[]>;
  getAllHistoricalMeasurements: () => Promise<Map<string, HistoricalMeasurement[]>>;

  // Helpers
  getRatingColor: typeof mock.getRatingColor;
  getRatingLabel: typeof mock.getRatingLabel;
  getPipelineLabel: typeof mock.getPipelineLabel;
  getPipelineStageIndex: typeof mock.getPipelineStageIndex;
  getStatusColor: typeof mock.getStatusColor;
}

const DatabaseContext = createContext<Database | null>(null);

// ── Supabase row → app type mappers ──

function toMeasurementTemplate(row: unknown): MeasurementTemplate {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    environment_type: r.environment_type as MeasurementTemplate['environment_type'],
    parameters: r.parameters as MeasurementTemplate['parameters'],
    unit_cost: Number(r.unit_cost),
    is_active: r.is_active as boolean,
  };
}

function toPlanBuilderEntry(row: Record<string, unknown>): Entry {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    locationName: row.location_name as string,
    locationCode: row.location_code as string,
    rating: row.rating as Entry['rating'],
    river: row.river as string,
    program: row.program as Entry['program'],
    waterBody: row.water_body as Entry['waterBody'],
    measurement: row.measurement as string,
    frequency: row.frequency as Entry['frequency'],
    assigneeId: (row.assignee_id as string) || '',
    status: row.status as Entry['status'],
    nextDate: row.next_date as string,
    cost: Number(row.cost),
  };
}

function toActivityItem(row: Record<string, unknown>, locMap: Map<string, Location>): ActivityItem {
  return {
    id: row.id as string,
    location: locMap.get(row.location_id as string) || ({} as Location),
    status: row.status as ActivityItem['status'],
    measurementType: row.measurement_type as string,
    assignee: row.assignee as string,
    time: row.time_label as string,
    hasAnomaly: row.has_anomaly as boolean,
    pipelineStatus: row.pipeline_status as ActivityItem['pipelineStatus'],
    lastPh: row.last_ph as number | undefined,
    phTrend: row.ph_trend as ActivityItem['phTrend'],
    phHistory: row.ph_history as number[] | undefined,
  };
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [measurementTemplates, setMeasurementTemplates] = useState<MeasurementTemplate[]>([]);
  const [monitoringPlans, setMonitoringPlans] = useState<MonitoringPlan[]>([]);
  const [planEntries, setPlanEntries] = useState<PlanEntry[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [budgetTracking, setBudgetTracking] = useState<BudgetTracking[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(mock.dashboardStats);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [monthlyBudgetData, setMonthlyBudgetData] = useState(mock.monthlyBudgetData);
  const [planBuilderEntries, setPlanBuilderEntries] = useState<Entry[]>([]);

  // Helper: apply Supabase response data to state
  const applySupabaseData = useCallback((
    dbUsers: unknown[] | null, dbLocations: unknown[] | null, dbTemplates: unknown[] | null,
    dbPlans: unknown[] | null, dbPlanEntries: unknown[] | null, dbVisits: unknown[] | null,
    dbMeasurements: unknown[] | null, dbNotifications: unknown[] | null, dbBudget: unknown[] | null,
    dbStats: unknown[] | null, dbActivity: unknown[] | null, dbMonthly: unknown[] | null,
    pbEntries: Entry[],
  ) => {
    setUsers((dbUsers || []) as User[]);
    const locs = (dbLocations || []) as Location[];
    setLocations(locs);
    setMeasurementTemplates((dbTemplates || []).map(toMeasurementTemplate));
    setMonitoringPlans((dbPlans || []) as MonitoringPlan[]);
    setPlanEntries((dbPlanEntries || []) as PlanEntry[]);
    setVisits((dbVisits || []) as Visit[]);
    setMeasurements((dbMeasurements || []) as Measurement[]);
    setNotifications((dbNotifications || []) as Notification[]);
    setBudgetTracking((dbBudget || []) as BudgetTracking[]);

    if (dbStats && (dbStats as any[]).length > 0) {
      const s = (dbStats as any[])[0];
      setDashboardStats({
        activePlans: s.active_plans,
        visitsThisMonth: s.visits_this_month,
        pendingVisits: s.pending_visits,
        budgetUsed: Number(s.budget_used),
        totalBudget: Number(s.total_budget),
        anomalyCount: s.anomaly_count,
      });
    }

    const locMap = new Map(locs.map(l => [l.id, l]));
    setActivityItems((dbActivity || []).map((a: any) => toActivityItem(a, locMap)));

    setMonthlyBudgetData(
      (dbMonthly || []).map((m: any) => ({
        month: m.month, analysis: Number(m.analysis), logistics: Number(m.logistics), target: Number(m.target),
      })) as typeof mock.monthlyBudgetData
    );

    setPlanBuilderEntries(pbEntries);
  }, []);

  // Load: cache-first, then background sync from Supabase
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Step 1: Load from IndexedDB cache instantly
      try {
        const cached = await loadFromCache();
        const hasCachedData = cached.locations.length > 0;

        if (hasCachedData && !cancelled) {
          const t0 = performance.now();
          setUsers(cached.users);
          setLocations(cached.locations);
          setMeasurementTemplates(cached.measurementTemplates as MeasurementTemplate[]);
          setMonitoringPlans(cached.monitoringPlans as MonitoringPlan[]);
          setPlanEntries(cached.planEntries as PlanEntry[]);
          setVisits(cached.visits as Visit[]);
          setMeasurements(cached.measurements as Measurement[]);
          setNotifications(cached.notifications as Notification[]);
          setBudgetTracking(cached.budgetTracking as BudgetTracking[]);

          if (cached.dashboardStats.length > 0) {
            const s = cached.dashboardStats[0] as any;
            setDashboardStats({
              activePlans: s.activePlans, visitsThisMonth: s.visitsThisMonth,
              pendingVisits: s.pendingVisits, budgetUsed: s.budgetUsed,
              totalBudget: s.totalBudget, anomalyCount: s.anomalyCount,
            });
          }

          const locMap = new Map(cached.locations.map(l => [l.id, l]));
          setActivityItems(cached.activityItems.map(a => ({
            id: a.id, location: locMap.get(a.location_id) || {} as Location,
            status: a.status as ActivityItem['status'], measurementType: a.measurementType,
            assignee: a.assignee, time: a.time, hasAnomaly: a.hasAnomaly,
            pipelineStatus: a.pipelineStatus as ActivityItem['pipelineStatus'],
            lastPh: a.lastPh, phTrend: a.phTrend as ActivityItem['phTrend'], phHistory: a.phHistory,
          })));

          setMonthlyBudgetData(cached.monthlyBudgetData.map(m => ({
            month: m.month, analysis: m.analysis, logistics: m.logistics, target: m.target,
          })) as typeof mock.monthlyBudgetData);

          setPlanBuilderEntries(cached.planBuilderEntries as Entry[]);
          setReady(true);
          console.log(`[db] Loaded from cache in ${(performance.now() - t0).toFixed(0)}ms (${cached.locations.length} locations)`);
        }
      } catch (e) {
        console.warn('[db] Cache load failed, will fetch from Supabase:', e);
      }

      // Step 2: Sync from Supabase in background
      try {
        await seedSupabaseDatabase();

        const [
          { data: dbUsers }, { data: dbLocations }, { data: dbTemplates },
          { data: dbPlans }, { data: dbPlanEntries }, { data: dbVisits },
          { data: dbMeasurements }, { data: dbNotifications }, { data: dbBudget },
          { data: dbStats }, { data: dbActivity }, { data: dbMonthly },
        ] = await Promise.all([
          supabase.from('users').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('measurement_templates').select('*'),
          supabase.from('monitoring_plans').select('*'),
          supabase.from('plan_entries').select('*'),
          supabase.from('visits').select('*'),
          supabase.from('measurements').select('*'),
          supabase.from('notifications').select('*').order('created_at', { ascending: false }),
          supabase.from('budget_tracking').select('*'),
          supabase.from('dashboard_stats').select('*').limit(1),
          supabase.from('activity_items').select('*'),
          supabase.from('monthly_budget_data').select('*'),
        ]);

        // Plan builder entries — paginate
        let allPbEntries: Entry[] = [];
        let pbOffset = 0;
        const PB_PAGE = 1000;
        while (true) {
          const { data: pbPage } = await supabase
            .from('plan_builder_entries').select('*').range(pbOffset, pbOffset + PB_PAGE - 1);
          if (!pbPage || pbPage.length === 0) break;
          allPbEntries = allPbEntries.concat(pbPage.map(toPlanBuilderEntry));
          if (pbPage.length < PB_PAGE) break;
          pbOffset += PB_PAGE;
        }

        if (cancelled) return;

        applySupabaseData(dbUsers, dbLocations, dbTemplates, dbPlans, dbPlanEntries,
          dbVisits, dbMeasurements, dbNotifications, dbBudget, dbStats, dbActivity, dbMonthly, allPbEntries);
        setReady(true);
        console.log('[db] Synced from Supabase');

        // Step 3: Write to IndexedDB cache for next load
        const locs = (dbLocations || []) as Location[];
        writeToCache({
          users: (dbUsers || []) as User[],
          locations: locs,
          measurementTemplates: (dbTemplates || []).map(toMeasurementTemplate),
          monitoringPlans: (dbPlans || []) as MonitoringPlan[],
          planEntries: (dbPlanEntries || []) as PlanEntry[],
          visits: (dbVisits || []) as Visit[],
          measurements: (dbMeasurements || []) as Measurement[],
          notifications: (dbNotifications || []) as Notification[],
          budgetTracking: (dbBudget || []) as BudgetTracking[],
          dashboardStats: dbStats && (dbStats as any[]).length > 0 ? [{
            id: 'stats',
            activePlans: (dbStats as any[])[0].active_plans,
            visitsThisMonth: (dbStats as any[])[0].visits_this_month,
            pendingVisits: (dbStats as any[])[0].pending_visits,
            budgetUsed: Number((dbStats as any[])[0].budget_used),
            totalBudget: Number((dbStats as any[])[0].total_budget),
            anomalyCount: (dbStats as any[])[0].anomaly_count,
          }] : [],
          activityItems: (dbActivity || []).map((a: any) => ({
            id: a.id, location_id: a.location_id, status: a.status,
            measurementType: a.measurement_type, assignee: a.assignee, time: a.time_label,
            hasAnomaly: a.has_anomaly, pipelineStatus: a.pipeline_status,
            lastPh: a.last_ph, phTrend: a.ph_trend, phHistory: a.ph_history,
          })),
          monthlyBudgetData: (dbMonthly || []).map((m: any, i: number) => ({
            id: `mb${i}`, month: m.month, analysis: Number(m.analysis),
            logistics: Number(m.logistics), target: Number(m.target),
          })),
          planBuilderEntries: allPbEntries,
        }).then(() => console.log('[db] Cache updated')).catch(e => console.warn('[db] Cache write failed:', e));
      } catch (err) {
        console.error('[db] Supabase sync failed:', err);
        // If we already loaded from cache, that's fine — we're still ready
      }
    })();

    return () => { cancelled = true; };
  }, [applySupabaseData]);

  // ── Mutations (update local state + persist to Supabase) ──

  const updateMeasurement = useCallback((id: string, updates: Partial<Measurement>) => {
    setMeasurements(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    supabase.from('measurements').update(updates).eq('id', id).then(({ error }) => {
      if (error) console.error('[db] updateMeasurement error:', error);
    });
  }, []);

  const addMeasurements = useCallback((items: Measurement[]) => {
    setMeasurements(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const fresh = items.filter(m => !existingIds.has(m.id));
      if (fresh.length > 0) {
        supabase.from('measurements').upsert(fresh, { onConflict: 'id' }).then(({ error }) => {
          if (error) console.error('[db] addMeasurements error:', error);
        });
        return [...prev, ...fresh];
      }
      return prev;
    });
  }, []);

  const addVisits = useCallback((items: Visit[]) => {
    setVisits(prev => {
      const existingIds = new Set(prev.map(v => v.id));
      const fresh = items.filter(v => !existingIds.has(v.id));
      if (fresh.length > 0) {
        supabase.from('visits').upsert(fresh.map(v => ({
          id: v.id,
          plan_id: v.plan_id,
          location_id: v.location_id,
          planned_date: v.planned_date,
          status: v.status,
          logistics_cost: v.logistics_cost || null,
          assigned_to: v.assigned_to || null,
          route_order: v.route_order || null,
          cancellation_reason: v.cancellation_reason || null,
          notes: v.notes || null,
        })), { onConflict: 'id' }).then(({ error }) => {
          if (error) console.error('[db] addVisits error:', error);
        });
        return [...prev, ...fresh];
      }
      return prev;
    });
  }, []);

  const removeMeasurements = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setMeasurements(prev => prev.filter(m => !idSet.has(m.id)));
    supabase.from('measurements').delete().in('id', ids).then(({ error }) => {
      if (error) console.error('[db] removeMeasurements error:', error);
    });
  }, []);

  const removeVisits = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setVisits(prev => prev.filter(v => !idSet.has(v.id)));
    supabase.from('visits').delete().in('id', ids).then(({ error }) => {
      if (error) console.error('[db] removeVisits error:', error);
    });
  }, []);

  const updateVisit = useCallback((id: string, updates: Partial<Visit>) => {
    setVisits(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    supabase.from('visits').update(updates).eq('id', id).then(({ error }) => {
      if (error) console.error('[db] updateVisit error:', error);
    });
  }, []);

  const updateNotification = useCallback((id: string, updates: Partial<Notification>) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    supabase.from('notifications').update(updates).eq('id', id).then(({ error }) => {
      if (error) console.error('[db] updateNotification error:', error);
    });
  }, []);

  const addPlanBuilderEntries = useCallback((entries: Entry[]) => {
    setPlanBuilderEntries(prev => {
      const existingIds = new Set(prev.map(e => e.id));
      const fresh = entries.filter(e => !existingIds.has(e.id));
      if (fresh.length > 0) {
        const rows = fresh.map(e => ({
          id: e.id,
          location_id: e.locationId,
          location_name: e.locationName,
          location_code: e.locationCode,
          rating: e.rating,
          river: e.river,
          program: e.program,
          water_body: e.waterBody,
          measurement: e.measurement,
          frequency: e.frequency,
          assignee_id: e.assigneeId,
          status: e.status,
          next_date: e.nextDate,
          cost: e.cost,
        }));
        supabase.from('plan_builder_entries').upsert(rows).then(({ error }) => {
          if (error) console.error('[db] addPlanBuilderEntries error:', error);
        });
        return [...prev, ...fresh];
      }
      return prev;
    });
  }, []);

  const removePlanBuilderEntries = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setPlanBuilderEntries(prev => prev.filter(e => !idSet.has(e.id)));
    supabase.from('plan_builder_entries').delete().in('id', ids).then(({ error }) => {
      if (error) console.error('[db] removePlanBuilderEntries error:', error);
    });
  }, []);

  // Historical data queries — direct from Supabase
  const getHistoricalMeasurements = useCallback(async (locationId: string): Promise<HistoricalMeasurement[]> => {
    const { data, error } = await supabase
      .from('historical_measurements')
      .select('*')
      .eq('location_id', locationId)
      .order('date', { ascending: true });
    if (error) {
      console.error('[db] getHistoricalMeasurements error:', error);
      return [];
    }
    return (data || []) as HistoricalMeasurement[];
  }, []);

  const getHistoricalByType = useCallback(async (locationId: string, measurementType: string): Promise<HistoricalMeasurement[]> => {
    const { data, error } = await supabase
      .from('historical_measurements')
      .select('*')
      .eq('location_id', locationId)
      .eq('measurement_type', measurementType)
      .order('date', { ascending: true });
    if (error) {
      console.error('[db] getHistoricalByType error:', error);
      return [];
    }
    return (data || []) as HistoricalMeasurement[];
  }, []);

  const getAllHistoricalMeasurements = useCallback(async (): Promise<Map<string, HistoricalMeasurement[]>> => {
    const map = new Map<string, HistoricalMeasurement[]>();
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('historical_measurements')
        .select('*')
        .order('date', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) { console.error('[db] getAllHistorical error:', error); break; }
      if (!data || data.length === 0) break;
      for (const row of data as HistoricalMeasurement[]) {
        const arr = map.get(row.location_id) || [];
        arr.push(row);
        map.set(row.location_id, arr);
      }
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return map;
  }, []);

  const value = useMemo<Database>(() => ({
    ready,
    users,
    locations,
    measurementTemplates,
    monitoringPlans,
    planEntries,
    visits,
    measurements,
    notifications,
    budgetTracking,
    dashboardStats,
    activityItems,
    monthlyBudgetData,
    planBuilderEntries,
    updateMeasurement,
    addMeasurements,
    addVisits,
    updateVisit,
    updateNotification,
    addPlanBuilderEntries,
    removePlanBuilderEntries,
    removeMeasurements,
    removeVisits,
    getHistoricalMeasurements,
    getHistoricalByType,
    getAllHistoricalMeasurements,
    getRatingColor: mock.getRatingColor,
    getRatingLabel: mock.getRatingLabel,
    getPipelineLabel: mock.getPipelineLabel,
    getPipelineStageIndex: mock.getPipelineStageIndex,
    getStatusColor: mock.getStatusColor,
  }), [ready, users, locations, measurementTemplates, monitoringPlans, planEntries,
       visits, measurements, notifications, budgetTracking, dashboardStats,
       activityItems, monthlyBudgetData, planBuilderEntries, updateMeasurement, addMeasurements,
       addVisits, updateVisit, updateNotification, addPlanBuilderEntries, removePlanBuilderEntries,
       removeMeasurements, removeVisits,
       getHistoricalMeasurements, getHistoricalByType, getAllHistoricalMeasurements]);

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): Database {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used within DatabaseProvider');
  return ctx;
}
