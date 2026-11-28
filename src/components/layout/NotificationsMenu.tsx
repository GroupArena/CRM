import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';
import { useAuth } from '../../hooks/useAuth';
import { isNotificationUnreadByUser } from '../../utils/billingLogic';
import { formatDateFr } from '../../utils/crmLogic';
import type { CrmNotification } from '../../types';

export function NotificationsMenu() {
  const {
    visibleNotifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    entities,
  } = useCrm();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const handleOpenNotification = async (notif: CrmNotification) => {
    await markNotificationAsRead(notif.id);
    setOpen(false);
    navigate(`/invoices?preview=${encodeURIComponent(notif.invoiceId)}`);
  };

  const renderIcon = (type: CrmNotification['type']) => {
    if (type === 'invoice_validated') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />;
    }
    if (type === 'invoice_rejected') {
      return <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />;
    }
    return <Clock className="h-4 w-4 text-[#AD7300] shrink-0 mt-0.5" />;
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications (${unreadNotificationCount} non lue${unreadNotificationCount > 1 ? 's' : ''})`}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E4EA] bg-[#F4F5F8] text-[#19283E] hover:bg-[#E1E4EA]/60 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadNotificationCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#7A1F2B] px-1 text-[10px] font-bold text-white tabular-nums shadow-sm"
          >
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Centre de notifications"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-[#E1E4EA] bg-white shadow-xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
            <div>
              <h3 className="text-sm font-semibold text-[#19283E]">Notifications</h3>
              <p className="text-[11px] text-slate-500">
                {unreadNotificationCount > 0
                  ? `${unreadNotificationCount} notification(s) non lue(s)`
                  : 'Toutes les notifications sont lues'}
              </p>
            </div>
            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={() => markAllNotificationsAsRead()}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#19283E] hover:bg-slate-200/60"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {visibleNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                Aucune notification pour votre profil pour le moment.
              </div>
            ) : (
              visibleNotifications.slice(0, 20).map((notif) => {
                const unread = isNotificationUnreadByUser(notif, user?.uid);
                const entityName =
                  entities.find((e) => e.id === notif.entityId)?.name ?? notif.entityId;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleOpenNotification(notif)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-slate-50 ${
                      unread ? 'bg-[#C9A125]/5' : 'bg-white'
                    }`}
                  >
                    {renderIcon(notif.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {notif.title}
                        </p>
                        {unread && (
                          <span
                            aria-label="Non lu"
                            className="h-2 w-2 rounded-full bg-[#7A1F2B] shrink-0"
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{entityName}</span>
                        <span>{formatDateFr(notif.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}