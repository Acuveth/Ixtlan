import type { ChatAction } from '../types';
import type { User } from '../types';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY as string;
const MODEL = (import.meta.env.VITE_CLAUDE_MODEL as string) || 'claude-sonnet-4-20250514';

function buildSystemPrompt(user: User, dbContext?: string): string {
  const base = `You are an AI assistant for EcoPlanner, an environmental monitoring planning platform used by ARSO (Slovenian Environment Agency).

Current user: ${user.full_name}, role: ${user.role.replace('_', ' ')}
Today's date: March 14, 2026

${dbContext ? `\n=== LIVE DATABASE CONTEXT ===\n${dbContext}\n=== END DATABASE CONTEXT ===\n\nIMPORTANT: Use the live database context above to answer questions with real data. Always prefer this data over any hardcoded context below. When the user asks about locations, measurements, visits, budgets, or plans — refer to the actual data provided above.\n\n` : ''}
STRUCTURED OUTPUT RULES — you can embed special JSON blocks in your responses. The UI will parse these and render them as interactive cards.

1. MEASUREMENT CREATION (single or batch): When the user asks to create/schedule/add measurements, include a JSON block wrapped in \`\`\`json_measurements ... \`\`\` fences. The JSON must be an ARRAY of measurement objects:
[
  {
    "locationId": "location id (e.g. l1, l2)",
    "locationName": "human readable name",
    "measurementTemplateId": "template id (mt1=Basic Chemistry €120, mt2=Heavy Metals €350, mt3=Pesticides €280, mt4=Nutrients €180)",
    "measurementName": "template name",
    "assigneeId": "user id (e.g. u2=Marko Novak, u4=Jan Krajnc)",
    "assigneeName": "full name",
    "plannedDate": "YYYY-MM-DD",
    "frequency": "quarterly|biannual|annual",
    "estimatedCost": number,
    "rationale": "brief reason"
  }
]
For a single measurement, still use an array with one element. Use real IDs from the database context.

2. BUDGET OPTIMIZATION: When the user asks to optimize budget or find savings, include \`\`\`json_budget_suggestions ... \`\`\` with an array:
[
  {
    "type": "grouping|frequency_reduction|rebalancing|contractor",
    "title": "short title",
    "description": "what to do",
    "savings": number_in_euros,
    "risk": "low|medium|high",
    "reliability": number_0_to_100
  }
]

3. ANOMALY REPORT: When the user asks about anomalies or quality issues, include \`\`\`json_anomalies ... \`\`\` with an array:
[
  {
    "locationName": "name",
    "parameter": "e.g. pH, Dissolved Oxygen",
    "currentValue": number,
    "historicalAvg": number,
    "threshold": number,
    "severity": "warning|critical",
    "recommendation": "what to do",
    "reliability": number_0_to_100
  }
]

4. REPORT GENERATION: When the user asks to generate a report/summary, include \`\`\`json_report ... \`\`\` with:
{
  "title": "report title",
  "period": "e.g. Q1 2026",
  "sections": [
    { "heading": "section title", "content": "paragraph text" }
  ],
  "metrics": { "key": "value" },
  "reliability": number_0_to_100
}
When the user asks to export or download a report as PDF, still generate the json_report block — the UI has a built-in PDF export button on report cards.

5. FIELD NOTES: When the user provides messy field observations for interpretation, include \`\`\`json_field_notes ... \`\`\` with:
{
  "visual_observation": "structured text",
  "odor": "description or none",
  "sample_time": "HH:MM or unknown",
  "flow_condition": "description",
  "weather": "description or unknown",
  "flags": ["array", "of", "flags"],
  "reliability": number_0_to_100
}

RELIABILITY SCORE: Every structured output MUST include a "reliability" field (0-100). This represents your confidence in the result:
- 90-100: Based directly on real data from the database context
- 70-89: Based on data with some inference or estimation
- 50-69: Partially based on data, partially inferred
- Below 50: Mostly estimated or hypothetical
Always be honest about reliability. If data is sparse, score lower.

Only include these JSON blocks when relevant to the user's request. For general questions, respond normally.

ROLE-BASED PERMISSIONS — STRICTLY ENFORCE THESE:
- admin, planner: Can use ALL structured outputs (measurements, budget, anomalies, reports, field notes)
- analyst: Can use anomalies, reports, field notes. CANNOT create measurements or budget suggestions. If asked to create measurements, explain they need a planner role.
- field_worker: Can use field notes ONLY. CANNOT create measurements, budget suggestions, reports, or anomalies. If asked, explain they need to request through their planner.
- lab_worker: Can use anomalies ONLY. CANNOT create measurements, budget suggestions, reports, or field notes. If asked, explain they need to request through their planner.

The current user's role is: ${user.role}. NEVER generate structured JSON blocks that this role is not permitted to use.
`;

  if (user.role === 'field_worker') {
    return base + `You help field workers with their assigned monitoring tasks. You can ONLY help with:
- Viewing assigned visits and measurement schedules
- Understanding measurement protocols and parameters
- Tracking sample collection and pipeline status
- Navigation to monitoring locations
- Recording field observations and notes
- Understanding water quality parameters (pH, dissolved oxygen, conductivity, etc.)

You must NOT help with:
- Budget analysis or financial decisions
- Creating or modifying monitoring plans
- Administrative tasks like user management
- Approving or rejecting plans

Current system context:
- ${user.full_name} is assigned to multiple monitoring locations across Slovenia
- Active plans: River Monitoring 2026, Lake Monitoring 2026
- Measurement templates: Basic Chemistry (pH, DO, conductivity, temp), Heavy Metals, Pesticides, Nutrients
- Key locations: Sava-Ljubljana, Sava-Litija, Savinja-Celje, Drava-Maribor, Mura-Murska Sobota

Respond concisely and practically. Focus on field work guidance. Use € for currency. Reference real Slovenian locations.`;
  }

  if (user.role === 'lab_worker') {
    return base + `You help lab workers with their laboratory analysis tasks. You can ONLY help with:
- Understanding which samples are assigned to them and their priority
- Measurement protocols and analysis parameters (pH, dissolved oxygen, conductivity, heavy metals, pesticides, nutrients)
- Interpreting analysis results and identifying anomalies
- Understanding sample chain of custody (who collected, when, from where)
- Lab procedures and quality control
- Tracking sample pipeline status (in transit, in lab, analyzed, validated)

You must NOT help with:
- Budget analysis or financial decisions
- Creating or modifying monitoring plans
- Administrative tasks like user management
- Field work or sample collection procedures
- Approving or rejecting plans

Current system context:
- ${user.full_name} works in the ARSO laboratory analyzing environmental water samples
- Measurement templates: Basic Chemistry (pH, DO, conductivity, temp - €120), Heavy Metals (Pb, Hg, Cd, Zn - €350), Pesticides (atrazine, glyphosate - €280), Nutrients (NO3, PO4, NH3 - €180)
- Samples arrive from field workers across Slovenia's river and lake monitoring network
- Quality thresholds: pH 6.5-8.5, DO >6mg/L, conductivity <1000 μS/cm

Respond concisely and practically. Focus on lab analysis guidance, parameter ranges, and quality control. Use € for currency.`;
  }

  if (user.role === 'planner') {
    return base + `You help planners manage monitoring plans for rivers, lakes, and other water bodies across Slovenia. You can help with:
- Creating and managing monitoring plans
- Viewing visit schedules and measurement data
- Budget analysis and optimization
- Anomaly detection and alerts
- Generating reports

Current system context:
- 2 active plans: River Monitoring 2026 (€185k budget), Lake Monitoring 2026 (€63k budget)
- 15 monitoring locations across Slovenia
- 8 visits scheduled this month, 5 pending
- 1 anomaly: pH dropped to 5.2 at Savinja-Celje (historical avg 7.1)
- Budget: 33% utilized (€82k of €248k), on track
- Measurement templates: Basic Chemistry (€120), Heavy Metals (€350), Pesticides (€280), Nutrients (€180)
- Key locations: Sava-Ljubljana (moderate), Sava-Litija (poor), Drava-Maribor (good), Savinja-Celje (poor), Krka-Novo Mesto (good), Soča-Nova Gorica (very good)

Respond concisely and helpfully. Use € for currency. Reference real Slovenian locations and waterways. Keep answers focused and practical.`;
  }

  // Default for admin/analyst
  return base + `You help with environmental monitoring data analysis and management. Respond concisely. Use € for currency. Reference real Slovenian locations.`;
}

