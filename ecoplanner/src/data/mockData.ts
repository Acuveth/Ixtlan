import type {
  User, Location, MeasurementTemplate, MonitoringPlan, PlanEntry,
  Visit, Measurement, Notification, BudgetTracking, DashboardStats,
  ActivityItem, Rating, PipelineStatus
} from '../types';

// Users
export const currentUser: User = {
  id: 'u1',
  email: 'ana.kovac@arso.si',
  full_name: 'Ana Kovač',
  role: 'planner',
  created_at: '2025-09-15T08:00:00Z',
};

export const users: User[] = [
  currentUser,
  { id: 'u2', email: 'marko.novak@arso.si', full_name: 'Marko Novak', role: 'field_worker', created_at: '2025-10-01T08:00:00Z' },
  { id: 'u3', email: 'petra.horvat@arso.si', full_name: 'Petra Horvat', role: 'analyst', created_at: '2025-10-15T08:00:00Z' },
  { id: 'u4', email: 'jan.krajnc@arso.si', full_name: 'Jan Krajnc', role: 'field_worker', created_at: '2025-11-01T08:00:00Z' },
  { id: 'u5', email: 'maja.zupan@arso.si', full_name: 'Maja Zupan', role: 'admin', created_at: '2025-08-01T08:00:00Z' },
  { id: 'u6', email: 'nina.vidmar@arso.si', full_name: 'Nina Vidmar', role: 'lab_worker', created_at: '2025-09-01T08:00:00Z' },
];

// Locations — generated from observation room stations so every station has a matching location record
import { obsLocationsForDb } from './observationLocations';
export const locations: Location[] = obsLocationsForDb();

// Measurement Templates
export const measurementTemplates: MeasurementTemplate[] = [
  {
    id: 'mt1', name: 'Basic Chemistry', environment_type: 'water',
    parameters: [
      { key: 'ph', label: 'pH', unit: '', type: 'number', min: 0, max: 14 },
      { key: 'oxygen', label: 'Dissolved Oxygen', unit: 'mg/L', type: 'number', min: 0, max: 20 },
      { key: 'conductivity', label: 'Conductivity', unit: 'μS/cm', type: 'number', min: 0, max: 2000 },
      { key: 'temperature', label: 'Temperature', unit: '°C', type: 'number', min: -5, max: 40 },
    ],
    unit_cost: 120, is_active: true,
  },
  {
    id: 'mt2', name: 'Heavy Metals', environment_type: 'water',
    parameters: [
      { key: 'lead', label: 'Lead (Pb)', unit: 'μg/L', type: 'number', min: 0, max: 100 },
      { key: 'mercury', label: 'Mercury (Hg)', unit: 'μg/L', type: 'number', min: 0, max: 10 },
      { key: 'cadmium', label: 'Cadmium (Cd)', unit: 'μg/L', type: 'number', min: 0, max: 50 },
      { key: 'zinc', label: 'Zinc (Zn)', unit: 'μg/L', type: 'number', min: 0, max: 500 },
    ],
    unit_cost: 350, is_active: true,
  },
  {
    id: 'mt3', name: 'Pesticides', environment_type: 'water',
    parameters: [
      { key: 'atrazine', label: 'Atrazine', unit: 'μg/L', type: 'number', min: 0, max: 5 },
      { key: 'glyphosate', label: 'Glyphosate', unit: 'μg/L', type: 'number', min: 0, max: 10 },
    ],
    unit_cost: 280, is_active: true,
  },
  {
    id: 'mt4', name: 'Nutrients', environment_type: 'water',
    parameters: [
      { key: 'nitrate', label: 'Nitrate (NO3)', unit: 'mg/L', type: 'number', min: 0, max: 100 },
      { key: 'phosphate', label: 'Phosphate (PO4)', unit: 'mg/L', type: 'number', min: 0, max: 10 },
      { key: 'ammonia', label: 'Ammonia (NH3)', unit: 'mg/L', type: 'number', min: 0, max: 5 },
    ],
    unit_cost: 180, is_active: true,
  },
];

