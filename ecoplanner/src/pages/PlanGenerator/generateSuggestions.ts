import type { PlanSuggestion, Frequency } from '../../types';
import {
  measurements,
  locations,
  measurementTemplates,
  planEntries,
  visits,
} from '../../data/mockData';

// Water quality thresholds (EU/Slovenian standards)
const THRESHOLDS: Record<string, { min: number; max: number }> = {
  ph: { min: 6.5, max: 8.5 },
  oxygen: { min: 6.0, max: 14.0 },
  conductivity: { min: 0, max: 500 },
  nitrate: { min: 0, max: 25 },
  phosphate: { min: 0, max: 1.0 },
  ammonia: { min: 0, max: 0.5 },
  lead: { min: 0, max: 10 },
  mercury: { min: 0, max: 1 },
  cadmium: { min: 0, max: 5 },
  zinc: { min: 0, max: 200 },
};

const FREQ_UPGRADE: Record<Frequency, Frequency> = {
  triennial: 'annual',
  biennial: 'annual',
  annual: 'biannual',
  biannual: 'quarterly',
  quarterly: 'quarterly',
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

let idCounter = 0;
function nextId(): string {
  return `sg-${++idCounter}`;
}

export function generateSuggestions(): PlanSuggestion[] {
  idCounter = 0;
  const suggestions: PlanSuggestion[] = [];
  const today = '2026-03-14';

  // ── Rule 1: Anomaly detection (critical) ──
  const completedWithResults = measurements.filter(
    m => m.results && Object.keys(m.results).length > 0 && (m.status === 'completed' || m.pipeline_status === 'validated' || m.pipeline_status === 'analyzed')
  );

  for (const m of completedWithResults) {
    const loc = locations.find(l => l.id === m.location_id);
    const tmpl = measurementTemplates.find(t => t.id === m.measurement_template_id);
    if (!m.results || !loc || !tmpl) continue;

    const violations: string[] = [];
    for (const [key, value] of Object.entries(m.results)) {
      const threshold = THRESHOLDS[key];
      if (!threshold) continue;
      if (value < threshold.min) violations.push(`${key} ${value} below minimum ${threshold.min}`);
      if (value > threshold.max) violations.push(`${key} ${value} above maximum ${threshold.max}`);
    }

    if (violations.length > 0) {
      // Check if we already have a suggestion for this location+template
      const existing = suggestions.find(s => s.locationIds[0] === loc.id && s.measurementTemplateId === tmpl.id && s.source === 'auto_anomaly');
      if (!existing) {
        const entry = planEntries.find(pe => pe.location_id === loc.id && pe.measurement_template_id === tmpl.id);
        suggestions.push({
          id: nextId(),
          locationIds: [loc.id],
          measurementTemplateId: tmpl.id,
          proposedDate: addDays(today, 7),
          proposedFrequency: 'quarterly',
          assigneeId: entry?.default_assignee ?? 'u2',
          estimatedCost: tmpl.unit_cost + 130,
          priority: 'critical',
          source: 'auto_anomaly',
          rationale: `Anomalous values detected at ${loc.name}: ${violations.join('; ')}. Urgent re-monitoring recommended within 14 days.`,
          action: 'pending',
        });
      }
    }
  }

  // ── Rule 2: Rating-based frequency upgrade (high) ──
  const poorLocations = locations.filter(l => l.rating === 'poor' || l.rating === 'very_poor');
  for (const loc of poorLocations) {
    const entries = planEntries.filter(pe => pe.location_id === loc.id);
    for (const entry of entries) {
      const upgraded = FREQ_UPGRADE[entry.frequency];
      if (upgraded === entry.frequency) continue; // already at max
      const tmpl = measurementTemplates.find(t => t.id === entry.measurement_template_id);
      if (!tmpl) continue;
      // Don't duplicate anomaly suggestions
      const hasAnomaly = suggestions.find(s => s.locationIds[0] === loc.id && s.measurementTemplateId === tmpl.id && s.source === 'auto_anomaly');
      if (hasAnomaly) continue;

      suggestions.push({
        id: nextId(),
        locationIds: [loc.id],
        measurementTemplateId: tmpl.id,
        proposedDate: addDays(today, 21),
        proposedFrequency: upgraded,
        assigneeId: entry.default_assignee ?? 'u2',
        estimatedCost: tmpl.unit_cost + 120,
        priority: 'high',
        source: 'auto_rating',
        rationale: `${loc.name} has "${loc.rating.replace('_', ' ')}" rating. Recommend upgrading ${tmpl.name} frequency from ${entry.frequency} to ${upgraded}.`,
        action: 'pending',
      });
    }
  }

  // ── Rule 3: Pattern continuation (medium) ──
  // For each active plan entry, look at completed measurements and suggest next scheduled one
  const activePlanIds = ['p1', 'p2'];
  const activeEntries = planEntries.filter(pe => activePlanIds.includes(pe.plan_id));

  for (const entry of activeEntries) {
    const loc = locations.find(l => l.id === entry.location_id);
    const tmpl = measurementTemplates.find(t => t.id === entry.measurement_template_id);
    if (!loc || !tmpl) continue;

    // Find latest completed measurement for this entry
    const entryMeasurements = measurements.filter(m => m.plan_entry_id === entry.id && (m.status === 'completed' || m.pipeline_status === 'validated' || m.pipeline_status === 'analyzed'));
    if (entryMeasurements.length === 0) continue;

    const latestDate = entryMeasurements
      .map(m => m.measurement_date || m.planned_date)
      .sort()
      .pop()!;

    // Calculate next date based on frequency
    const freqDays: Record<Frequency, number> = {
      quarterly: 90,
      biannual: 182,
      annual: 365,
      biennial: 730,
      triennial: 1095,
    };
    const nextDate = addDays(latestDate, freqDays[entry.frequency]);

    // Skip if next date is in the past or already has a planned measurement
    if (nextDate < today) continue;
    const alreadyPlanned = measurements.find(m => m.plan_entry_id === entry.id && m.status === 'planned' && m.planned_date === nextDate);
    if (alreadyPlanned) continue;

    // Skip if we already have a suggestion for this location+template from rules 1-2
    const hasSuggestion = suggestions.find(s => s.locationIds[0] === loc.id && s.measurementTemplateId === tmpl.id);
    if (hasSuggestion) continue;

    suggestions.push({
      id: nextId(),
      locationIds: [loc.id],
      measurementTemplateId: tmpl.id,
      proposedDate: nextDate,
      proposedFrequency: entry.frequency,
      assigneeId: entry.default_assignee ?? 'u2',
      estimatedCost: tmpl.unit_cost + 100,
      priority: 'medium',
      source: 'auto_pattern',
      rationale: `Routine ${entry.frequency} ${tmpl.name} measurement at ${loc.name}. Last sampled ${latestDate}.`,
      action: 'pending',
    });
  }

  // ── Rule 4: Geographic clustering (low) ──
  // Find locations that are close together and have measurements scheduled in similar time windows
  const mediumSuggestions = suggestions.filter(s => s.priority === 'medium' || s.priority === 'high');
  const clusters: { ids: string[]; savings: number }[] = [];
  const clustered = new Set<string>();

  for (let i = 0; i < locations.length; i++) {
    if (clustered.has(locations[i].id)) continue;
    const group = [locations[i]];
    for (let j = i + 1; j < locations.length; j++) {
      if (clustered.has(locations[j].id)) continue;
      const dist = haversineKm(locations[i].latitude, locations[i].longitude, locations[j].latitude, locations[j].longitude);
      if (dist < 35) {
        group.push(locations[j]);
      }
    }
    if (group.length >= 2) {
      const ids = group.map(l => l.id);
      ids.forEach(id => clustered.add(id));
      const savings = Math.round(group.length * 45); // ~€45 logistics savings per grouped location
      clusters.push({ ids, savings });
    }
  }

  for (const cluster of clusters) {
    const clusterLocs = cluster.ids.map(id => locations.find(l => l.id === id)!).filter(Boolean);
    const names = clusterLocs.map(l => l.name).join(', ');
    // Find a common measurement template (Basic Chemistry is universal)
    const tmpl = measurementTemplates.find(t => t.id === 'mt1')!;
    // Find the earliest suggestion date among these locations
    const relatedSuggestions = mediumSuggestions.filter(s => cluster.ids.some(id => s.locationIds.includes(id)));
    const earliestDate = relatedSuggestions.length > 0
      ? relatedSuggestions.map(s => s.proposedDate).sort()[0]
      : addDays(today, 30);

    suggestions.push({
      id: nextId(),
      locationIds: cluster.ids,
      measurementTemplateId: tmpl.id,
      proposedDate: earliestDate,
      proposedFrequency: 'biannual',
      assigneeId: 'u2',
      estimatedCost: clusterLocs.length * tmpl.unit_cost + 150 - cluster.savings,
      priority: 'low',
      source: 'auto_cluster',
      rationale: `Group visit: ${names}. Combining reduces logistics by ~€${cluster.savings}. ${clusterLocs.length} locations within 35km.`,
      action: 'pending',
    });
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions;
}