import type { MeasurementPreview } from '../types';

export interface BudgetSuggestion {
  type: 'grouping' | 'frequency_reduction' | 'rebalancing' | 'contractor';
  title: string;
  description: string;
  savings: number;
  risk: 'low' | 'medium' | 'high';
  reliability: number; // 0-100 confidence score
}

export interface AnomalyReport {
  locationName: string;
  parameter: string;
  currentValue: number;
  historicalAvg: number;
  threshold: number;
  severity: 'warning' | 'critical';
  recommendation: string;
  reliability: number;
}

export interface GeneratedReport {
  title: string;
  period: string;
  sections: { heading: string; content: string }[];
  metrics: Record<string, string>;
  reliability: number;
}

export interface FieldNotesResult {
  visual_observation: string;
  odor: string;
  sample_time: string;
  flow_condition: string;
  weather: string;
  flags: string[];
  reliability: number;
}

export interface AIResponse {
  text: string;
  actions: ChatAction[];
  measurementPreview?: MeasurementPreview;
  measurementPreviews?: MeasurementPreview[];
  budgetSuggestions?: BudgetSuggestion[];
  anomalies?: AnomalyReport[];
  report?: GeneratedReport;
  fieldNotes?: FieldNotesResult;
}

/** Extract all structured JSON blocks from AI response text */
function extractStructuredData(text: string): {
  cleanText: string;
  previews?: MeasurementPreview[];
  budgetSuggestions?: BudgetSuggestion[];
  anomalies?: AnomalyReport[];
  report?: GeneratedReport;
  fieldNotes?: FieldNotesResult;
} {
  let cleanText = text;
  let previews: MeasurementPreview[] | undefined;
  let budgetSuggestions: BudgetSuggestion[] | undefined;
  let anomalies: AnomalyReport[] | undefined;
  let report: GeneratedReport | undefined;
  let fieldNotes: FieldNotesResult | undefined;

  // Measurements (batch) — new format
  const measMatch = cleanText.match(/```json_measurements\s*([\s\S]*?)```/);
  if (measMatch) {
    try {
      const arr = JSON.parse(measMatch[1].trim());
      previews = (Array.isArray(arr) ? arr : [arr]).map((p: Record<string, unknown>) => ({
        locationId: (p.locationId as string) || '',
        locationName: (p.locationName as string) || '',
        measurementTemplateId: (p.measurementTemplateId as string) || '',
        measurementName: (p.measurementName as string) || '',
        assigneeId: (p.assigneeId as string) || '',
        assigneeName: (p.assigneeName as string) || '',
        plannedDate: (p.plannedDate as string) || '',
        frequency: (p.frequency as string) || 'quarterly',
        estimatedCost: Number(p.estimatedCost) || 0,
        rationale: (p.rationale as string) || '',
      }));
    } catch { /* ignore parse errors */ }
    cleanText = cleanText.replace(/```json_measurements\s*[\s\S]*?```/, '').trim();
  }

  // Single measurement — old format (backwards compat)
  if (!previews) {
    const singleMatch = cleanText.match(/```json_measurement\s*([\s\S]*?)```/);
    if (singleMatch) {
      try {
        const p = JSON.parse(singleMatch[1].trim());
        previews = [{
          locationId: p.locationId || '', locationName: p.locationName || '',
          measurementTemplateId: p.measurementTemplateId || '', measurementName: p.measurementName || '',
          assigneeId: p.assigneeId || '', assigneeName: p.assigneeName || '',
          plannedDate: p.plannedDate || '', frequency: p.frequency || 'quarterly',
          estimatedCost: p.estimatedCost || 0, rationale: p.rationale || '',
        }];
      } catch { /* ignore */ }
      cleanText = cleanText.replace(/```json_measurement\s*[\s\S]*?```/, '').trim();
    }
  }

  // Budget suggestions
  const budgetMatch = cleanText.match(/```json_budget_suggestions\s*([\s\S]*?)```/);
  if (budgetMatch) {
    try { budgetSuggestions = JSON.parse(budgetMatch[1].trim()); } catch { /* ignore */ }
    cleanText = cleanText.replace(/```json_budget_suggestions\s*[\s\S]*?```/, '').trim();
  }

  // Anomalies
  const anomalyMatch = cleanText.match(/```json_anomalies\s*([\s\S]*?)```/);
  if (anomalyMatch) {
    try { anomalies = JSON.parse(anomalyMatch[1].trim()); } catch { /* ignore */ }
    cleanText = cleanText.replace(/```json_anomalies\s*[\s\S]*?```/, '').trim();
  }

  // Report
  const reportMatch = cleanText.match(/```json_report\s*([\s\S]*?)```/);
  if (reportMatch) {
    try { report = JSON.parse(reportMatch[1].trim()); } catch { /* ignore */ }
    cleanText = cleanText.replace(/```json_report\s*[\s\S]*?```/, '').trim();
  }

  // Field notes
  const notesMatch = cleanText.match(/```json_field_notes\s*([\s\S]*?)```/);
  if (notesMatch) {
    try { fieldNotes = JSON.parse(notesMatch[1].trim()); } catch { /* ignore */ }
    cleanText = cleanText.replace(/```json_field_notes\s*[\s\S]*?```/, '').trim();
  }

  return { cleanText, previews, budgetSuggestions, anomalies, report, fieldNotes };
}

