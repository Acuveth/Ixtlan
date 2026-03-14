import { useState, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';

// Seeded PRNG for deterministic past-year budget data
function mulberry32(seed: number) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEAR_MIN = 2020;
const YEAR_MAX = 2026;

interface YearBudget {
  totalBudget: number;
  spent: number;
  projected: number;
  pctUsed: number;
  overBudget: boolean;
  overPct: number;
  activePlans: number;
  months: { month: string; analysis: number; logistics: number }[];
  programs: { name: string; budget: number; spent: number; pct: number; color: string; status: string }[];
}

function generatePastYear(year: number): YearBudget {
  const rng = mulberry32(year * 7919);
  const r = () => rng();

  const programNames = ['River Monitoring', 'Lake Monitoring', 'Sea Monitoring', 'Soil Monitoring'];
  const programBudgets = [
    140000 + Math.round(r() * 60000),
    45000 + Math.round(r() * 30000),
    20000 + Math.round(r() * 15000),
    15000 + Math.round(r() * 10000),
  ];
  const totalBudget = programBudgets.reduce((a, b) => a + b, 0);

  const programs = programNames.map((name, idx) => {
    const budget = programBudgets[idx];
    const spendRatio = 0.75 + r() * 0.35; // 75-110% spent
    const spent = Math.round(budget * spendRatio);
    const pct = Math.round((spent / budget) * 100);
    const isOver = pct > 100;
    return {
      name: `${name} ${year}`,
      budget,
      spent,
      pct: Math.min(pct, 100),
      color: isOver ? '#BA7517' : '#639922',
      status: isOver ? 'Over budget' : pct > 90 ? 'Near limit' : 'On track',
    };
  });

  const spent = programs.reduce((s, p) => s + p.spent, 0);
  const projected = spent; // past year is complete
  const pctUsed = Math.round((spent / totalBudget) * 100);

  const months = MONTH_NAMES.map(m => {
    const base = totalBudget / 12;
    const analysis = Math.round(base * (0.5 + r() * 0.4));
    const logistics = Math.round(base * (0.15 + r() * 0.2));
    return { month: m, analysis, logistics };
  });

  return {
    totalBudget, spent, projected, pctUsed,
    overBudget: spent > totalBudget,
    overPct: Math.round(((spent - totalBudget) / totalBudget) * 100),
    activePlans: programs.length,
    months,
    programs,
  };
}

export default function BudgetDashboard() {
  const db = useDatabase();
  const [year, setYear] = useState(YEAR_MAX);

  const prevYear = () => setYear(y => Math.max(YEAR_MIN, y - 1));
  const nextYear = () => setYear(y => Math.min(YEAR_MAX, y + 1));

  // Current year uses live DB data, past years use generated data
  const data = useMemo<YearBudget>(() => {
    if (year === YEAR_MAX) {
      const totalBudget = db.monitoringPlans
        .filter(p => p.status === 'active')
        .reduce((sum, p) => sum + p.total_budget, 0);
      const spent = db.budgetTracking.reduce((sum, b) => sum + b.spent_amount, 0);
      const projected = db.budgetTracking.reduce((sum, b) => sum + (b.projected_amount || b.allocated_amount), 0);
      const pctUsed = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;
      const overBudget = projected > totalBudget;
      const overPct = totalBudget > 0 ? Math.round(((projected - totalBudget) / totalBudget) * 100) : 0;

      const months = db.monthlyBudgetData.map(m => ({
        month: m.month,
        analysis: m.analysis,
        logistics: m.logistics,
      }));

      const programs = db.monitoringPlans
        .filter(p => p.status === 'active')
        .map(plan => {
          const planBudget = db.budgetTracking.filter(b => b.plan_id === plan.id);
          const s = planBudget.reduce((sum, b) => sum + b.spent_amount, 0);
          const pct = plan.total_budget > 0 ? Math.round((s / plan.total_budget) * 100) : 0;
          const proj = planBudget.reduce((sum, b) => sum + (b.projected_amount || b.allocated_amount), 0);
          const isOver = proj > plan.total_budget;
          return {
            name: plan.name,
            budget: plan.total_budget,
            spent: s,
            pct,
            color: isOver ? '#BA7517' : '#639922',
            status: isOver ? 'Slight over' : 'On track',
          };
        });

      return {
        totalBudget, spent, projected, pctUsed, overBudget, overPct,
        activePlans: db.monitoringPlans.filter(p => p.status === 'active').length,
        months, programs,
      };
    }
    return generatePastYear(year);
  }, [year, db.monitoringPlans, db.budgetTracking, db.monthlyBudgetData]);

  // Chart scaling
  const chartMonths = useMemo(() => {
    const maxSpend = Math.max(...data.months.map(m => m.analysis + m.logistics), 1);
    return data.months.map(m => {
      const total = m.analysis + m.logistics;
      return {
        name: m.month,
        analysis: Math.round((m.analysis / maxSpend) * 85),
        logistics: Math.round((m.logistics / maxSpend) * 85),
        total: total > 0 ? `\u20AC${Math.round(total / 1000)}k` : '',
      };
    });
  }, [data.months]);

  const monthlyTarget = data.totalBudget > 0
    ? `\u20AC${Math.round(data.totalBudget / 12 / 1000)}k`
    : '';

  const isCurrentYear = year === YEAR_MAX;

  return (
    <>
      <style>{`
.budget{font-family:var(--font-sans);padding:1.5rem;width:100%}
.budget-top{display:flex;align-items:center;gap:12px;margin-bottom:1.5rem}
.budget-title{font-size:16px;font-weight:500;color:var(--color-text-primary)}
.budget-year-nav{display:flex;align-items:center;gap:0;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);overflow:hidden}
.budget-year-btn{border:none;background:transparent;cursor:pointer;padding:4px 8px;font-size:13px;color:var(--color-text-secondary);font-family:var(--font-sans);transition:.12s}
.budget-year-btn:hover:not(:disabled){background:var(--color-background-secondary)}
.budget-year-btn:disabled{opacity:.3;cursor:default}
.budget-year-label{font-size:12px;font-weight:500;padding:4px 10px;color:var(--color-text-primary);min-width:44px;text-align:center;border-left:0.5px solid var(--color-border-tertiary);border-right:0.5px solid var(--color-border-tertiary)}
.budget-year-current{font-size:10px;padding:2px 8px;border-radius:var(--border-radius-md);background:var(--color-background-info);color:var(--color-text-info);margin-left:4px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.5rem}
.metric{background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:12px 14px}
.metric-label{font-size:11px;color:var(--color-text-secondary);margin-bottom:4px}
.metric-val{font-size:20px;font-weight:500;color:var(--color-text-primary)}
.metric-sub{font-size:11px;margin-top:2px}
.g{color:#639922}.w{color:#BA7517}.b{color:#E24B4A}
.chart-section{margin-bottom:1.5rem}
.chart-label{font-size:12px;font-weight:500;color:var(--color-text-secondary);margin-bottom:10px}
.bar-chart{display:flex;align-items:flex-end;gap:8px;height:140px;padding-bottom:24px;position:relative;border-bottom:0.5px solid var(--color-border-tertiary)}
.bar-group{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;height:100%}
.bar-stack{display:flex;flex-direction:column;justify-content:flex-end;width:100%;height:100%;gap:1px}
.bar{border-radius:3px 3px 0 0;min-height:2px;transition:height .3s}
.bar-analysis{background:#378ADD}
.bar-logistics{background:#85B7EB}
.bar-month{font-size:10px;color:var(--color-text-secondary);text-align:center;position:absolute;bottom:-20px}
.bar-val{font-size:9px;color:var(--color-text-secondary);text-align:center}
.bar-legend{display:flex;gap:14px;justify-content:center;margin-top:12px;font-size:11px;color:var(--color-text-secondary)}
.bar-legend-item{display:flex;align-items:center;gap:4px}
.bar-legend-dot{width:8px;height:8px;border-radius:2px}
.budget-line{position:absolute;top:15%;left:0;right:0;border-top:1.5px dashed var(--color-border-info);z-index:1}
.budget-line-label{position:absolute;right:0;top:-14px;font-size:9px;color:var(--color-text-info)}
.program-table{width:100%;border-collapse:collapse;margin-bottom:1.5rem}
.program-table th{text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);padding:8px 10px;border-bottom:0.5px solid var(--color-border-tertiary)}
.program-table td{font-size:12px;padding:8px 10px;border-bottom:0.5px solid var(--color-border-tertiary);color:var(--color-text-primary)}
.prog-bar-bg{height:6px;border-radius:3px;background:var(--color-border-tertiary);width:100%;overflow:hidden}
.prog-bar-fill{height:100%;border-radius:3px}
@media(max-width:600px){.metrics{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <div className="budget">
        <div className="budget-top">
          <div className="budget-title">Budget overview</div>
          <div className="budget-year-nav">
            <button className="budget-year-btn" onClick={prevYear} disabled={year <= YEAR_MIN}>&lsaquo;</button>
            <div className="budget-year-label">{year}</div>
            <button className="budget-year-btn" onClick={nextYear} disabled={year >= YEAR_MAX}>&rsaquo;</button>
          </div>
          {isCurrentYear && <span className="budget-year-current">Current</span>}
        </div>

        <div className="metrics">
          <div className="metric">
            <div className="metric-label">Total budget</div>
            <div className="metric-val">&euro;{Math.round(data.totalBudget / 1000)}k</div>
          </div>
          <div className="metric">
            <div className="metric-label">{isCurrentYear ? 'Spent to date' : 'Total spent'}</div>
            <div className="metric-val">&euro;{Math.round(data.spent / 1000)}k</div>
            <div className={`metric-sub ${data.pctUsed <= 100 ? 'g' : 'w'}`}>
              {data.pctUsed <= 100 ? 'On track' : 'Over budget'} ({data.pctUsed}%)
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">{isCurrentYear ? 'Projected total' : 'Final total'}</div>
            <div className="metric-val">&euro;{Math.round(data.projected / 1000)}k</div>
            <div className={`metric-sub ${data.overBudget ? 'w' : 'g'}`}>
              {data.overBudget ? `+${data.overPct}% over budget` : 'Within budget'}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">{isCurrentYear ? 'Active plans' : 'Programs'}</div>
            <div className="metric-val">{data.activePlans}</div>
          </div>
        </div>

        <div className="chart-section">
          <div className="chart-label">Monthly spend &middot; {year}</div>
          <div className="bar-chart">
            <div className="budget-line">
              <span className="budget-line-label">Monthly target: {monthlyTarget}</span>
            </div>
            {chartMonths.map((m) => (
              <div className="bar-group" key={m.name}>
                {m.total && <div className="bar-val">{m.total}</div>}
                <div className="bar-stack">
                  {m.analysis > 0 && <div className="bar bar-analysis" style={{ height: `${m.analysis}%` }} />}
                  {m.logistics > 0 && <div className="bar bar-logistics" style={{ height: `${m.logistics}%` }} />}
                </div>
                <div className="bar-month">{m.name}</div>
              </div>
            ))}
          </div>
          <div className="bar-legend">
            <div className="bar-legend-item"><div className="bar-legend-dot" style={{ background: '#378ADD' }} />Analysis costs</div>
            <div className="bar-legend-item"><div className="bar-legend-dot" style={{ background: '#85B7EB' }} />Logistics costs</div>
            <div className="bar-legend-item"><div className="bar-legend-dot" style={{ background: 'transparent', borderTop: '1.5px dashed var(--color-border-info)', borderRadius: 0, height: 0, alignSelf: 'center', width: 12 }} />Monthly target</div>
          </div>
        </div>

        <table className="program-table">
          <thead>
            <tr><th>Program</th><th>Budget</th><th>Spent</th><th>Progress</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.programs.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>&euro;{Math.round(p.budget / 1000)}k</td>
                <td>&euro;{Math.round(p.spent / 1000)}k</td>
                <td>
                  <div className="prog-bar-bg">
                    <div className="prog-bar-fill" style={{ width: `${p.pct}%`, background: p.color }} />
                  </div>
                </td>
                <td style={{ color: p.color }}>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
