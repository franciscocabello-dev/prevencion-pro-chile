import { forwardRef, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Camera, CheckCircle2, Info, Loader2, X, XCircle, AlertTriangle, ImageOff } from 'lucide-react';
import { formatRut, validateRut } from '../../utils/rut';
import { fileToBase64 } from '../../utils/image';
import { useStore } from '../../services/store';

/* ============================================================
   Sistema de diseño «Industrial de Alta Precisión»
   - Superficies planas, borde nítido de 1px, sin sombras difusas
   - Radios: 8px contenedores (rounded-lg) · 6px controles (rounded-md)
   - Objetivos táctiles ≥ 44px · inputs 16px en móvil (sin zoom iOS)
   - Color sólo semántico: ok (cumple) · warn (preventivo) · crit (crítico)
   ============================================================ */

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ------------------------------------------------------------
// Botón
// ------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost' | 'dark';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-700 border border-navy',
  dark: 'bg-navy text-white hover:bg-navy-700 border border-navy',
  secondary: 'bg-white text-navy border border-slate-300 hover:border-slate-400 hover:bg-slate-50',
  success: 'bg-ok text-white hover:bg-ok-700 border border-ok',
  danger: 'bg-crit text-white hover:bg-crit-700 border border-crit',
  warning: 'bg-warn text-navy hover:bg-warn-600 border border-warn',
  ghost: 'text-slate-700 hover:bg-slate-100 border border-transparent',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

export function Button({ variant = 'primary', size = 'md', icon, loading, block, className, children, disabled, ...rest }: BtnProps) {
  // sm conserva 44px en táctil y se compacta a 36px sólo con puntero fino (escritorio)
  const sizes = {
    sm: 'min-h-11 [@media(pointer:fine)]:min-h-9 px-3 text-sm gap-1.5',
    md: 'min-h-11 px-4 text-sm gap-2',
    lg: 'min-h-12 px-5 text-[15px] gap-2.5',
  };
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex max-w-full items-center justify-center rounded-md font-semibold whitespace-nowrap transition-colors select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" /> : icon && <span className="flex shrink-0">{icon}</span>}
      {children && <span className="truncate">{children}</span>}
    </button>
  );
}

/** Botón sólo-ícono con objetivo táctil de 44px */
export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={cx('inline-flex size-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-navy', className)}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------
// Panel (antes «Card»): plano, borde 1px
// ------------------------------------------------------------
export function Card({ title, subtitle, actions, children, className, bodyClass, icon }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; icon?: ReactNode }) {
  return (
    <section className={cx('min-w-0 rounded-lg border border-slate-200 bg-white', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="flex shrink-0 text-slate-500 [&_svg]:size-4">{icon}</span>}
            <div className="min-w-0">
              {title && <h3 className="text-sm leading-5 font-semibold text-navy">{title}</h3>}
              {subtitle && <p className="text-xs leading-4 text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4', bodyClass)}>{children}</div>
    </section>
  );
}

// ------------------------------------------------------------
// Badge semántico
// ------------------------------------------------------------
export type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'neutral' | 'dark';
const TONES: Record<Tone, string> = {
  ok: 'bg-ok-50 text-ok-800 border-ok/35',
  warn: 'bg-warn-50 text-warn-800 border-warn/45',
  crit: 'bg-crit-50 text-crit-800 border-crit/35',
  info: 'bg-slate-50 text-slate-700 border-slate-300',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200',
  dark: 'bg-navy text-white border-navy',
};
const DOT: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', info: 'bg-slate-500', neutral: 'bg-slate-400', dark: 'bg-white' };

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[5px] border px-2 text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className={cx('size-1.5 rounded-full', DOT[tone])} />}
      {children}
    </span>
  );
}

