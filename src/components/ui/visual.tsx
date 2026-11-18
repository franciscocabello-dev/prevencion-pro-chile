import { useEffect, useRef, useState, type ReactNode } from 'react';

// ============================================================
// Piezas visuales de la experiencia: anillo de progreso, números
// que cuentan hacia arriba y valores que se animan al aparecer.
// Respetan "reducir movimiento" del sistema operativo.
// ============================================================

const reducirMovimiento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Devuelve el valor en 0 durante el primer cuadro y luego el real, para que las transiciones CSS se vean al aparecer */
export function useAparecer(valor: number): number {
  const [v, setV] = useState(() => (reducirMovimiento() ? valor : 0));
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(valor));
    return () => cancelAnimationFrame(id);
  }, [valor]);
  return v;
}

/** Número que cuenta desde 0 hasta su valor (o desde el valor anterior) */
export function CountUp({ value, decimals = 0, duration = 800, suffix = '' }: { value: number; decimals?: number; duration?: number; suffix?: string }) {
  const [shown, setShown] = useState(() => (reducirMovimiento() ? value : 0));
  const desde = useRef(shown);
  useEffect(() => {
    if (reducirMovimiento()) {
      setShown(value);
      return;
    }
    const inicio = performance.now();
    const origen = desde.current;
    let raf = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      const actual = origen + (value - origen) * e;
      setShown(actual);
      desde.current = actual;
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <>
      {shown.toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </>
  );
}

export type RingTone = 'ok' | 'warn' | 'crit' | 'neutral' | 'light';

const RING_COLOR: Record<RingTone, string> = {
  ok: 'var(--color-ok)',
  warn: 'var(--color-warn)',
  crit: 'var(--color-crit)',
  neutral: 'var(--color-slate-400, #94a3b8)',
  light: '#10b981',
};

/** Anillo de progreso (0 a 100) con contenido al centro */
export function ProgressRing({
  value,
  size = 96,
  stroke = 9,
  tone = 'ok',
  track = 'rgba(148,163,184,0.25)',
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: RingTone;
  track?: string;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = useAparecer(Math.max(0, Math.min(100, value)));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(value)} %`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RING_COLOR[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className="ring-progress"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Saludo según la hora del día */
export const saludo = (d = new Date()) => {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
};

/** Retraso escalonado para la entrada de bloques */
export const escalon = (i: number) => ({ animationDelay: `${Math.min(i, 8) * 60}ms` });