// Monitoring Plans
export const monitoringPlans: MonitoringPlan[] = [
  { id: 'p1', name: 'River Monitoring 2026', program_type: 'river', year: 2026, status: 'active', total_budget: 185000, created_by: 'u1', created_at: '2025-12-01T10:00:00Z' },
  { id: 'p2', name: 'Lake Monitoring 2026', program_type: 'lake', year: 2026, status: 'active', total_budget: 63000, created_by: 'u1', created_at: '2025-12-15T10:00:00Z' },
  { id: 'p3', name: 'River Monitoring 2025', program_type: 'river', year: 2025, status: 'completed', total_budget: 172000, created_by: 'u1', created_at: '2024-12-01T10:00:00Z' },
];

// Plan Entries
export const planEntries: PlanEntry[] = [
  { id: 'pe1', plan_id: 'p1', location_id: 'l1', measurement_template_id: 'mt1', frequency: 'biannual', default_assignee: 'u2' },
  { id: 'pe2', plan_id: 'p1', location_id: 'l1', measurement_template_id: 'mt2', frequency: 'annual', default_assignee: 'u2' },
  { id: 'pe3', plan_id: 'p1', location_id: 'l2', measurement_template_id: 'mt1', frequency: 'quarterly', default_assignee: 'u2' },
  { id: 'pe4', plan_id: 'p1', location_id: 'l2', measurement_template_id: 'mt4', frequency: 'quarterly', default_assignee: 'u4' },
  { id: 'pe5', plan_id: 'p1', location_id: 'l3', measurement_template_id: 'mt1', frequency: 'annual', default_assignee: 'u4' },
  { id: 'pe6', plan_id: 'p1', location_id: 'l4', measurement_template_id: 'mt1', frequency: 'quarterly', default_assignee: 'u2' },
  { id: 'pe7', plan_id: 'p1', location_id: 'l4', measurement_template_id: 'mt2', frequency: 'biannual', default_assignee: 'u2' },
  { id: 'pe8', plan_id: 'p1', location_id: 'l5', measurement_template_id: 'mt1', frequency: 'annual', default_assignee: 'u4' },
  { id: 'pe9', plan_id: 'p1', location_id: 'l6', measurement_template_id: 'mt1', frequency: 'biennial', default_assignee: 'u4' },
  { id: 'pe10', plan_id: 'p1', location_id: 'l7', measurement_template_id: 'mt1', frequency: 'biannual', default_assignee: 'u2' },
  { id: 'pe11', plan_id: 'p1', location_id: 'l7', measurement_template_id: 'mt4', frequency: 'biannual', default_assignee: 'u2' },
  { id: 'pe12', plan_id: 'p1', location_id: 'l8', measurement_template_id: 'mt1', frequency: 'annual', default_assignee: 'u4' },
  { id: 'pe13', plan_id: 'p1', location_id: 'l9', measurement_template_id: 'mt1', frequency: 'biannual', default_assignee: 'u2' },
  { id: 'pe14', plan_id: 'p1', location_id: 'l13', measurement_template_id: 'mt1', frequency: 'annual', default_assignee: 'u4' },
  { id: 'pe15', plan_id: 'p1', location_id: 'l14', measurement_template_id: 'mt1', frequency: 'biannual', default_assignee: 'u2' },
  { id: 'pe16', plan_id: 'p2', location_id: 'l10', measurement_template_id: 'mt1', frequency: 'annual', default_assignee: 'u4' },
  { id: 'pe17', plan_id: 'p2', location_id: 'l10', measurement_template_id: 'mt4', frequency: 'annual', default_assignee: 'u4' },
  { id: 'pe18', plan_id: 'p2', location_id: 'l11', measurement_template_id: 'mt1', frequency: 'biennial', default_assignee: 'u4' },
  { id: 'pe19', plan_id: 'p2', location_id: 'l12', measurement_template_id: 'mt1', frequency: 'biannual', default_assignee: 'u2' },
  { id: 'pe20', plan_id: 'p2', location_id: 'l12', measurement_template_id: 'mt3', frequency: 'annual', default_assignee: 'u2' },
];