// ------------------------------------------------------------
// Campos de formulario (16px en móvil para evitar zoom automático)
// ------------------------------------------------------------
export function Field({ label, hint, error, children, required, className }: { label: string; hint?: string; error?: string; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cx('block min-w-0', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label} {required && <span className="text-crit">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-crit">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  'block w-full min-w-0 min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm text-navy placeholder:text-slate-400 ' +
  'focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy disabled:bg-slate-50 disabled:text-slate-500';

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
          className={cx('pr-9 font-mono tabular-nums', invalid && 'border-crit focus:border-crit focus:ring-crit', valid && 'border-ok')}
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
    <div className="min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      {value ? (
        <div className="relative inline-block max-w-full">
          <img src={value} alt="Evidencia" className="h-40 w-auto max-w-full rounded-md border border-slate-200 object-cover" />
          <button type="button" onClick={() => onChange(undefined)} className="absolute top-1 right-1 flex size-9 items-center justify-center rounded-md bg-navy text-white" aria-label="Quitar foto">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label htmlFor={id} className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-slate-600 hover:border-navy hover:text-navy">
          {loading ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
          <span className="text-sm font-medium">Tomar foto o adjuntar imagen</span>
          <span className="text-xs text-slate-500">Se comprime y guarda en el dispositivo</span>
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
      <span className={cx('flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400', className ?? 'size-12')}>
        <ImageOff className="size-4" />
      </span>
    );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0" aria-label="Ver evidencia">
        <img src={src} alt="Evidencia" className={cx('rounded-md border border-slate-200 object-cover', className ?? 'size-12')} />
      </button>
      {open && (
        <Modal title="Evidencia fotográfica" onClose={() => setOpen(false)} size="lg">
          <img src={src} alt="Evidencia" className="mx-auto max-h-[70vh] max-w-full rounded-md" />
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------
// Modal: bottom sheet en móvil, diálogo centrado en escritorio
// ------------------------------------------------------------
export function Modal({ title, onClose, children, footer, size = 'md' }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' | 'xl' }) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cx('sheet-in flex max-h-[94dvh] w-full max-w-full flex-col rounded-t-xl border border-slate-200 bg-white sm:rounded-lg', widths[size])}>
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 py-2 pr-2 pl-4">
          <h2 className="min-w-0 truncate text-base font-semibold text-navy">{title}</h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </header>
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&>button]:max-sm:flex-1">{footer}</footer>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Encabezado de página: acciones a ancho completo en móvil
// ------------------------------------------------------------
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl leading-7 font-semibold tracking-[-0.01em] text-navy sm:text-2xl sm:leading-8">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex sm:shrink-0">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
      <span className="text-slate-400">{icon}</span>
      <p className="font-semibold text-navy">{title}</p>
      {text && <p className="max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ------------------------------------------------------------
// KPI: celda de grilla estructural (usar dentro de <StatGrid>)
// ------------------------------------------------------------
export function Stat({ label, value, hint, tone = 'neutral', icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode }) {
  const semantic = tone === 'ok' || tone === 'warn' || tone === 'crit';
  return (
    <div className="min-w-0 bg-white p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[11px] leading-4 font-semibold tracking-[0.06em] text-slate-500 uppercase">{label}</p>
        {semantic ? <span className={cx('mt-1 size-2 shrink-0 rounded-full', DOT[tone])} aria-hidden /> : icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className={cx('mt-1.5 truncate text-[26px] leading-8 font-semibold tracking-tight tabular-nums', tone === 'crit' ? 'text-crit-700' : 'text-navy')}>{value}</p>
      {hint && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Grilla estructural: celdas divididas por líneas de 1px, simétrica 2×2 en móvil */
export function StatGrid({ children, cols = 4, className }: { children: ReactNode; cols?: 3 | 4; className?: string }) {
  return (
    <div className={cx('grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200', cols === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3', className)}>
      {children}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar -mx-3 mb-4 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="tablist">
      <div className="inline-flex min-w-full gap-1 border-b border-slate-200 sm:min-w-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={value === t.id}
            onClick={() => onChange(t.id)}
            className={cx(
              '-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
              value === t.id ? 'border-navy text-navy' : 'border-transparent text-slate-500 hover:text-navy',
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cx('rounded px-1.5 text-xs tabular-nums', value === t.id ? 'bg-navy text-white' : 'bg-slate-100 text-slate-600')}>{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProgressBar({ value, tone }: { value: number; tone?: Tone }) {
  const t = tone ?? (value >= 80 ? 'ok' : value >= 50 ? 'warn' : 'crit');
  const color = { ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', info: 'bg-slate-500', neutral: 'bg-slate-400', dark: 'bg-navy' }[t];
  return (
    <div className="h-1.5 w-full min-w-0 overflow-hidden rounded-full bg-slate-200">
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Fila clave/valor para tarjetas móviles que reemplazan tablas */
export function KV({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="text-[11px] font-medium tracking-[0.04em] text-slate-500 uppercase">{k}</dt>
      <dd className="mt-0.5 text-sm break-words text-navy">{children}</dd>
    </div>
  );
}

// ------------------------------------------------------------
// Toasts
// ------------------------------------------------------------
export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.25rem] z-[60] flex flex-col items-center gap-2 px-3 lg:top-auto lg:right-4 lg:bottom-4 lg:left-auto lg:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm font-medium text-white',
            t.tipo === 'ok' ? 'border-ok-700 bg-ok-700' : t.tipo === 'error' ? 'border-crit-700 bg-crit-700' : 'border-navy bg-navy',
          )}
        >
          {t.tipo === 'ok' ? <CheckCircle2 className="size-5 shrink-0" /> : t.tipo === 'error' ? <AlertTriangle className="size-5 shrink-0" /> : <Info className="size-5 shrink-0" />}
          <span className="min-w-0 flex-1">{t.mensaje}</span>
          <button type="button" onClick={() => dismissToast(t.id)} aria-label="Cerrar" className="-m-1 p-1">
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
    <div className="mb-4 flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
      <Info className="mt-0.5 size-4 shrink-0" />
      {text}
    </div>
  );
}
