import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, ClipboardList, Search } from 'lucide-react';
import { useStore } from '../../../services/store';
import { calcularAlertas } from '../../../services/alerts';
import { evaluarFuf, nivelPreparacion, dotacionEmpresa } from '../../../utils/cumplimientoDs44';
import { daysFromToday, formatDate } from '../../../utils/date';
import { RUBRO_LABEL } from '../../../data/catalogos';
import type { CompanyData } from '../../../types';
import { Badge, Button, Card, Input, PageHeader, ProgressBar, Stat, StatGrid, cx } from '../../ui';

// ============================================================
// Cartera de clientes: vista para el prevencionista que atiende
// varias pymes. Resume el estado de cada empresa y ordena primero
// las que necesitan atención.
// ============================================================

interface FilaCartera {
  c: CompanyData;
  porcentaje: number;
  nivel: ReturnType<typeof nivelPreparacion>;
  evaluados: number;
  aplicables: number;
  criticas: number;
  hallazgosAbiertos: number;
  hallazgosVencidos: number;
  ultimaActividad: string | null;
  diasSinActividad: number | null;
  dotacion: number;
}

/** Última fecha con registro en terreno (charla, inspección o hallazgo detectado) */
const ultimaActividad = (c: CompanyData): string | null => {
  const fechas = [...c.charlas.map((x) => x.fecha), ...c.inspecciones.map((x) => x.fecha), ...c.hallazgos.map((x) => x.fechaDeteccion)].filter(Boolean).sort();
  return fechas.length ? fechas[fechas.length - 1] : null;
};

const resumir = (c: CompanyData): FilaCartera => {
  const { resumen } = evaluarFuf(c);
  const alertas = calcularAlertas(c);
  const abiertos = c.hallazgos.filter((h) => h.estado !== 'cerrado');
  const ultima = ultimaActividad(c);
  return {
    c,
    porcentaje: resumen.porcentaje,
    nivel: nivelPreparacion(resumen),
    evaluados: resumen.cumple + resumen.noCumple,
    aplicables: resumen.aplicables,
    criticas: alertas.filter((a) => a.nivel === 'critico').length,
    hallazgosAbiertos: abiertos.length,
    hallazgosVencidos: abiertos.filter((h) => daysFromToday(h.fechaCompromiso) < 0).length,
    ultimaActividad: ultima,
    diasSinActividad: ultima ? -daysFromToday(ultima) : null,
    dotacion: dotacionEmpresa(c),
  };
};

/** Prioridad: alertas críticas, luego hallazgos vencidos, luego menor preparación DS 44 */
const ordenar = (a: FilaCartera, b: FilaCartera) => b.criticas - a.criticas || b.hallazgosVencidos - a.hallazgosVencidos || a.porcentaje - b.porcentaje;

