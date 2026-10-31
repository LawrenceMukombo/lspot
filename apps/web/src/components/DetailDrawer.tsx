import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * DetailDrawer (template v1.0)
 * Reusable right-side slide-over used for click-to-inspect record details.
 */
interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function DetailDrawer({ open, onClose, title, subtitle, icon, badge, actions, children }: DetailDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
        <header className="p-5 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="w-11 h-11 shrink-0 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white break-words">{title}</h3>
                {badge}
              </div>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5 break-words">{subtitle}</p>}
            </div>
          </div>
          <button
            id="detail-drawer-close"
            onClick={onClose}
            aria-label="Close details"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>

        {actions && (
          <footer className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-wrap gap-2 justify-end">
            {actions}
          </footer>
        )}
      </aside>
    </div>
  );
}

/** Labelled stat tile used inside detail drawers */
export function DetailStat({ label, value, tone = 'default' }: { label: string; value: React.ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent' }) {
  const toneClass = {
    default: 'text-slate-100',
    good: 'text-emerald-400',
    warn: 'text-amber-400',
    bad: 'text-rose-400',
    accent: 'text-sky-400'
  }[tone];
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className={`mt-1 font-mono font-bold text-sm break-words ${toneClass}`}>{value}</p>
    </div>
  );
}

/** Section wrapper with heading */
export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">{title}</h4>
      {children}
    </section>
  );
}

/** Key/value row list */
export function DetailRows({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="bg-slate-950/40 border border-slate-800 rounded-xl divide-y divide-slate-800/70">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 px-3 py-2 text-sm">
          <dt className="text-slate-400 shrink-0">{k}</dt>
          <dd className="text-slate-100 text-right break-words min-w-0">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Standard button styles for drawer/modals */
export const btn = {
  primary: 'flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition focus:outline-none focus:ring-2 focus:ring-amber-300',
  secondary: 'flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition focus:outline-none focus:ring-2 focus:ring-amber-500',
  danger: 'flex items-center gap-2 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-300 font-semibold text-sm rounded-xl border border-rose-500/30 transition focus:outline-none focus:ring-2 focus:ring-rose-500'
};

export const inputCls =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500';
export const labelCls = 'block text-xs font-semibold text-slate-400 mb-1';

/** Simple centered form modal template */
export function FormModal({
  open, title, subtitle, onClose, onSubmit, submitLabel = 'Save', submitting = false, children
}: {
  open: boolean; title: string; subtitle?: string; onClose: () => void; onSubmit: () => void;
  submitLabel?: string; submitting?: boolean; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h3 className="font-bold text-lg text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className={`${btn.secondary} flex-1 justify-center`}>Cancel</button>
          <button onClick={onSubmit} disabled={submitting} className={`${btn.primary} flex-1 justify-center`}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
