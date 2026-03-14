import { useState, useMemo } from 'react';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import type { Notification, NotificationType } from './planData';
import { workerName } from './planData';

interface Props {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
}

const TYPE_CONFIG: Record<NotificationType, { label: string; color: string; icon: string }> = {
  assigned:    { label: 'Assigned',    color: '#378ADD', icon: '→' },
  cancelled:   { label: 'Cancelled',   color: '#E24B4A', icon: '✕' },
  rescheduled: { label: 'Rescheduled', color: '#BA7517', icon: '↻' },
  emergency:   { label: 'Emergency',   color: '#E24B4A', icon: '⚠' },
  added:       { label: 'New entry',   color: '#639922', icon: '+' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationPanel({ notifications, onMarkRead, onMarkAllRead, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationType | 'all'>('all');

  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = useMemo(() => {
    const list = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
    return list.slice(0, 100);
  }, [notifications, filter]);

  // Group by worker
  const workerGroups = useMemo(() => {
    const map = new Map<string, Notification[]>();
    for (const n of filtered) {
      const key = n.workerId || '__system';
      const existing = map.get(key);
      if (existing) existing.push(n);
      else map.set(key, [n]);
    }
    return map;
  }, [filtered]);

  return (
    <>
      <style>{CSS}</style>
      <div className="ntf-wrap">
        <button className="ntf-bell" onClick={() => setOpen(!open)}>
          <Bell size={15} />
          {unreadCount > 0 && <span className="ntf-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>

        {open && (
          <div className="ntf-dropdown">
            <div className="ntf-header">
              <span className="ntf-title">Notifications</span>
              <div className="ntf-header-actions">
                {unreadCount > 0 && (
                  <button className="ntf-action" onClick={onMarkAllRead} title="Mark all read">
                    <CheckCheck size={13} />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button className="ntf-action" onClick={onClear} title="Clear all">
                    <X size={13} />
                  </button>
                )}
                <button className="ntf-close" onClick={() => setOpen(false)}>&times;</button>
              </div>
            </div>

            {/* Filters */}
            <div className="ntf-filters">
              {(['all', 'assigned', 'cancelled', 'rescheduled', 'emergency', 'added'] as const).map(f => (
                <button
                  key={f}
                  className={`ntf-filter${filter === f ? ' ntf-filter-active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? `All (${notifications.length})` : TYPE_CONFIG[f].label}
                </button>
              ))}
            </div>

            {/* Notification list */}
            <div className="ntf-list">
              {filtered.length === 0 && (
                <div className="ntf-empty">No notifications</div>
              )}
              {Array.from(workerGroups.entries()).map(([wid, notifs]) => (
                <div key={wid} className="ntf-group">
                  <div className="ntf-group-hdr">
                    {wid === '__system' ? 'System' : workerName(wid)}
                    <span className="ntf-group-count">{notifs.length}</span>
                  </div>
                  {notifs.map(n => {
                    const cfg = TYPE_CONFIG[n.type];
                    return (
                      <div
                        key={n.id}
                        className={`ntf-item${n.read ? '' : ' ntf-unread'}`}
                        onClick={() => { if (!n.read) onMarkRead(n.id); }}
                      >
                        <span className="ntf-icon" style={{ background: cfg.color }}>{cfg.icon}</span>
                        <div className="ntf-content">
                          <div className="ntf-msg">{n.message}</div>
                          <div className="ntf-meta">
                            <span className="ntf-type-tag" style={{ color: cfg.color }}>{cfg.label}</span>
                            <span className="ntf-time">{timeAgo(n.timestamp)}</span>
                          </div>
                        </div>
                        {!n.read && (
                          <button className="ntf-read-btn" onClick={e => { e.stopPropagation(); onMarkRead(n.id); }} title="Mark read">
                            <Check size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
.ntf-wrap{position:relative}
.ntf-bell{background:none;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:4px 8px;cursor:pointer;color:var(--color-text-secondary);display:flex;align-items:center;position:relative}
.ntf-bell:hover{background:var(--color-background-secondary);color:var(--color-text-primary)}
.ntf-badge{position:absolute;top:-5px;right:-5px;font-size:9px;background:#E24B4A;color:white;padding:0 4px;border-radius:8px;font-weight:600;line-height:16px;min-width:8px;text-align:center}

.ntf-dropdown{position:absolute;top:100%;right:0;margin-top:6px;width:380px;max-height:520px;background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:200;display:flex;flex-direction:column;font-family:var(--font-sans)}

.ntf-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:0.5px solid var(--color-border-tertiary)}
.ntf-title{font-size:13px;font-weight:600;color:var(--color-text-primary)}
.ntf-header-actions{display:flex;align-items:center;gap:4px}
.ntf-action{background:none;border:none;cursor:pointer;color:var(--color-text-tertiary);padding:3px;border-radius:3px;display:flex;align-items:center}
.ntf-action:hover{background:var(--color-background-secondary);color:var(--color-text-primary)}
.ntf-close{background:none;border:none;font-size:16px;cursor:pointer;color:var(--color-text-tertiary);padding:0 2px;line-height:1}
.ntf-close:hover{color:var(--color-text-primary)}

.ntf-filters{display:flex;gap:2px;padding:6px 10px;border-bottom:0.5px solid var(--color-border-tertiary);overflow-x:auto}
.ntf-filter{font-size:10px;padding:3px 8px;border:0.5px solid var(--color-border-tertiary);border-radius:12px;background:var(--color-background-primary);color:var(--color-text-secondary);cursor:pointer;font-family:var(--font-sans);white-space:nowrap}
.ntf-filter:hover{background:var(--color-background-secondary)}
.ntf-filter-active{background:#EBF3FB;color:#378ADD;border-color:#378ADD44;font-weight:600}

.ntf-list{flex:1;overflow-y:auto;padding:4px 0}
.ntf-empty{padding:24px;text-align:center;font-size:11px;color:var(--color-text-tertiary)}

.ntf-group{margin-bottom:2px}
.ntf-group-hdr{padding:5px 14px;font-size:10px;font-weight:600;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.3px;background:var(--color-background-secondary);display:flex;align-items:center;justify-content:space-between}
.ntf-group-count{font-size:9px;color:var(--color-text-tertiary);font-weight:500;background:var(--color-background-primary);padding:0 5px;border-radius:8px}

.ntf-item{display:flex;align-items:flex-start;gap:8px;padding:8px 14px;cursor:pointer;transition:background .1s;border-bottom:0.5px solid var(--color-border-tertiary)}
.ntf-item:last-child{border-bottom:none}
.ntf-item:hover{background:var(--color-background-secondary)}
.ntf-unread{background:#f8faff}
.ntf-unread:hover{background:#EBF3FB}

.ntf-icon{width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:600;flex-shrink:0;margin-top:1px}
.ntf-content{flex:1;min-width:0}
.ntf-msg{font-size:11px;color:var(--color-text-primary);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ntf-unread .ntf-msg{font-weight:500}
.ntf-meta{display:flex;align-items:center;gap:6px;margin-top:2px}
.ntf-type-tag{font-size:9px;font-weight:600}
.ntf-time{font-size:9px;color:var(--color-text-tertiary)}

.ntf-read-btn{background:none;border:0.5px solid var(--color-border-tertiary);border-radius:3px;padding:2px;cursor:pointer;color:var(--color-text-tertiary);display:flex;align-items:center;flex-shrink:0}
.ntf-read-btn:hover{background:var(--color-background-secondary);color:#378ADD}

@media(max-width:480px){
  .ntf-dropdown{width:calc(100vw - 20px);right:-10px}
}
`;
