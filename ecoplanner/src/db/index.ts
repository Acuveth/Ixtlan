import Dexie, { type EntityTable } from 'dexie';
import type {
  User, Location, MeasurementTemplate, MonitoringPlan, PlanEntry,
  Visit, Measurement, Notification, BudgetTracking,
} from '../types';
import type { Entry as PlanBuilderEntry } from '../pages/PlanBuilder/planData';

// Historical measurement — one row per sample taken at a location on a given date
export interface HistoricalMeasurement {
  id: string;
  location_id: string;
  measurement_type: string;          // e.g. 'Basic Chemistry'
  date: string;                      // ISO date YYYY-MM-DD
  year: number;
  results: Record<string, number>;   // parameter_key -> value
}

export interface MonthlyBudget {
  id: string;
  month: string;
  analysis: number;
  logistics: number;
  target: number;
}

export interface DashboardStatsRow {
  id: string;
  activePlans: number;
  visitsThisMonth: number;
  pendingVisits: number;
  budgetUsed: number;
  totalBudget: number;
  anomalyCount: number;
}

export interface ActivityItemRow {
  id: string;
  location_id: string;
  status: 'planned' | 'active' | 'done' | 'anomaly';
  measurementType: string;
  assignee: string;
  time: string;
  hasAnomaly: boolean;
  pipelineStatus: string;
  lastPh?: number;
  phTrend?: 'declining' | 'stable' | 'improving';
  phHistory?: number[];
}

class EcoPlannerDB extends Dexie {
  users!: EntityTable<User, 'id'>;
  locations!: EntityTable<Location, 'id'>;
  measurementTemplates!: EntityTable<MeasurementTemplate, 'id'>;
  monitoringPlans!: EntityTable<MonitoringPlan, 'id'>;
  planEntries!: EntityTable<PlanEntry, 'id'>;
  visits!: EntityTable<Visit, 'id'>;
  measurements!: EntityTable<Measurement, 'id'>;
  notifications!: EntityTable<Notification, 'id'>;
  budgetTracking!: EntityTable<BudgetTracking, 'id'>;
  dashboardStats!: EntityTable<DashboardStatsRow, 'id'>;
  activityItems!: EntityTable<ActivityItemRow, 'id'>;
  monthlyBudgetData!: EntityTable<MonthlyBudget, 'id'>;
  planBuilderEntries!: EntityTable<PlanBuilderEntry, 'id'>;
  historicalMeasurements!: EntityTable<HistoricalMeasurement, 'id'>;

  constructor() {
    super('ecoplanner');

    this.version(1).stores({
      users: 'id, email, role',
      locations: 'id, code, environment_type, rating',
      measurementTemplates: 'id, environment_type',
      monitoringPlans: 'id, program_type, year, status',
      planEntries: 'id, plan_id, location_id, measurement_template_id',
      visits: 'id, plan_id, location_id, planned_date, status, assigned_to',
      measurements: 'id, location_id, measurement_template_id, status, pipeline_status, planned_date',
      notifications: 'id, user_id, type, is_read',
      budgetTracking: 'id, plan_id, quarter',
      dashboardStats: 'id',
      activityItems: 'id, location_id, status',
      monthlyBudgetData: 'id, month',
      planBuilderEntries: 'id, locationId, program, status, assigneeId',
      historicalMeasurements: 'id, location_id, measurement_type, date, year, [location_id+measurement_type]',
    });
  }
}

export const db = new EcoPlannerDB();