function TarjetaEmpresa({ f, activa, onAbrir, onCumplimiento }: { f: FilaCartera; activa: boolean; onAbrir: () => void; onCumplimiento: () => void }) {
  const sinVisita = f.diasSinActividad !== null && f.diasSinActividad > 30;
  return (
    <Card className={cx(activa && 'ring-2 ring-navy')}>
      <button type="button" onClick={onAbrir} className="block w-full text-left" aria-label={`Abrir ${f.c.empresa.nombre}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-navy">{f.c.empresa.nombre}</p>
            <p className="text-xs text-slate-500">
              {RUBRO_LABEL[f.c.empresa.rubro]} · {f.dotacion} trabajadores
              {f.c.empresa.comuna ? ` · ${f.c.empresa.comuna}` : ''}
            </p>
          </div>
          {f.c.esDemo && <Badge tone="neutral">Demo</Badge>}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Cumplimiento DS 44</p>
            <p className="text-2xl font-bold text-navy tabular-nums">{f.porcentaje}%</p>
          </div>
          <Badge tone={f.nivel.tone}>{f.nivel.label}</Badge>
        </div>
        <div className="mt-2">
          <ProgressBar value={f.porcentaje} tone={f.nivel.tone} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {f.evaluados} de {f.aplicables} ítems evaluados
        </p>

        <ul className="mt-3 space-y-1.5 text-sm">
          <li className={cx('flex items-center gap-2', f.criticas ? 'text-crit' : 'text-slate-600')}>
            <AlertTriangle className="size-4 shrink-0" />
            {f.criticas ? `${f.criticas} ${f.criticas === 1 ? 'alerta crítica' : 'alertas críticas'}` : 'Sin alertas críticas'}
          </li>
          <li className={cx('flex items-center gap-2', f.hallazgosVencidos ? 'text-crit' : 'text-slate-600')}>
            <ClipboardList className="size-4 shrink-0" />
            {f.hallazgosAbiertos} {f.hallazgosAbiertos === 1 ? 'hallazgo abierto' : 'hallazgos abiertos'}
            {f.hallazgosVencidos ? ` (${f.hallazgosVencidos} vencidos)` : ''}
          </li>
          <li className={cx('flex items-center gap-2', sinVisita ? 'text-warn' : 'text-slate-600')}>
            <CalendarClock className="size-4 shrink-0" />
            {f.ultimaActividad
              ? `Último registro: ${formatDate(f.ultimaActividad)}${f.diasSinActividad !== null && f.diasSinActividad > 0 ? ` (hace ${f.diasSinActividad} días)` : ''}`
              : 'Sin registros en terreno'}
          </li>
        </ul>
      </button>
      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onCumplimiento}>
          Cumplimiento
        </Button>
        <Button size="sm" className="flex-1" icon={<ArrowRight className="size-4" />} onClick={onAbrir}>
          Abrir empresa
        </Button>
      </div>
    </Card>
  );
}

export default function Cartera() {
  const { state, setActiveCompany, navigate } = useStore();
  const [q, setQ] = useState('');

  const filas = useMemo(() => Object.values(state.companies).map(resumir).sort(ordenar), [state.companies]);
  const visibles = filas.filter((f) => `${f.c.empresa.nombre} ${f.c.empresa.comuna} ${f.c.empresa.razonSocial}`.toLowerCase().includes(q.trim().toLowerCase()));

  const conCriticas = filas.filter((f) => f.criticas > 0).length;
  const sinVisita = filas.filter((f) => f.diasSinActividad === null || f.diasSinActividad > 30).length;
  const promedio = filas.length ? Math.round(filas.reduce((s, f) => s + f.porcentaje, 0) / filas.length) : 0;

  const abrir = (id: string, vista: 'dashboard' | 'cumplimiento') => {
    setActiveCompany(id);
    navigate(vista);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Cartera de clientes" subtitle="Estado de cada empresa que atiende, ordenado por prioridad" icon={<BriefcaseBusiness className="size-6" />} />

      <StatGrid>
        <Stat label="Empresas" value={filas.length} hint="En su cartera" tone="neutral" />
        <Stat label="Con alertas críticas" value={conCriticas} hint="Atender primero" tone={conCriticas ? 'crit' : 'ok'} />
        <Stat label="Sin registro en 30 días" value={sinVisita} hint="Programar visita" tone={sinVisita ? 'warn' : 'ok'} />
        <Stat label="Cumplimiento promedio" value={`${promedio}%`} hint="Autoevaluación DS 44" tone="neutral" />
      </StatGrid>

      {filas.length > 3 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa o comuna" className="pl-9" aria-label="Buscar empresa" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibles.map((f) => (
          <TarjetaEmpresa key={f.c.id} f={f} activa={f.c.id === state.activeCompanyId} onAbrir={() => abrir(f.c.id, 'dashboard')} onCumplimiento={() => abrir(f.c.id, 'cumplimiento')} />
        ))}
      </div>
      {!visibles.length && <p className="py-8 text-center text-sm text-slate-500">No hay empresas con ese nombre.</p>}

      <p className="text-xs text-slate-500">
        Para agregar una empresa use el selector de empresa en la parte superior. El porcentaje DS 44 corresponde a la autoevaluación que usted registra en cada empresa.
      </p>
    </div>
  );
}
