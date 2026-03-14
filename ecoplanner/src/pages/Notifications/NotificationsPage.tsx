import { useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';

type NotifType = 'anomaly' | 'assignment' | 'budget_alert' | 'approval_needed' | 'reschedule';

function typeIcon(type: string): { svg: string; color: string } {
  switch (type as NotifType) {
    case 'anomaly': return { svg: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', color: '#E24B4A' };
    case 'assignment': return { svg: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: '#378ADD' };
    case 'budget_alert': return { svg: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1m9-9a9 9 0 11-18 0 9 9 0 0118 0z', color: '#BA7517' };
    case 'approval_needed': return { svg: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: '#639922' };
    default: return { svg: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', color: '#378ADD' };
  }
}

function timeAgo(isoStr: string): string {
  const now = new Date();
  const date = new Date(isoStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationsPage() {
  const db = useDatabase();

  const unread = useMemo(() => db.notifications.filter(n => !n.is_read).length, [db.notifications]);

  const markRead = (id: string) => db.updateNotification(id, { is_read: true });
  const markAllRead = () => {
    db.notifications.filter(n => !n.is_read).forEach(n => db.updateNotification(n.id, { is_read: true }));
  };

  return (
    <>
      <style>{`
.notifs{font-family:var(--font-sans);padding:1.5rem;width:100%}
.notifs-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}
.notifs-title{font-size:16px;font-weight:500;color:var(--color-text-primary)}
.notifs-unread{font-size:11px;color:var(--color-text-secondary);margin-top:2px}
.notifs-mark-all{font-size:11px;color:var(--color-text-info);cursor:pointer;background:none;border:none;font-family:var(--font-sans);font-weight:500}
.notifs-mark-all:hover{text-decoration:underline}
.notif-card{padding:10px 12px;border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);margin-bottom:6px;cursor:pointer;transition:all .15s;display:flex;gap:10px;align-items:flex-start}
.notif-card:hover{background:var(--color-background-secondary)}
.notif-card.unread{border-color:var(--color-border-info);background:var(--color-background-info)}
.notif-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.notif-content{flex:1;min-width:0}
.notif-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px}
.notif-card-title{font-size:12px;font-weight:500;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.notif-dot{width:6px;height:6px;border-radius:50%;background:var(--color-text-info);flex-shrink:0}
.notif-body{font-size:11px;color:var(--color-text-secondary);line-height:1.4}
.notif-time{font-size:10px;color:var(--color-text-tertiary);margin-top:4px}
.notif-empty{text-align:center;padding:40px;color:var(--color-text-tertiary);font-size:13px}
      `}</style>

      <div className="notifs">
        <div className="notifs-top">
          <div>
            <div className="notifs-title">Notifications</div>
            <div className="notifs-unread">{unread} unread</div>
          </div>
          {unread > 0 && <button className="notifs-mark-all" onClick={markAllRead}>Mark all as read</button>}
        </div>

        {db.notifications.length === 0 && (
          <div className="notif-empty">No notifications</div>
        )}

        {db.notifications.map(n => {
          const icon = typeIcon(n.type);
          return (
            <div key={n.id} className={`notif-card${!n.is_read ? ' unread' : ''}`} onClick={() => markRead(n.id)}>
              <div className="notif-icon" style={{ background: icon.color + '18' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={icon.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon.svg} />
                </svg>
              </div>
              <div className="notif-content">
                <div className="notif-header">
                  <span className="notif-card-title">{n.title}</span>
                  {!n.is_read && <span className="notif-dot" />}
                </div>
                {n.body && <div className="notif-body">{n.body}</div>}
                <div className="notif-time">{timeAgo(n.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
