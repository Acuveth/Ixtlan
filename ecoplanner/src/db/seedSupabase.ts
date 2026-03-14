import { supabase } from './supabase';
import * as mock from '../data/mockData';
import { ALL_ENTRIES } from '../pages/PlanBuilder/planData';
import { generateHistoricalData } from './historicalData';

/**
 * Seeds the Supabase database with all initial data.
 * Safe to call multiple times — uses upsert throughout.
 * Always ensures all locations exist and have historical data.
 */
export async function seedSupabaseDatabase(): Promise<void> {
  // Always upsert locations first (idempotent, ensures all 100 exist)
  const locRows = mock.locations.map(l => ({
    id: l.id,
    code: l.code,
    name: l.name,
    latitude: l.latitude,
    longitude: l.longitude,
    environment_type: l.environment_type,
    rating: l.rating,
    description: l.description || null,
  }));

  // Batch upsert locations (Supabase has row limits)
  for (let i = 0; i < locRows.length; i += 500) {
    const batch = locRows.slice(i, i + 500);
    const { error } = await supabase.from('locations').upsert(batch);
    if (error) console.error(`[seed] locations batch ${i} error:`, error);
  }
  console.log(`[seed] Upserted ${locRows.length} locations`);

  // Check which locations are missing historical data
  const { data: existingHist } = await supabase
    .from('historical_measurements')
    .select('location_id')
    .limit(1000);
  const seededLocationIds = new Set((existingHist || []).map(h => h.location_id));
  const unseededLocations = mock.locations.filter(l => !seededLocationIds.has(l.id));

  if (unseededLocations.length > 0) {
    console.log(`[seed] Generating historical data for ${unseededLocations.length} new locations...`);
    const historical = generateHistoricalData(unseededLocations);
    for (let i = 0; i < historical.length; i += 500) {
      const batch = historical.slice(i, i + 500).map(h => ({
        id: h.id,
        location_id: h.location_id,
        measurement_type: h.measurement_type,
        date: h.date,
        year: h.year,
        results: h.results,
      }));
      const { error } = await supabase.from('historical_measurements').upsert(batch);
      if (error) console.error(`[seed] historical batch ${i} error:`, error);
    }
    console.log(`[seed] Inserted ${historical.length} historical measurements`);
  }

  // Check if remaining tables are already seeded
  const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
  if (userCount && userCount > 0) {
    console.log('[seed] Other tables already seeded, done');
    return;
  }

  console.log('[seed] Seeding remaining tables...');

  // 1. Users
  const { error: usersErr } = await supabase.from('users').upsert(
    mock.users.map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      created_at: u.created_at,
    }))
  );
  if (usersErr) console.error('[seed] users error:', usersErr);

  // 2. Measurement Templates
  const { error: mtErr } = await supabase.from('measurement_templates').upsert(
    mock.measurementTemplates.map(t => ({
      id: t.id,
      name: t.name,
      environment_type: t.environment_type,
      parameters: t.parameters,
      unit_cost: t.unit_cost,
      is_active: t.is_active,
    }))
  );
  if (mtErr) console.error('[seed] measurement_templates error:', mtErr);

  // 3. Monitoring Plans
  const { error: mpErr } = await supabase.from('monitoring_plans').upsert(
    mock.monitoringPlans.map(p => ({
      id: p.id,
      name: p.name,
      program_type: p.program_type,
      year: p.year,
      status: p.status,
      total_budget: p.total_budget,
      created_by: p.created_by,
      created_at: p.created_at,
    }))
  );
  if (mpErr) console.error('[seed] monitoring_plans error:', mpErr);

  // 4. Plan Entries
  const { error: peErr } = await supabase.from('plan_entries').upsert(
    mock.planEntries.map(e => ({
      id: e.id,
      plan_id: e.plan_id,
      location_id: e.location_id,
      measurement_template_id: e.measurement_template_id,
      frequency: e.frequency,
      frequency_override_reason: e.frequency_override_reason || null,
      default_assignee: e.default_assignee || null,
    }))
  );
  if (peErr) console.error('[seed] plan_entries error:', peErr);

  // 5. Visits
  const { error: vErr } = await supabase.from('visits').upsert(
    mock.visits.map(v => ({
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
    }))
  );
  if (vErr) console.error('[seed] visits error:', vErr);

  // 6. Measurements
  const { error: mErr } = await supabase.from('measurements').upsert(
    mock.measurements.map(m => ({
      id: m.id,
      location_id: m.location_id,
      measurement_template_id: m.measurement_template_id,
      plan_entry_id: m.plan_entry_id,
      visit_id: m.visit_id || null,
      assignee_id: m.assignee_id || null,
      recorded_by: m.recorded_by || null,
      status: m.status,
      pipeline_status: m.pipeline_status,
      results: m.results || null,
      planned_date: m.planned_date,
      measurement_date: m.measurement_date || null,
      analysis_cost: m.analysis_cost || null,
      lab_assignee_id: m.lab_assignee_id || null,
      lab_assigned_at: m.lab_assigned_at || null,
      validated_by: m.validated_by || null,
      validated_at: m.validated_at || null,
      notes: m.notes || null,
    }))
  );
  if (mErr) console.error('[seed] measurements error:', mErr);

  // 7. Notifications
  const { error: nErr } = await supabase.from('notifications').upsert(
    mock.notifications.map(n => ({
      id: n.id,
      user_id: n.user_id,
      type: n.type,
      title: n.title,
      body: n.body || null,
      related_entity_type: n.related_entity_type || null,
      related_entity_id: n.related_entity_id || null,
      is_read: n.is_read,
      created_at: n.created_at,
    }))
  );
  if (nErr) console.error('[seed] notifications error:', nErr);

  // 8. Budget Tracking
  const { error: btErr } = await supabase.from('budget_tracking').upsert(
    mock.budgetTracking.map(b => ({
      id: b.id,
      plan_id: b.plan_id,
      quarter: b.quarter,
      allocated_amount: b.allocated_amount,
      spent_amount: b.spent_amount,
      projected_amount: b.projected_amount || null,
    }))
  );
  if (btErr) console.error('[seed] budget_tracking error:', btErr);

  // 9. Dashboard Stats
  const { error: dsErr } = await supabase.from('dashboard_stats').upsert({
    id: 'stats',
    active_plans: mock.dashboardStats.activePlans,
    visits_this_month: mock.dashboardStats.visitsThisMonth,
    pending_visits: mock.dashboardStats.pendingVisits,
    budget_used: mock.dashboardStats.budgetUsed,
    total_budget: mock.dashboardStats.totalBudget,
    anomaly_count: mock.dashboardStats.anomalyCount,
  });
  if (dsErr) console.error('[seed] dashboard_stats error:', dsErr);

  // 10. Activity Items
  const { error: aiErr } = await supabase.from('activity_items').upsert(
    mock.activityItems.map(a => ({
      id: a.id,
      location_id: a.location.id,
      status: a.status,
      measurement_type: a.measurementType,
      assignee: a.assignee,
      time_label: a.time,
      has_anomaly: a.hasAnomaly,
      pipeline_status: a.pipelineStatus,
      last_ph: a.lastPh ?? null,
      ph_trend: a.phTrend ?? null,
      ph_history: a.phHistory ?? null,
    }))
  );
  if (aiErr) console.error('[seed] activity_items error:', aiErr);

  // 11. Monthly Budget Data
  const { error: mbErr } = await supabase.from('monthly_budget_data').upsert(
    mock.monthlyBudgetData.map((m, i) => ({
      id: `mb${i}`,
      month: m.month,
      analysis: m.analysis,
      logistics: m.logistics,
      target: m.target,
    }))
  );
  if (mbErr) console.error('[seed] monthly_budget_data error:', mbErr);

  // 12. Plan Builder Entries — insert in batches of 500
  const pbMapped = ALL_ENTRIES.map(e => ({
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

  for (let i = 0; i < pbMapped.length; i += 500) {
    const batch = pbMapped.slice(i, i + 500);
    const { error } = await supabase.from('plan_builder_entries').upsert(batch);
    if (error) console.error(`[seed] plan_builder_entries batch ${i} error:`, error);
  }
  console.log(`[seed] Inserted ${pbMapped.length} plan builder entries`);

  console.log('[seed] Supabase database seeded successfully!');
}