/** Detect contextual actions based on message content and user role */
function detectActions(userMessage: string, aiResponse: string, userRole: string): ChatAction[] {
  const actions: ChatAction[] = [];
  const lower = userMessage.toLowerCase() + ' ' + aiResponse.toLowerCase();

  if (userRole === 'lab_worker') {
    if (lower.includes('sample') || lower.includes('queue') || lower.includes('assigned') || lower.includes('priority')) {
      actions.push({
        id: 'view-lab-queue',
        label: 'View Lab Queue',
        icon: 'view',
        type: 'prompt',
        prompt: 'Show me the samples currently in my lab queue with their priority and status',
      });
    }
    if (lower.includes('parameter') || lower.includes('protocol') || lower.includes('range') || lower.includes('threshold')) {
      actions.push({
        id: 'view-parameters',
        label: 'View Parameters',
        icon: 'view',
        type: 'prompt',
        prompt: 'Show me the analysis parameters and acceptable ranges for this measurement template',
      });
    }
    if (lower.includes('anomal') || lower.includes('result') || lower.includes('abnormal') || lower.includes('out of range')) {
      actions.push({
        id: 'flag-anomaly',
        label: 'Flag Anomaly',
        icon: 'edit',
        type: 'prompt',
        prompt: 'Help me document an anomalous result found during laboratory analysis',
      });
    }
    return actions;
  }

  if (userRole === 'field_worker') {
    // Field worker actions: view schedule, check protocol, update status
    if (lower.includes('visit') || lower.includes('schedule') || lower.includes('assigned') || lower.includes('task')) {
      actions.push({
        id: 'view-my-schedule',
        label: 'View My Schedule',
        icon: 'view',
        type: 'prompt',
        prompt: 'Show my upcoming assigned visits with dates, locations, and measurement types',
      });
    }
    if (lower.includes('measurement') || lower.includes('sample') || lower.includes('protocol') || lower.includes('parameter')) {
      actions.push({
        id: 'view-protocol',
        label: 'View Protocol',
        icon: 'view',
        type: 'prompt',
        prompt: 'Show the measurement protocol and parameters I need to collect for my next visit',
      });
    }
    if (lower.includes('anomal') || lower.includes('alert') || lower.includes('ph') || lower.includes('critical')) {
      actions.push({
        id: 'report-observation',
        label: 'Report Observation',
        icon: 'edit',
        type: 'prompt',
        prompt: 'Help me document a field observation or anomaly at my current location',
      });
    }
    return actions;
  }

  // Planner/admin actions (original logic)
  if (lower.includes('monitoring plan') || lower.includes('create') && lower.includes('plan') || lower.includes('new plan')) {
    actions.push({
      id: 'gen-measurements',
      label: 'Generate Measurements',
      icon: 'generate',
      type: 'prompt',
      prompt: 'Generate the full measurement schedule for this plan with dates, locations, and measurement types',
    });
    actions.push({
      id: 'assign-team',
      label: 'Assign Team',
      icon: 'assign',
      type: 'dropdown',
      options: [
        { label: 'Marko Novak (Field)', value: 'u2', prompt: 'Assign Marko Novak as the primary field worker for this monitoring plan' },
        { label: 'Jan Krajnc (Field)', value: 'u4', prompt: 'Assign Jan Krajnc as the primary field worker for this monitoring plan' },
        { label: 'Petra Horvat (Analyst)', value: 'u3', prompt: 'Assign Petra Horvat as the analyst for this monitoring plan' },
        { label: 'Auto-assign all', value: 'auto', prompt: 'Auto-assign team members to all visits based on location proximity and workload balance' },
      ],
    });
    actions.push({
      id: 'edit-locations',
      label: 'Edit Locations',
      icon: 'edit',
      type: 'prompt',
      prompt: 'Show me the list of locations in this plan so I can modify them',
    });
    actions.push({
      id: 'approve-plan',
      label: 'Approve & Activate',
      icon: 'approve',
      type: 'prompt',
      prompt: 'Approve this monitoring plan and set its status to active',
    });
  }

  if (lower.includes('report') || lower.includes('quarterly') || lower.includes('summary')) {
    if (!actions.find(a => a.id === 'gen-measurements')) {
      actions.push({
        id: 'export-report',
        label: 'Export as PDF',
        icon: 'generate',
        type: 'prompt',
        prompt: 'Export this report as a formatted PDF document',
      });
    }
    actions.push({
      id: 'schedule-report',
      label: 'Schedule Reports',
      icon: 'schedule',
      type: 'prompt',
      prompt: 'Set up automatic quarterly report generation for this monitoring plan',
    });
  }

  if (lower.includes('anomal') || lower.includes('alert') || lower.includes('critical') || lower.includes('poor')) {
    actions.push({
      id: 'schedule-urgent',
      label: 'Schedule Urgent Visit',
      icon: 'schedule',
      type: 'prompt',
      prompt: 'Schedule an urgent monitoring visit to investigate the anomaly at the flagged location',
    });
  }

  if (lower.includes('budget') || lower.includes('cost') || lower.includes('€')) {
    if (!actions.find(a => a.id.includes('budget'))) {
      actions.push({
        id: 'view-budget',
        label: 'View Budget Breakdown',
        icon: 'budget',
        type: 'prompt',
        prompt: 'Show me a detailed budget breakdown by location and measurement type for this plan',
      });
    }
  }

  if (lower.includes('measurement') || lower.includes('visit') || lower.includes('schedule')) {
    if (!actions.find(a => a.id === 'gen-measurements')) {
      actions.push({
        id: 'view-schedule',
        label: 'View Full Schedule',
        icon: 'view',
        type: 'prompt',
        prompt: 'Show the complete visit schedule with dates, locations, and assigned team members',
      });
    }
  }

  return actions;
}

