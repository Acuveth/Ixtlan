import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { Home, Map, BarChart3, Beaker, DollarSign, ClipboardList, FlaskConical, Lightbulb, Database, Settings } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useDatabase } from '../../context/DatabaseContext';
import { getRoleLabel } from '../../config/roleAccess';

const allMobileItems = [
  { to: '/', icon: Home, label: 'Home', roles: ['admin', 'planner', 'field_worker', 'analyst', 'lab_worker'] },
  { to: '/plans', icon: Map, label: 'Plans', roles: ['admin', 'planner', 'analyst'] },
  { to: '/plan-generator', icon: Lightbulb, label: 'Generate', roles: ['admin', 'planner'] },
  { to: '/planned-work', icon: ClipboardList, label: 'My Work', roles: ['field_worker'] },
  { to: '/lab-queue', icon: FlaskConical, label: 'Lab', roles: ['lab_worker'] },
  { to: '/locations', icon: Database, label: 'Database', roles: ['admin', 'planner', 'field_worker', 'lab_worker', 'analyst'] },
  { to: '/observation', icon: BarChart3, label: 'Observe', roles: ['admin', 'planner', 'field_worker', 'analyst'] },
  { to: '/pipeline', icon: Beaker, label: 'Pipeline', roles: ['admin', 'planner', 'field_worker', 'lab_worker', 'analyst'] },
  { to: '/budget', icon: DollarSign, label: 'Budget', roles: ['admin', 'planner', 'analyst'] },
  { to: '/admin', icon: Settings, label: 'Admin', roles: ['admin'] },
];

const roleColor: Record<string, string> = {
  admin: '#a855f7',
  planner: '#378ADD',
  field_worker: '#f97316',
  lab_worker: '#8b5cf6',
  analyst: '#14b8a6',
};

export default function MobileNav() {
  const { currentUser, switchUser } = useUser();
  const { users } = useDatabase();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navItems = allMobileItems.filter(item => item.roles.includes(currentUser.role));
  const initials = currentUser.full_name.split(' ').map(n => n[0]).join('');

  return (
    <>
      {/* User switch overlay */}
      {userMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]" onClick={() => setUserMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-14 left-2 right-2 bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-slate-100 text-xs font-medium text-slate-500">Switch Profile</div>
            {users.map(u => {
              const uInitials = u.full_name.split(' ').map(n => n[0]).join('');
              const uColor = roleColor[u.role] || '#378ADD';
              const isCurrent = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors ${isCurrent ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  onClick={() => { switchUser(u.id); setUserMenuOpen(false); }}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
                    style={{ background: uColor }}
                  >
                    {uInitials}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{u.full_name}</span>
                    <span className="block text-[10px] text-slate-400">{getRoleLabel(u.role)}</span>
                  </span>
                  {isCurrent && <span className="text-[10px] text-blue-500 font-medium">Active</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-bottom">
        <div className="flex items-center overflow-x-auto no-scrollbar">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 px-2 min-w-[52px] flex-shrink-0 flex-1 transition-colors ${
                  isActive ? 'text-emerald-600' : 'text-slate-400'
                }`
              }
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            </NavLink>
          ))}
          {/* Profile button */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex flex-col items-center gap-0.5 py-2 px-2 min-w-[52px] flex-shrink-0 transition-colors text-slate-400"
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
              style={{ background: roleColor[currentUser.role] || '#378ADD' }}
            >
              {initials}
            </span>
            <span className="text-[10px] font-medium whitespace-nowrap">Profile</span>
          </button>
        </div>
      </nav>
    </>
  );
}
