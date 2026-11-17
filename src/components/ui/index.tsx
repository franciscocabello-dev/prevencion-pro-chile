import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Camera, CheckCircle2, Info, Loader2, X, XCircle, AlertTriangle, ImageOff } from 'lucide-react';
import { formatRut, validateRut } from '../../utils/rut';
import { fileToBase64 } from '../../utils/image';
import { useStore } from '../../services/store';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ------------------------------------------------------------
// Botón
// ------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost' | 'dark';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-700 focus-visible:ring-navy/40',
  dark: 'bg-navy text-white hover:bg-navy-700',
  secondary: 'bg-white text-navy border border-slate-300 hover:bg-slate-50',
  success: 'bg-ok text-white hover:bg-ok-700',
  danger: 'bg-crit text-white hover:bg-crit-700',
  warning: 'bg-warn text-navy hover:bg-warn-600',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export function Button({ variant = 'primary', size = 'md', icon, loading, block, className, children, disabled, ...rest }: BtnProps) {
  const sizes = { sm: 'px-3 py-1.5 text-sm gap-1.5', md: 'px-4 py-2.5 text-sm gap-2', lg: 'px-5 py-3.5 text-base gap-2.5' };
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ------------------------------------------------------------
// Tarjeta
// ------------------------------------------------------------
export function Card({ title, subtitle, actions, children, className, bodyClass, icon }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; icon?: ReactNode }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-start gap-2.5">
            {icon && <span className="mt-0.5 text-slate-500">{icon}</span>}
            <div className="min-w-0">
              {title && <h3 className="font-semibold text-navy">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4 sm:p-5', bodyClass)}>{children}</div>
    </section>
  );
}

// ------------------------------------------------------------
// Badge semántico
// ------------------------------------------------------------
export type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'neutral' | 'dark';
const TONES: Record<Tone, string> = {
  ok: 'bg-ok-50 text-ok-800 ring-ok/30',
  warn: 'bg-warn-50 text-warn-800 ring-warn/40',
  crit: 'bg-crit-50 text-crit-800 ring-crit/30',
  info: 'bg-sky-50 text-sky-800 ring-sky-300/50',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-300/60',
  dark: 'bg-navy text-white ring-navy',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className={cx('size-1.5 rounded-full', tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : tone === 'crit' ? 'bg-crit' : 'bg-slate-400')} />}
      {children}
    </span>
  );
}

// ------------------------------------------------------------
// Campos de formulario
// ------------------------------------------------------------
export function Field({ label, hint, error, children, required, className }: { label: string; hint?: string; error?: string; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-crit">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-crit">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-navy placeholder:text-slate-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15 disabled:bg-slate-100 disabled:text-slate-500';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, props.className)} />;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(props, ref) {
  return <textarea ref={ref} rows={3} {...props} className={cx(inputBase, 'resize-y', props.className)} />;
});