export async function queryAI(message: string, history: { role: string; content: string }[], user?: User, dbContext?: string): Promise<AIResponse> {
  if (!API_KEY) {
    return {
      text: 'AI assistant is not configured. Please set the VITE_CLAUDE_API_KEY environment variable.',
      actions: [],
    };
  }

  const systemPrompt = user ? buildSystemPrompt(user, dbContext) : buildSystemPrompt({
    id: 'u1', email: 'ana.kovac@arso.si', full_name: 'Ana Kovač', role: 'planner', created_at: '',
  }, dbContext);

  const messages = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: message },
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      return {
        text: `Sorry, I encountered an error (${response.status}). Please try again.`,
        actions: [],
      };
    }

    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
    const rawText = textBlock?.text || 'No response generated.';
    const extracted = extractStructuredData(rawText);
    const role = user?.role || 'planner';
    const actions = detectActions(message, extracted.cleanText, role);

    // Enforce role permissions — strip unauthorized structured outputs
    const canCreateMeasurements = role === 'admin' || role === 'planner';
    const canBudget = role === 'admin' || role === 'planner';
    const canAnomalies = role === 'admin' || role === 'planner' || role === 'analyst' || role === 'lab_worker';
    const canReports = role === 'admin' || role === 'planner' || role === 'analyst';
    const canFieldNotes = role === 'admin' || role === 'planner' || role === 'field_worker';

    const previews = canCreateMeasurements ? extracted.previews : undefined;

    return {
      text: extracted.cleanText,
      actions,
      measurementPreview: previews?.[0],
      measurementPreviews: previews,
      budgetSuggestions: canBudget ? extracted.budgetSuggestions : undefined,
      anomalies: canAnomalies ? extracted.anomalies : undefined,
      report: canReports ? extracted.report : undefined,
      fieldNotes: canFieldNotes ? extracted.fieldNotes : undefined,
    };
  } catch (err) {
    console.error('AI query failed:', err);
    return {
      text: 'Sorry, I could not connect to the AI service. Please check your connection and try again.',
      actions: [],
    };
  }
}
