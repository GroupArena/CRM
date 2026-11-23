import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useCrm } from '../../context/CrmContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useCrm();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-lg"
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          )}
          {toast.type === 'error' && (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && (
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            {toast.description && (
              <p className="text-xs text-slate-600 mt-0.5 truncate">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label={`Fermer la notification ${toast.title}`}
            className="text-slate-400 hover:text-slate-700 p-1 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
