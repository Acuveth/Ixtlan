import { useState, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';

type Tab = 'users' | 'locations' | 'templates' | 'rules';

export default function AdminPanel() {
  const db = useDatabase();
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');

  const q = search.toLowerCase();

  const filteredUsers = useMemo(() =>
    db.users.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    [db.users, q]
  );

  const filteredLocations = useMemo(() =>
    db.locations.filter(l => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)),
    [db.locations, q]
  );

  const filteredTemplates = useMemo(() =>
    db.measurementTemplates.filter(t => t.name.toLowerCase().includes(q)),
    [db.measurementTemplates, q]
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'users', label: 'Users', count: db.users.length },
    { key: 'locations', label: 'Locations', count: db.locations.length },
    { key: 'templates', label: 'Templates', count: db.measurementTemplates.length },
    { key: 'rules', label: 'Frequency Rules', count: db.measurementTemplates.length * 5 },
  ];

  const roleColor = (role: string) => {
    if (role === 'admin') return { bg: '#F3E8FF', fg: '#7C3AED' };
    if (role === 'planner') return { bg: 'var(--color-background-info)', fg: 'var(--color-text-info)' };
    if (role === 'field_worker') return { bg: 'var(--color-background-warning)', fg: 'var(--color-text-warning)' };
    if (role === 'lab_worker') return { bg: '#E1F5EE', fg: '#1D9E75' };
    return { bg: '#E1F5EE', fg: '#1D9E75' };
  };

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase();

  return (
    <>
      <style>{`
.admin{font-family:var(--font-sans);padding:1.5rem;width:100%}
.admin-top{margin-bottom:1.5rem}
.admin-title{font-size:16px;font-weight:500;color:var(--color-text-primary);margin-bottom:2px}
.admin-sub{font-size:12px;color:var(--color-text-secondary)}
.admin-tabs{display:flex;gap:0;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);overflow:hidden;margin-bottom:12px}
.admin-tab{flex:1;text-align:center;padding:6px 0;font-size:11px;font-weight:500;cursor:pointer;border:none;background:transparent;color:var(--color-text-secondary);transition:all .15s;font-family:var(--font-sans)}
.admin-tab.active{background:var(--color-text-info);color:white}
.admin-tab:not(.active):hover{background:var(--color-background-secondary)}
.admin-search{width:100%;padding:7px 10px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);font-size:12px;color:var(--color-text-primary);background:var(--color-background-secondary);font-family:var(--font-sans);outline:none;margin-bottom:12px;box-sizing:border-box}
.admin-table{width:100%;border-collapse:collapse}
.admin-table th{text-align:left;font-size:11px;font-weight:500;color:var(--color-text-secondary);padding:8px 10px;border-bottom:0.5px solid var(--color-border-tertiary)}
.admin-table td{font-size:12px;padding:8px 10px;border-bottom:0.5px solid var(--color-border-tertiary);color:var(--color-text-primary)}
.admin-table tr:hover td{background:var(--color-background-secondary)}
.user-cell{display:flex;align-items:center;gap:8px}
.user-avatar{width:24px;height:24px;border-radius:50%;background:var(--color-background-info);color:var(--color-text-info);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;flex-shrink:0}
.role-tag{display:inline-block;font-size:10px;padding:1px 8px;border-radius:var(--border-radius-md)}
.loc-card{padding:10px 12px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
.loc-card:hover{background:var(--color-background-secondary)}
.loc-name{font-size:13px;font-weight:500;color:var(--color-text-primary)}
.loc-meta{font-size:11px;color:var(--color-text-secondary);margin-top:2px}
.rating-tag{font-size:10px;padding:1px 8px;border-radius:var(--border-radius-md);color:white;font-weight:500}
.tmpl-card{padding:10px 12px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);margin-bottom:6px}
.tmpl-card:hover{background:var(--color-background-secondary)}
.tmpl-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.tmpl-name{font-size:13px;font-weight:500;color:var(--color-text-primary)}
.tmpl-cost{font-size:11px;color:var(--color-text-secondary)}
.tmpl-params{display:flex;flex-wrap:wrap;gap:4px}
.tmpl-param{font-size:10px;padding:2px 8px;background:var(--color-background-secondary);border-radius:4px;color:var(--color-text-secondary)}
.rules-table{width:100%;border-collapse:collapse}
.rules-table th{text-align:center;font-size:11px;font-weight:500;color:var(--color-text-secondary);padding:8px 6px;border-bottom:0.5px solid var(--color-border-tertiary)}
.rules-table th:first-child{text-align:left}
.rules-table td{font-size:11px;padding:8px 6px;border-bottom:0.5px solid var(--color-border-tertiary);text-align:center;color:var(--color-text-primary)}
.rules-table td:first-child{text-align:left;font-weight:500}
.freq-tag{display:inline-block;font-size:10px;padding:2px 6px;border-radius:4px}
      `}</style>

      <div className="admin">
        <div className="admin-top">
          <div className="admin-title">Admin panel</div>
          <div className="admin-sub">Manage users, locations, and system configuration</div>
        </div>

        <div className="admin-tabs">
          {tabs.map(t => (
            <button key={t.key} className={`admin-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <input className="admin-search" placeholder={`Search ${tab}...`} value={search} onChange={e => setSearch(e.target.value)} />

        {tab === 'users' && (
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th></tr></thead>
            <tbody>
              {filteredUsers.map(u => {
                const rc = roleColor(u.role);
                return (
                  <tr key={u.id}>
                    <td><div className="user-cell"><div className="user-avatar">{initials(u.full_name)}</div>{u.full_name}</div></td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{u.email}</td>
                    <td><span className="role-tag" style={{ background: rc.bg, color: rc.fg }}>{u.role.replace('_', ' ')}</span></td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'locations' && (
          <div>
            {filteredLocations.map(l => (
              <div className="loc-card" key={l.id}>
                <div>
                  <div className="loc-name">{l.name}</div>
                  <div className="loc-meta">{l.code} · {l.environment_type}</div>
                </div>
                <span className="rating-tag" style={{ background: db.getRatingColor(l.rating) }}>{db.getRatingLabel(l.rating)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'templates' && (
          <div>
            {filteredTemplates.map(t => (
              <div className="tmpl-card" key={t.id}>
                <div className="tmpl-top">
                  <span className="tmpl-name">{t.name}</span>
                  <span className="tmpl-cost">&euro;{t.unit_cost} per analysis</span>
                </div>
                <div className="tmpl-params">
                  {t.parameters.map(p => <span className="tmpl-param" key={p.key}>{p.label}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'rules' && (
          <table className="rules-table">
            <thead><tr><th>Measurement Type</th><th>Very Poor</th><th>Poor</th><th>Moderate</th><th>Good</th><th>Very Good</th></tr></thead>
            <tbody>
              {db.measurementTemplates.map(t => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td><span className="freq-tag" style={{ background: '#FCEBEB', color: '#E24B4A' }}>Quarterly</span></td>
                  <td><span className="freq-tag" style={{ background: '#FAECE7', color: '#D85A30' }}>3x/year</span></td>
                  <td><span className="freq-tag" style={{ background: '#FAEEDA', color: '#BA7517' }}>Biannual</span></td>
                  <td><span className="freq-tag" style={{ background: '#EFF6E8', color: '#639922' }}>Annual</span></td>
                  <td><span className="freq-tag" style={{ background: '#E1F5EE', color: '#1D9E75' }}>Biennial</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