// Visits
export const visits: Visit[] = [
  { id: 'v1', plan_id: 'p1', location_id: 'l1', planned_date: '2026-01-20', status: 'completed', logistics_cost: 85, assigned_to: 'u2', notes: 'Winter sampling completed successfully' },
  { id: 'v2', plan_id: 'p1', location_id: 'l2', planned_date: '2026-01-15', status: 'completed', logistics_cost: 120, assigned_to: 'u2' },
  { id: 'v3', plan_id: 'p1', location_id: 'l3', planned_date: '2026-02-10', status: 'completed', logistics_cost: 150, assigned_to: 'u4' },
  { id: 'v4', plan_id: 'p1', location_id: 'l4', planned_date: '2026-02-05', status: 'completed', logistics_cost: 130, assigned_to: 'u2' },
  { id: 'v5', plan_id: 'p1', location_id: 'l2', planned_date: '2026-03-15', status: 'in_progress', logistics_cost: 120, assigned_to: 'u2' },
  { id: 'v6', plan_id: 'p1', location_id: 'l4', planned_date: '2026-03-18', status: 'planned', logistics_cost: 130, assigned_to: 'u2' },
  { id: 'v7', plan_id: 'p1', location_id: 'l1', planned_date: '2026-04-15', status: 'planned', logistics_cost: 85, assigned_to: 'u2' },
  { id: 'v8', plan_id: 'p1', location_id: 'l5', planned_date: '2026-04-20', status: 'planned', logistics_cost: 140, assigned_to: 'u4' },
  { id: 'v9', plan_id: 'p1', location_id: 'l7', planned_date: '2026-03-20', status: 'planned', logistics_cost: 160, assigned_to: 'u2' },
  { id: 'v10', plan_id: 'p1', location_id: 'l9', planned_date: '2026-03-22', status: 'planned', logistics_cost: 75, assigned_to: 'u2' },
  { id: 'v11', plan_id: 'p1', location_id: 'l2', planned_date: '2026-06-15', status: 'planned', logistics_cost: 120, assigned_to: 'u2' },
  { id: 'v12', plan_id: 'p1', location_id: 'l2', planned_date: '2026-09-15', status: 'planned', logistics_cost: 120, assigned_to: 'u4' },
  { id: 'v13', plan_id: 'p2', location_id: 'l10', planned_date: '2026-05-10', status: 'planned', logistics_cost: 180, assigned_to: 'u4' },
  { id: 'v14', plan_id: 'p2', location_id: 'l12', planned_date: '2026-04-05', status: 'planned', logistics_cost: 110, assigned_to: 'u2' },
  // Extra visits for Marko (u2) — realistic weekly schedule
  { id: 'v15', plan_id: 'p1', location_id: 'l1', planned_date: '2026-03-14', status: 'planned', logistics_cost: 85, assigned_to: 'u2', notes: 'Urgent re-sampling after pH anomaly upstream' },
  { id: 'v16', plan_id: 'p1', location_id: 'l4', planned_date: '2026-03-14', status: 'planned', logistics_cost: 95, assigned_to: 'u2' },
  { id: 'v17', plan_id: 'p1', location_id: 'l14', planned_date: '2026-03-16', status: 'planned', logistics_cost: 170, assigned_to: 'u2', notes: 'Combine with Drava upstream check' },
  { id: 'v18', plan_id: 'p1', location_id: 'l8', planned_date: '2026-03-17', status: 'planned', logistics_cost: 190, assigned_to: 'u2' },
  { id: 'v19', plan_id: 'p1', location_id: 'l13', planned_date: '2026-03-19', status: 'planned', logistics_cost: 110, assigned_to: 'u2' },
  { id: 'v20', plan_id: 'p1', location_id: 'l15', planned_date: '2026-03-21', status: 'planned', logistics_cost: 200, assigned_to: 'u2', notes: 'Spring melt monitoring — check turbidity' },
  { id: 'v21', plan_id: 'p1', location_id: 'l3', planned_date: '2026-03-24', status: 'planned', logistics_cost: 155, assigned_to: 'u2' },
  { id: 'v22', plan_id: 'p1', location_id: 'l7', planned_date: '2026-03-25', status: 'planned', logistics_cost: 160, assigned_to: 'u2' },
  { id: 'v23', plan_id: 'p2', location_id: 'l10', planned_date: '2026-03-26', status: 'planned', logistics_cost: 180, assigned_to: 'u2', notes: 'Early spring lake sampling' },
  { id: 'v24', plan_id: 'p1', location_id: 'l2', planned_date: '2026-03-28', status: 'planned', logistics_cost: 120, assigned_to: 'u2' },
];

