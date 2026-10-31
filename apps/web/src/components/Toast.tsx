import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  X
} from 'lucide-react';

export type ToastSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface ToastItem {
  id: string;
  severity: ToastSeverity;
  title: string;
  message: string;
  durationMs: number;
  createdAt: number;
}

const TOAST_EVENT = 'lspot:toast';

export function classifyMessageSeverity(rawMessage: string): {
  severity: ToastSeverity;
  title: string;
} {
  const msg = String(rawMessage || '').trim();
  const lower = msg.toLowerCase();

  // Critical / Error patterns
  if (
    lower.includes('failed') ||
    lower.includes('error') ||
    lower.includes('exceeded') ||
    lower.includes('insufficient') ||
    lower.includes('invalid') ||
    lower.includes('cannot sell') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('could not')
  ) {
    return {
      severity: 'critical',
      title: 'Critical Alert'
    };
  }

  // Warning / Action Required / Policy Guardrail patterns
  if (
    lower.includes('cannot deactivate') ||
    lower.includes('active debt') ||
    lower.includes('please select') ||
    lower.includes('please enter') ||
    lower.includes('please fill') ||
    lower.includes('please choose') ||
    lower.includes('please save') ||
    lower.includes('required') ||
    lower.includes('must be') ||
    lower.includes('variance of') ||
    lower.includes('has no outstanding') ||
    lower.includes('no active register')
  ) {
    return {
      severity: 'warning',
      title: 'Warning • Action Required'
    };
  }

  // Success patterns
  if (
    lower.includes('successfully') ||
    lower.includes('complete') ||
    lower.includes('balanced perfectly') ||
    lower.includes('recorded') ||
    lower.includes('generated') ||
    lower.includes('updated') ||
    lower.includes('created') ||
    lower.includes('fiscalized') ||
    lower.includes('opened')
  ) {
    return {
      severity: 'success',
      title: 'Operation Confirmed'
    };
  }

  // Default Informational
  return {
    severity: 'info',
    title: 'System Information'
  };
}

export function triggerToast(options: {
  severity: ToastSeverity;
  title?: string;
  message: string;
  durationMs?: number;
}) {
  if (typeof window === 'undefined') return;
  const defaults = classifyMessageSeverity(options.message);
  const severity = options.severity || defaults.severity;
  const defaultTitleMap: Record<ToastSeverity, string> = {
    critical: 'Critical System Alert',
    warning: 'Warning • Attention Needed',
    success: 'Operation Successful',
    info: 'Information Notice'
  };

  const detail: ToastItem = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    severity,
    title: options.title || defaultTitleMap[severity],
    message: options.message,
    durationMs:
      options.durationMs ??
      (severity === 'critical' ? 6500 : severity === 'warning' ? 5500 : 4200),
    createdAt: Date.now()
  };

  window.dispatchEvent(new CustomEvent<ToastItem>(TOAST_EVENT, { detail }));
}

export const toast = {
  critical: (message: string, title = 'Critical Alert') =>
    triggerToast({ severity: 'critical', title, message }),
  warning: (message: string, title = 'Warning • Action Required') =>
    triggerToast({ severity: 'warning', title, message }),
  info: (message: string, title = 'System Information') =>
    triggerToast({ severity: 'info', title, message }),
  success: (message: string, title = 'Operation Confirmed') =>
    triggerToast({ severity: 'success', title, message })
};

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const custom = e as CustomEvent<ToastItem>;
      if (!custom.detail) return;
      const item = custom.detail;
      setToasts((prev) => [item, ...prev].slice(0, 5));

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, item.durationMs);
    };

    window.addEventListener(TOAST_EVENT, handleToast);

    // Override native browser window.alert so any legacy alert() call renders as a categorized Toast
    const originalAlert = window.alert;
    window.alert = (message?: any) => {
      const text = String(message ?? '');
      const { severity, title } = classifyMessageSeverity(text);
      triggerToast({ severity, title, message: text });
    };

    return () => {
      window.removeEventListener(TOAST_EVENT, handleToast);
      window.alert = originalAlert;
    };
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  const getStyleConfig = (severity: ToastSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          container:
            'bg-slate-900/95 dark:bg-slate-900/95 border-rose-500/60 shadow-rose-950/50',
          accentBar: 'bg-rose-500',
          iconWrap: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          badgeLabel: 'CRITICAL',
          titleColor: 'text-rose-200',
          Icon: AlertOctagon
        };
      case 'warning':
        return {
          container:
            'bg-slate-900/95 dark:bg-slate-900/95 border-amber-500/60 shadow-amber-950/50',
          accentBar: 'bg-amber-500',
          iconWrap: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          badgeLabel: 'WARNING',
          titleColor: 'text-amber-200',
          Icon: AlertTriangle
        };
      case 'success':
        return {
          container:
            'bg-slate-900/95 dark:bg-slate-900/95 border-emerald-500/60 shadow-emerald-950/50',
          accentBar: 'bg-emerald-500',
          iconWrap: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          badgeLabel: 'CONFIRMED',
          titleColor: 'text-emerald-200',
          Icon: CheckCircle2
        };
      case 'info':
      default:
        return {
          container:
            'bg-slate-900/95 dark:bg-slate-900/95 border-sky-500/60 shadow-sky-950/50',
          accentBar: 'bg-sky-500',
          iconWrap: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
          badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          badgeLabel: 'INFO',
          titleColor: 'text-sky-200',
          Icon: Info
        };
    }
  };

  return (
    <div
      role="region"
      aria-label="System Notifications"
      className="fixed top-20 right-5 z-[100] flex flex-col gap-3 w-full max-w-md pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((t) => {
        const cfg = getStyleConfig(t.severity);
        const IconComp = cfg.Icon;
        return (
          <div
            key={t.id}
            role={t.severity === 'critical' || t.severity === 'warning' ? 'alert' : 'status'}
            className={`pointer-events-auto relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl p-4 transition-all duration-200 animate-in fade-in slide-in-from-right-5 ${cfg.container}`}
          >
            {/* Left Severity Accent Strip */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${cfg.accentBar}`} />

            <div className="flex items-start gap-3.5 pl-1.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconWrap}`}>
                <IconComp className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${cfg.badge}`}>
                    {cfg.badgeLabel}
                  </span>
                  <h4 className={`text-xs font-extrabold tracking-wide ${cfg.titleColor}`}>
                    {t.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-200 mt-1.5 leading-relaxed break-words">
                  {t.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

