import { NavLink } from 'react-router-dom';
import { Home, Map, BarChart3, Beaker, DollarSign, ClipboardList, FlaskConical, Lightbulb } from 'lucide-react';
import { useUser } from '../../context/UserContext';


const allMobileItems = [
  { to: '/', icon: Home, label: 'Home', roles: ['admin', 'planner', 'field_worker', 'analyst'] },
  { to: '/plans', icon: Map, label: 'Plans', roles: ['admin', 'planner'] },
  { to: '/plan-generator', icon: Lightbulb, label: 'Generate', roles: ['admin', 'planner'] },
  { to: '/planned-work', icon: ClipboardList, label: 'My Work', roles: ['field_worker'] },
  { to: '/lab-queue', icon: FlaskConical, label: 'Lab', roles: ['lab_worker'] },
  { to: '/observation', icon: BarChart3, label: 'Observe', roles: ['admin', 'planner', 'field_worker', 'analyst'] },
  { to: '/pipeline', icon: Beaker, label: 'Pipeline', roles: ['admin', 'planner', 'field_worker', 'lab_worker', 'analyst'] },
  { to: '/budget', icon: DollarSign, label: 'Budget', roles: ['admin', 'planner', 'analyst'] },
];

export default function MobileNav() {
  const { currentUser } = useUser();
  const navItems = allMobileItems.filter(item => item.roles.includes(currentUser.role));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-bottom">
      <div className="flex items-center justify-around py-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-colors ${
                isActive ? 'text-emerald-600' : 'text-slate-400'
              }`
            }
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