// Measurements
export const measurements: Measurement[] = [
  { id: 'm1', location_id: 'l1', measurement_template_id: 'mt1', plan_entry_id: 'pe1', visit_id: 'v1', assignee_id: 'u2', recorded_by: 'u2', status: 'completed', pipeline_status: 'validated', results: { ph: 7.2, oxygen: 8.1, conductivity: 420, temperature: 4.2 }, planned_date: '2026-01-20', measurement_date: '2026-01-20', analysis_cost: 120, lab_assignee_id: 'u6', lab_assigned_at: '2026-01-22T09:00:00Z', validated_by: 'u3', validated_at: '2026-02-05T14:00:00Z' },
  { id: 'm2', location_id: 'l2', measurement_template_id: 'mt1', plan_entry_id: 'pe3', visit_id: 'v2', assignee_id: 'u2', recorded_by: 'u2', status: 'completed', pipeline_status: 'validated', results: { ph: 6.8, oxygen: 7.2, conductivity: 580, temperature: 3.8 }, planned_date: '2026-01-15', measurement_date: '2026-01-15', analysis_cost: 120, lab_assignee_id: 'u6', lab_assigned_at: '2026-01-17T10:00:00Z', validated_by: 'u3', validated_at: '2026-02-01T10:00:00Z' },
  { id: 'm3', location_id: 'l2', measurement_template_id: 'mt4', plan_entry_id: 'pe4', visit_id: 'v2', assignee_id: 'u4', recorded_by: 'u4', status: 'completed', pipeline_status: 'validated', results: { nitrate: 32.5, phosphate: 1.8, ammonia: 0.4 }, planned_date: '2026-01-15', measurement_date: '2026-01-15', analysis_cost: 180, lab_assignee_id: 'u6', lab_assigned_at: '2026-01-17T10:00:00Z', validated_by: 'u3', validated_at: '2026-02-01T11:00:00Z' },
  { id: 'm4', location_id: 'l3', measurement_template_id: 'mt1', plan_entry_id: 'pe5', visit_id: 'v3', assignee_id: 'u4', recorded_by: 'u4', status: 'completed', pipeline_status: 'analyzed', results: { ph: 7.6, oxygen: 9.2, conductivity: 310, temperature: 5.1 }, planned_date: '2026-02-10', measurement_date: '2026-02-10', analysis_cost: 120, lab_assignee_id: 'u6', lab_assigned_at: '2026-02-12T08:30:00Z' },
  { id: 'm5', location_id: 'l4', measurement_template_id: 'mt1', plan_entry_id: 'pe6', visit_id: 'v4', assignee_id: 'u2', recorded_by: 'u2', status: 'completed', pipeline_status: 'validated', results: { ph: 5.2, oxygen: 5.8, conductivity: 720, temperature: 4.6 }, planned_date: '2026-02-05', measurement_date: '2026-02-05', analysis_cost: 120, lab_assignee_id: 'u6', lab_assigned_at: '2026-02-07T09:00:00Z', validated_by: 'u3', validated_at: '2026-02-20T09:00:00Z', notes: 'Anomaly: pH significantly below normal range' },
  { id: 'm6', location_id: 'l2', measurement_template_id: 'mt1', plan_entry_id: 'pe3', visit_id: 'v5', assignee_id: 'u2', recorded_by: 'u2', status: 'in_progress', pipeline_status: 'in_lab', planned_date: '2026-03-15', measurement_date: '2026-03-14', lab_assignee_id: 'u6', lab_assigned_at: '2026-03-14T16:00:00Z' },
  { id: 'm7', location_id: 'l2', measurement_template_id: 'mt4', plan_entry_id: 'pe4', visit_id: 'v5', assignee_id: 'u2', recorded_by: 'u2', status: 'in_progress', pipeline_status: 'in_transit', planned_date: '2026-03-15', measurement_date: '2026-03-14', lab_assignee_id: 'u6', lab_assigned_at: '2026-03-14T16:00:00Z' },
  { id: 'm8', location_id: 'l4', measurement_template_id: 'mt1', plan_entry_id: 'pe6', visit_id: 'v6', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-18', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm9', location_id: 'l4', measurement_template_id: 'mt2', plan_entry_id: 'pe7', visit_id: 'v6', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-18', analysis_cost: 350, lab_assignee_id: 'u6' },
  { id: 'm10', location_id: 'l1', measurement_template_id: 'mt1', plan_entry_id: 'pe1', visit_id: 'v7', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-04-15', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm11', location_id: 'l5', measurement_template_id: 'mt1', plan_entry_id: 'pe8', visit_id: 'v8', assignee_id: 'u4', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-04-20', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm12', location_id: 'l7', measurement_template_id: 'mt1', plan_entry_id: 'pe10', visit_id: 'v9', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-20', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm13', location_id: 'l9', measurement_template_id: 'mt1', plan_entry_id: 'pe13', visit_id: 'v10', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-22', analysis_cost: 120, lab_assignee_id: 'u6' },

  // --- Today (Mar 14) — v15: Sava Ljubljana urgent re-sample ---
  { id: 'm14', location_id: 'l1', measurement_template_id: 'mt1', plan_entry_id: 'pe1', visit_id: 'v15', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-14', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm15', location_id: 'l1', measurement_template_id: 'mt4', plan_entry_id: 'pe1', visit_id: 'v15', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-14', analysis_cost: 180, lab_assignee_id: 'u6' },
  { id: 'm16', location_id: 'l1', measurement_template_id: 'mt2', plan_entry_id: 'pe2', visit_id: 'v15', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-14', analysis_cost: 350, lab_assignee_id: 'u6' },

  // --- Today (Mar 14) — v16: Savinja Celje ---
  { id: 'm17', location_id: 'l4', measurement_template_id: 'mt1', plan_entry_id: 'pe6', visit_id: 'v16', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-14', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm18', location_id: 'l4', measurement_template_id: 'mt3', plan_entry_id: 'pe6', visit_id: 'v16', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-14', analysis_cost: 280, lab_assignee_id: 'u6' },

  // --- Mar 16 — v17: Drava Ptuj ---
  { id: 'm19', location_id: 'l14', measurement_template_id: 'mt1', plan_entry_id: 'pe15', visit_id: 'v17', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-16', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm20', location_id: 'l14', measurement_template_id: 'mt4', plan_entry_id: 'pe15', visit_id: 'v17', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-16', analysis_cost: 180, lab_assignee_id: 'u6' },
  { id: 'm21', location_id: 'l14', measurement_template_id: 'mt2', plan_entry_id: 'pe15', visit_id: 'v17', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-16', analysis_cost: 350, lab_assignee_id: 'u6' },

  // --- Mar 17 — v18: Kolpa Metlika ---
  { id: 'm22', location_id: 'l8', measurement_template_id: 'mt1', plan_entry_id: 'pe12', visit_id: 'v18', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-17', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm23', location_id: 'l8', measurement_template_id: 'mt4', plan_entry_id: 'pe12', visit_id: 'v18', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-17', analysis_cost: 180, lab_assignee_id: 'u6' },

  // --- Mar 19 — v19: Sava Jesenice ---
  { id: 'm24', location_id: 'l13', measurement_template_id: 'mt1', plan_entry_id: 'pe14', visit_id: 'v19', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-19', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm25', location_id: 'l13', measurement_template_id: 'mt3', plan_entry_id: 'pe14', visit_id: 'v19', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-19', analysis_cost: 280, lab_assignee_id: 'u6' },

  // --- Mar 21 — v20: Soča Tolmin spring melt ---
  { id: 'm26', location_id: 'l15', measurement_template_id: 'mt1', plan_entry_id: 'pe9', visit_id: 'v20', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-21', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm27', location_id: 'l15', measurement_template_id: 'mt4', plan_entry_id: 'pe9', visit_id: 'v20', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-21', analysis_cost: 180, lab_assignee_id: 'u6' },
  { id: 'm28', location_id: 'l15', measurement_template_id: 'mt2', plan_entry_id: 'pe9', visit_id: 'v20', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-21', analysis_cost: 350, lab_assignee_id: 'u6' },

  // --- Mar 24 — v21: Drava Maribor ---
  { id: 'm29', location_id: 'l3', measurement_template_id: 'mt1', plan_entry_id: 'pe5', visit_id: 'v21', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-24', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm30', location_id: 'l3', measurement_template_id: 'mt2', plan_entry_id: 'pe5', visit_id: 'v21', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-24', analysis_cost: 350, lab_assignee_id: 'u6' },

  // --- Mar 25 — v22: Mura Murska Sobota ---
  { id: 'm31', location_id: 'l7', measurement_template_id: 'mt1', plan_entry_id: 'pe10', visit_id: 'v22', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-25', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm32', location_id: 'l7', measurement_template_id: 'mt4', plan_entry_id: 'pe11', visit_id: 'v22', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-25', analysis_cost: 180, lab_assignee_id: 'u6' },

  // --- Mar 26 — v23: Lake Bled ---
  { id: 'm33', location_id: 'l10', measurement_template_id: 'mt1', plan_entry_id: 'pe16', visit_id: 'v23', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-26', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm34', location_id: 'l10', measurement_template_id: 'mt4', plan_entry_id: 'pe17', visit_id: 'v23', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-26', analysis_cost: 180, lab_assignee_id: 'u6' },

  // --- Mar 28 — v24: Sava Litija quarterly ---
  { id: 'm35', location_id: 'l2', measurement_template_id: 'mt1', plan_entry_id: 'pe3', visit_id: 'v24', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-28', analysis_cost: 120, lab_assignee_id: 'u6' },
  { id: 'm36', location_id: 'l2', measurement_template_id: 'mt4', plan_entry_id: 'pe4', visit_id: 'v24', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-28', analysis_cost: 180, lab_assignee_id: 'u6' },
  { id: 'm37', location_id: 'l2', measurement_template_id: 'mt3', plan_entry_id: 'pe3', visit_id: 'v24', assignee_id: 'u2', status: 'planned', pipeline_status: 'pending_sample', planned_date: '2026-03-28', analysis_cost: 280, lab_assignee_id: 'u6' },
];

// Notifications
export const notifications: Notification[] = [
  { id: 'n1', user_id: 'u1', type: 'anomaly', title: 'pH Anomaly at Savinja - Celje', body: 'pH dropped to 5.2, significantly below the historical average of 7.1. Consider urgent re-monitoring within 14 days.', related_entity_type: 'measurement', related_entity_id: 'm5', is_read: false, created_at: '2026-03-14T08:30:00Z' },
  { id: 'n2', user_id: 'u1', type: 'assignment', title: 'Visit scheduled: Sava - Litija', body: 'Marko Novak has been assigned to collect samples on March 15, 2026.', related_entity_type: 'visit', related_entity_id: 'v5', is_read: false, created_at: '2026-03-13T16:00:00Z' },
  { id: 'n3', user_id: 'u1', type: 'budget_alert', title: 'Q1 Budget 72% utilized', body: 'River Monitoring 2026 Q1 spending is at €13,680 of €19,000 allocated. On track.', related_entity_type: 'plan', related_entity_id: 'p1', is_read: true, created_at: '2026-03-10T09:00:00Z' },
  { id: 'n4', user_id: 'u1', type: 'approval_needed', title: 'Frequency override requested', body: 'Jan Krajnc requests changing Soča monitoring from biennial to annual. Reason: recent construction activity upstream.', is_read: false, created_at: '2026-03-12T11:00:00Z' },
];

// Budget Tracking
export const budgetTracking: BudgetTracking[] = [
  { id: 'bt1', plan_id: 'p1', quarter: 1, allocated_amount: 46250, spent_amount: 18420, projected_amount: 44800 },
  { id: 'bt2', plan_id: 'p1', quarter: 2, allocated_amount: 46250, spent_amount: 0, projected_amount: 48200 },
  { id: 'bt3', plan_id: 'p1', quarter: 3, allocated_amount: 46250, spent_amount: 0, projected_amount: 45100 },
  { id: 'bt4', plan_id: 'p1', quarter: 4, allocated_amount: 46250, spent_amount: 0, projected_amount: 43900 },
  { id: 'bt5', plan_id: 'p2', quarter: 1, allocated_amount: 15750, spent_amount: 2800, projected_amount: 15200 },
  { id: 'bt6', plan_id: 'p2', quarter: 2, allocated_amount: 15750, spent_amount: 0, projected_amount: 16800 },
  { id: 'bt7', plan_id: 'p2', quarter: 3, allocated_amount: 15750, spent_amount: 0, projected_amount: 15400 },
  { id: 'bt8', plan_id: 'p2', quarter: 4, allocated_amount: 15750, spent_amount: 0, projected_amount: 14600 },
];

// Dashboard Stats
export const dashboardStats: DashboardStats = {
  activePlans: 2,
  visitsThisMonth: 8,
  pendingVisits: 5,
  budgetUsed: 82420,
  totalBudget: 248000,
  anomalyCount: 1,
};

// Activity items for Observation Room
export const activityItems: ActivityItem[] = [
  { id: 'a1', location: locations[3], status: 'anomaly', measurementType: 'Basic Chemistry', assignee: 'Marko Novak', time: '2h ago', hasAnomaly: true, pipelineStatus: 'validated', lastPh: 5.2, phTrend: 'declining', phHistory: [7.1, 7.0, 6.8, 6.5, 6.2, 5.8, 5.5, 5.2, 0, 0, 0, 0] },
  { id: 'a2', location: locations[1], status: 'active', measurementType: 'Basic Chemistry', assignee: 'Marko Novak', time: '30min ago', hasAnomaly: false, pipelineStatus: 'sampled', lastPh: 6.8, phTrend: 'stable', phHistory: [6.9, 6.8, 6.9, 6.7, 6.8, 6.8, 0, 0, 0, 0, 0, 0] },
  { id: 'a3', location: locations[0], status: 'done', measurementType: 'Basic Chemistry', assignee: 'Marko Novak', time: '2d ago', hasAnomaly: false, pipelineStatus: 'validated', lastPh: 7.2, phTrend: 'stable', phHistory: [7.3, 7.2, 7.1, 7.2, 7.3, 7.2, 0, 0, 0, 0, 0, 0] },
  { id: 'a4', location: locations[2], status: 'done', measurementType: 'Basic Chemistry', assignee: 'Jan Krajnc', time: '3d ago', hasAnomaly: false, pipelineStatus: 'analyzed', lastPh: 7.6, phTrend: 'improving', phHistory: [7.3, 7.4, 7.4, 7.5, 7.5, 7.6, 0, 0, 0, 0, 0, 0] },
  { id: 'a5', location: locations[6], status: 'planned', measurementType: 'Basic Chemistry', assignee: 'Marko Novak', time: 'Mar 20', hasAnomaly: false, pipelineStatus: 'pending_sample', lastPh: 7.0, phTrend: 'stable', phHistory: [7.1, 7.0, 7.1, 7.0, 6.9, 7.0, 0, 0, 0, 0, 0, 0] },
  { id: 'a6', location: locations[8], status: 'planned', measurementType: 'Basic Chemistry', assignee: 'Marko Novak', time: 'Mar 22', hasAnomaly: false, pipelineStatus: 'pending_sample', lastPh: 7.1, phTrend: 'stable', phHistory: [7.2, 7.1, 7.0, 7.1, 7.2, 7.1, 0, 0, 0, 0, 0, 0] },
  { id: 'a7', location: locations[4], status: 'planned', measurementType: 'Basic Chemistry', assignee: 'Jan Krajnc', time: 'Apr 20', hasAnomaly: false, pipelineStatus: 'pending_sample', lastPh: 7.8, phTrend: 'stable', phHistory: [7.7, 7.8, 7.9, 7.8, 7.7, 7.8, 0, 0, 0, 0, 0, 0] },
  { id: 'a8', location: locations[9], status: 'planned', measurementType: 'Basic Chemistry', assignee: 'Jan Krajnc', time: 'May 10', hasAnomaly: false, pipelineStatus: 'pending_sample', lastPh: 7.9, phTrend: 'improving', phHistory: [7.6, 7.7, 7.7, 7.8, 7.8, 7.9, 0, 0, 0, 0, 0, 0] },
];

// Helper functions
export function getRatingColor(rating: Rating): string {
  const colors: Record<Rating, string> = {
    very_poor: '#ef4444',
    poor: '#f97316',
    moderate: '#eab308',
    good: '#22c55e',
    very_good: '#14b8a6',
  };
  return colors[rating];
}

export function getRatingLabel(rating: Rating): string {
  const labels: Record<Rating, string> = {
    very_poor: 'Very Poor',
    poor: 'Poor',
    moderate: 'Moderate',
    good: 'Good',
    very_good: 'Very Good',
  };
  return labels[rating];
}

export function getPipelineStageIndex(status: PipelineStatus): number {
  const stages: PipelineStatus[] = ['pending_sample', 'sampled', 'in_transit', 'in_lab', 'analyzed', 'validated'];
  return stages.indexOf(status);
}

export function getPipelineLabel(status: PipelineStatus): string {
  const labels: Record<PipelineStatus, string> = {
    pending_sample: 'Pending Sample',
    sampled: 'Sampled',
    in_transit: 'In Transit',
    in_lab: 'In Lab',
    analyzed: 'Analyzed',
    validated: 'Validated',
    rejected: 'Rejected',
  };
  return labels[status];
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    planned: '#94a3b8',
    in_progress: '#3b82f6',
    completed: '#22c55e',
    cancelled: '#ef4444',
    anomaly: '#ef4444',
    active: '#3b82f6',
    done: '#22c55e',
    draft: '#f59e0b',
  };
  return colors[status] || '#94a3b8';
}

// Monthly budget data for charts
export const monthlyBudgetData = [
  { month: 'Jan', analysis: 4200, logistics: 2100, target: 5000 },
  { month: 'Feb', analysis: 3800, logistics: 1900, target: 5000 },
  { month: 'Mar', analysis: 6420, logistics: 3200, target: 5200 },
  { month: 'Apr', analysis: 0, logistics: 0, target: 5400 },
  { month: 'May', analysis: 0, logistics: 0, target: 5400 },
  { month: 'Jun', analysis: 0, logistics: 0, target: 5000 },
  { month: 'Jul', analysis: 0, logistics: 0, target: 4800 },
  { month: 'Aug', analysis: 0, logistics: 0, target: 4600 },
  { month: 'Sep', analysis: 0, logistics: 0, target: 5200 },
  { month: 'Oct', analysis: 0, logistics: 0, target: 5000 },
  { month: 'Nov', analysis: 0, logistics: 0, target: 4800 },
  { month: 'Dec', analysis: 0, logistics: 0, target: 4600 },
];
