export type UserRole = 'admin' | 'planner' | 'field_worker' | 'lab_worker' | 'analyst';
export type EnvironmentType = 'water' | 'soil' | 'air' | 'organisms';
export type Rating = 'very_poor' | 'poor' | 'moderate' | 'good' | 'very_good';
export type PlanStatus = 'draft' | 'active' | 'completed';
export type VisitStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type MeasurementStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type PipelineStatus = 'pending_sample' | 'sampled' | 'in_transit' | 'in_lab' | 'analyzed' | 'validated' | 'rejected';
export type Frequency = 'quarterly' | 'biannual' | 'annual' | 'biennial' | 'triennial';
export type ProgramType = 'river' | 'lake' | 'sea' | 'soil' | 'air';
export type NotificationType = 'assignment' | 'reschedule' | 'anomaly' | 'budget_alert' | 'approval_needed';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  environment_type: EnvironmentType;
  rating: Rating;
  description?: string;
}

export interface MeasurementTemplate {
  id: string;
  name: string;
  environment_type: EnvironmentType;
  parameters: Parameter[];
  unit_cost: number;
  is_active: boolean;
}

export interface Parameter {
  key: string;
  label: string;
  unit: string;
  type: string;
  min?: number;
  max?: number;
}

export interface MonitoringPlan {
  id: string;
  name: string;
  program_type: ProgramType;
  year: number;
  status: PlanStatus;
  total_budget: number;
  created_by: string;
  created_at: string;
}

export interface PlanEntry {
  id: string;
  plan_id: string;
  location_id: string;
  measurement_template_id: string;
  frequency: Frequency;
  frequency_override_reason?: string;
  default_assignee?: string;
  location?: Location;
  template?: MeasurementTemplate;
}

export interface Visit {
  id: string;
  plan_id: string;
  location_id: string;
  planned_date: string;
  status: VisitStatus;
  logistics_cost?: number;
  assigned_to?: string;
  route_order?: number;
  cancellation_reason?: string;
  notes?: string;
  location?: Location;
  assignee?: User;
  measurements?: Measurement[];
}

export interface Measurement {
  id: string;
  location_id: string;
  measurement_template_id: string;
  plan_entry_id: string;
  visit_id?: string;
  assignee_id?: string;
  recorded_by?: string;
  status: MeasurementStatus;
  pipeline_status: PipelineStatus;
  results?: Record<string, number>;
  planned_date: string;
  measurement_date?: string;
  analysis_cost?: number;
  lab_assignee_id?: string;
  lab_assigned_at?: string;
  validated_by?: string;
  validated_at?: string;
  notes?: string;
  location?: Location;
  template?: MeasurementTemplate;
  assignee?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface BudgetTracking {
  id: string;
  plan_id: string;
  quarter: number;
  allocated_amount: number;
  spent_amount: number;
  projected_amount?: number;
}

export interface ChatAction {
  id: string;
  label: string;
  icon: 'generate' | 'assign' | 'edit' | 'approve' | 'schedule' | 'budget' | 'view';
  type: 'prompt' | 'dropdown';
  prompt?: string;
  options?: { label: string; value: string; prompt: string }[];
}

export interface MeasurementPreview {
  locationId: string;
  locationName: string;
  measurementTemplateId: string;
  measurementName: string;
  assigneeId: string;
  assigneeName: string;
  plannedDate: string;
  frequency: string;
  estimatedCost: number;
  rationale: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  cards?: ChatCard[];
  actions?: ChatAction[];
  measurementPreview?: MeasurementPreview;
  measurementPreviews?: MeasurementPreview[];
  budgetSuggestions?: unknown[];
  anomalies?: unknown[];
  report?: unknown;
  fieldNotes?: unknown;
}

export interface ChatCard {
  type: 'stats' | 'table' | 'plan_preview' | 'suggestions' | 'tasks';
  title: string;
  data: unknown;
}

export interface DashboardStats {
  activePlans: number;
  visitsThisMonth: number;
  pendingVisits: number;
  budgetUsed: number;
  totalBudget: number;
  anomalyCount: number;
}

// Plan Generator types
export type SuggestionPriority = 'critical' | 'high' | 'medium' | 'low';
export type SuggestionSource = 'auto_anomaly' | 'auto_rating' | 'auto_pattern' | 'auto_cluster' | 'manual';
export type SuggestionAction = 'pending' | 'confirmed' | 'modified' | 'declined';

export interface PlanSuggestion {
  id: string;
  locationIds: string[];
  measurementTemplateId: string;
  proposedDate: string;
  proposedFrequency: Frequency;
  assigneeId: string;
  estimatedCost: number;
  priority: SuggestionPriority;
  source: SuggestionSource;
  rationale: string;
  action: SuggestionAction;
  declineReason?: string;
  autoApproveSimilar?: boolean;
  modifiedFrequency?: Frequency;
  modifiedDate?: string;
  modifiedAssigneeId?: string;
}

export interface ActivityItem {
  id: string;
  location: Location;
  status: 'planned' | 'active' | 'done' | 'anomaly';
  measurementType: string;
  assignee: string;
  time: string;
  hasAnomaly: boolean;
  pipelineStatus: PipelineStatus;
  lastPh?: number;
  phTrend?: 'declining' | 'stable' | 'improving';
  phHistory?: number[];
}