export function Select({ options, placeholder, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string; label: string })[]; placeholder?: string }) {
  return (
    <select {...props} className={cx(inputBase, 'pr-8', props.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

/** Input de RUT con formato automático y validación módulo 11 */
export function RutInput({ value, onChange, required, label = 'RUT', className }: { value: string; onChange: (v: string) => void; required?: boolean; label?: string; className?: string }) {
  const [touched, setTouched] = useState(false);
  const invalid = touched && value.length > 0 && !validateRut(value);
  const valid = value.length > 0 && validateRut(value);
  return (
    <Field label={label} required={required} error={invalid ? 'RUT inválido (dígito verificador incorrecto)' : undefined} className={className}>
      <div className="relative">
        <Input
          inputMode="text"
          autoComplete="off"
          placeholder="12.345.678-9"
          value={value}
          onBlur={() => setTouched(true)}
          onChange={(e) => onChange(formatRut(e.target.value))}
          className={cx('pr-9', invalid && 'border-crit focus:border-crit focus:ring-crit/20', valid && 'border-ok')}
        />
        {valid && <CheckCircle2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ok" />}
        {invalid && <XCircle className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-crit" />}
      </div>
    </Field>
  );
}

// ------------------------------------------------------------
// Captura de fotografía (cámara en móvil) → base64
// ------------------------------------------------------------
export function PhotoInput({ value, onChange, label = 'Evidencia fotográfica' }: { value?: string; onChange: (v: string | undefined) => void; label?: string }) {
  const id = useId();
  const [loading, setLoading] = useState(false);
  const { notify } = useStore();
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="Evidencia" className="h-40 w-auto max-w-full rounded-lg border border-slate-200 object-cover" />
          <button type="button" onClick={() => onChange(undefined)} className="absolute -top-2 -right-2 rounded-full bg-crit p-1 text-white shadow" aria-label="Quitar foto">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label htmlFor={id} className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-slate-500 hover:border-navy hover:text-navy">
          {loading ? <Loader2 className="size-7 animate-spin" /> : <Camera className="size-7" />}
          <span className="text-sm font-medium">Tomar foto o adjuntar imagen</span>
          <span className="text-xs">Se comprime y guarda en el dispositivo</span>
        </label>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setLoading(true);
          try {
            onChange(await fileToBase64(f));
          } catch (err) {
            notify((err as Error).message, 'error');
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}

export function Thumb({ src, className }: { src?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!src)
    return (
      <span className={cx('flex items-center justify-center rounded-md bg-slate-100 text-slate-400', className ?? 'size-12')}>
        <ImageOff className="size-4" />
      </span>
    );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0">
        <img src={src} alt="Evidencia" className={cx('rounded-md border border-slate-200 object-cover', className ?? 'size-12')} />
      </button>
      {open && (
        <Modal title="Evidencia fotográfica" onClose={() => setOpen(false)} size="lg">
          <img src={src} alt="Evidencia" className="mx-auto max-h-[70vh] rounded-lg" />
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------
// Modal (pantalla completa en móvil)
// ------------------------------------------------------------
export function Modal({ title, onClose, children, footer, size = 'md' }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' | 'xl' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const widths = { md: 'sm:max-w-lg', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className={cx('flex max-h-[95dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', widths[size])}>
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-lg font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:rounded-b-2xl sm:px-5">{footer}</footer>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Encabezado de página
// ------------------------------------------------------------
export function PageHeader({ title, subtitle, icon, actions }: { title: string; subtitle?: string; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <span className="hidden rounded-xl bg-navy p-2.5 text-white sm:block">{icon}</span>}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <span className="text-slate-400">{icon}</span>
      <p className="font-semibold text-navy">{title}</p>
      {text && <p className="max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = 'neutral', icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode }) {
  const bar = { ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', info: 'bg-sky-500', neutral: 'bg-slate-300', dark: 'bg-navy' }[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={cx('absolute inset-y-0 left-0 w-1', bar)} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className="mt-1 text-2xl font-bold text-navy tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx(
            'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
            value === t.id ? 'bg-navy text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={cx('rounded-full px-1.5 text-xs', value === t.id ? 'bg-white/20' : 'bg-slate-100')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone }: { value: number; tone?: Tone }) {
  const t = tone ?? (value >= 80 ? 'ok' : value >= 50 ? 'warn' : 'crit');
  const color = { ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', info: 'bg-sky-500', neutral: 'bg-slate-400', dark: 'bg-navy' }[t];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

// ------------------------------------------------------------
// Toasts
// ------------------------------------------------------------
export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-[60] flex flex-col items-center gap-2 px-3 lg:top-auto lg:right-4 lg:bottom-4 lg:left-auto lg:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg',
            t.tipo === 'ok' ? 'bg-ok-700' : t.tipo === 'error' ? 'bg-crit-700' : 'bg-navy',
          )}
        >
          {t.tipo === 'ok' ? <CheckCircle2 className="size-5 shrink-0" /> : t.tipo === 'error' ? <AlertTriangle className="size-5 shrink-0" /> : <Info className="size-5 shrink-0" />}
          <span className="flex-1">{t.mensaje}</span>
          <button type="button" onClick={() => dismissToast(t.id)} aria-label="Cerrar">
            <X className="size-4 opacity-80" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Aviso de solo lectura para roles sin permiso de edición */
export function ReadOnlyNotice({ text }: { text: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
      <Info className="size-4 shrink-0" />
      {text}
    </div>
  );
}
