import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useUser } from '../../context/UserContext';
import { getNavItemsForRole, getRoleLabel } from '../../config/roleAccess';

export default function Sidebar() {
  const { notifications, users } = useDatabase();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { currentUser, switchUser } = useUser();
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const navItems = getNavItemsForRole(currentUser.role);
  const initials = currentUser.full_name.split(' ').map(n => n[0]).join('');
  const roleLabel = getRoleLabel(currentUser.role);

  const roleColor: Record<string, string> = {
    admin: '#a855f7',
    planner: '#378ADD',
    field_worker: '#f97316',
    lab_worker: '#8b5cf6',
    analyst: '#14b8a6',
  };
  const avatarBg = roleColor[currentUser.role] || '#378ADD';

  const css = `
.sidebar{width:${collapsed ? '52px' : '200px'};background:#1a1c1e;color:white;display:flex;flex-direction:column;transition:width .2s;flex-shrink:0;height:100%;z-index:40;font-family:var(--font-sans)}
.sidebar-logo{padding:14px ${collapsed ? '12px' : '14px'};display:flex;align-items:center;gap:10px;border-bottom:0.5px solid rgba(255,255,255,0.08)}
.sidebar-logo-img{width:28px;height:28px;border-radius:6px;object-fit:contain;flex-shrink:0}
.sidebar-logo-text h1{font-size:14px;font-weight:600;letter-spacing:-0.3px;line-height:1.2}
.sidebar-logo-text p{font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px}
.sidebar-nav{flex:1;padding:8px 6px;display:flex;flex-direction:column;gap:2px}
.sidebar-link{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;font-size:12px;font-weight:500;color:rgba(255,255,255,0.5);text-decoration:none;transition:all .15s}
.sidebar-link:hover{color:rgba(255,255,255,0.8);background:rgba(255,255,255,0.06)}
.sidebar-link.active{color:white;background:rgba(55,138,221,0.15);color:#7ab8f5}
.sidebar-link svg{width:18px;height:18px;flex-shrink:0}
.sidebar-notif{padding:4px 6px;margin-bottom:4px}
.sidebar-notif-link{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;font-size:12px;font-weight:500;color:rgba(255,255,255,0.5);text-decoration:none;transition:all .15s;position:relative}
.sidebar-notif-link:hover{color:rgba(255,255,255,0.8);background:rgba(255,255,255,0.06)}
.sidebar-badge{position:absolute;top:2px;left:22px;width:14px;height:14px;background:#E24B4A;border-radius:50%;font-size:9px;font-weight:600;display:flex;align-items:center;justify-content:center;color:white}
.sidebar-user{padding:10px ${collapsed ? '10px' : '14px'};border-top:0.5px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:10px;cursor:pointer;position:relative}
.sidebar-user:hover{background:rgba(255,255,255,0.04)}
.sidebar-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0}
.sidebar-user-info{flex:1;min-width:0}
.sidebar-user-info p:first-child{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sidebar-user-info p:last-child{font-size:10px;color:rgba(255,255,255,0.4)}
.sidebar-toggle{padding:6px;border-top:0.5px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.3);background:none;border-left:none;border-right:none;border-bottom:none;transition:color .15s}
.sidebar-toggle:hover{color:rgba(255,255,255,0.6)}
.user-menu{position:absolute;bottom:100%;left:6px;right:6px;background:#2a2d30;border-radius:8px;overflow:hidden;box-shadow:0 -4px 16px rgba(0,0,0,0.3);margin-bottom:4px}
.user-menu-item{display:flex;align-items:center;gap:10px;padding:8px 12px;width:100%;background:none;border:none;color:rgba(255,255,255,0.7);font-size:12px;font-family:var(--font-sans);cursor:pointer;transition:background .12s;text-align:left}
.user-menu-item:hover{background:rgba(255,255,255,0.08);color:white}
.user-menu-item.current{background:rgba(55,138,221,0.15);color:#7ab8f5}
.user-menu-item:not(:last-child){border-bottom:0.5px solid rgba(255,255,255,0.06)}
.user-menu-avatar{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;flex-shrink:0}
.user-menu-role{font-size:10px;color:rgba(255,255,255,0.35);margin-left:auto}
  `;

  return (
    <>
      <style>{css}</style>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="EcoPlanner" className="sidebar-logo-img" />
          {!collapsed && (
            <div className="sidebar-logo-text">
              <h1>EcoPlanner</h1>
              <p>ARSO Monitor</p>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-notif">
          <NavLink to="/notifications" className="sidebar-notif-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {!collapsed && <span>Notifications</span>}
            {unreadCount > 0 && <span className="sidebar-badge">{unreadCount}</span>}
          </NavLink>
        </div>

        <div className="sidebar-user" onClick={() => setUserMenuOpen(!userMenuOpen)}>
          <div className="sidebar-avatar" style={{ background: avatarBg }}>{initials}</div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <p>{currentUser.full_name}</p>
              <p>{roleLabel}</p>
            </div>
          )}
          {userMenuOpen && (
            <div className="user-menu" onClick={e => e.stopPropagation()}>
              {users.map(u => {
                const uInitials = u.full_name.split(' ').map(n => n[0]).join('');
                const uColor = roleColor[u.role] || '#378ADD';
                return (
                  <button
                    key={u.id}
                    className={`user-menu-item${u.id === currentUser.id ? ' current' : ''}`}
                    onClick={() => { switchUser(u.id); setUserMenuOpen(false); }}
                  >
                    <span className="user-menu-avatar" style={{ background: uColor, color: 'white' }}>{uInitials}</span>
                    {u.full_name}
                    <span className="user-menu-role">{getRoleLabel(u.role)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed
              ? <path d="M9 18l6-6-6-6" />
              : <path d="M15 18l-6-6 6-6" />
            }
          </svg>
        </button>
      </aside>
    </>
  );
}
