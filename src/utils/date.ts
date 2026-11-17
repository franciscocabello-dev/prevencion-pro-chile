const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local en formato ISO (YYYY-MM-DD) */
export const toISODate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = (): string => toISODate(new Date());

export const nowTime = (): string => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const addDays = (iso: string, days: number): string => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export const addMonths = (iso: string, months: number): string => {
  const d = parseISO(iso);
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
};

export const parseISO = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Días calendario entre dos fechas ISO (b - a) */
export const diffDays = (a: string, b: string): number => {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000);
};

export const daysFromToday = (iso: string): number => diffDays(todayISO(), iso);

export const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = parseISO(iso);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const monthKey = (iso: string): string => iso.slice(0, 7);

export const monthLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  return `${MESES[m - 1]} ${String(y).slice(2)}`;
};

export const formatLongDate = (iso: string): string => {
  const d = parseISO(iso);
  return `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()}`;
};

/** Últimos N meses (claves YYYY-MM) terminando en el mes actual */
export const lastMonths = (n: number): string[] => {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`);
  }
  return out;
};
