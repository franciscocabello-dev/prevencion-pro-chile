import { useMemo, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CalendarClock, Search } from 'lucide-react';
import { useStore } from '../../../services/store';
import { calcularAlertas } from '../../../services/alerts';
import { evaluarFuf, nivelPreparacion, dotacionEmpresa } from '../../../utils/cumplimientoDs44';
import { daysFromToday } from '../../../utils/date';
import { RUBRO_LABEL } from '../../../data/catalogos';
import type { CompanyData } from '../../../types';
import { Badge, Button, Card, Input, PageHeader, Stat, StatGrid, cx } from '../../ui';

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

/** Última fecha con registro en terreno (visita, charla, inspección o hallazgo detectado) */
const ultimaActividad = (c: CompanyData): string | null => {
  const fechas = [...(c.visitas ?? []).map((x) => x.fecha), ...c.charlas.map((x) => x.fecha), ...c.inspecciones.map((x) => x.fecha), ...c.hallazgos.map((x) => x.fechaDeteccion)].filter(Boolean).sort();
  return fechas.length ? fechas[fechas.length - 1] : null;
};

type EstadoCliente = { tone: 'crit' | 'warn' | 'ok' | 'neutral'; label: string };

/** Un solo estado por empresa: el rojo se reserva para lo que exige acción inmediata */
const estadoCliente = (f: FilaCartera): EstadoCliente => {
  if (f.criticas > 0 || f.hallazgosVencidos > 0) return { tone: 'crit', label: 'Requiere acción' };
  if (f.diasSinActividad === null || f.diasSinActividad > 30 || f.hallazgosAbiertos > 0) return { tone: 'warn', label: 'Seguimiento' };
  if (f.evaluados === 0) return { tone: 'neutral', label: 'Sin evaluar' };
  return { tone: 'ok', label: 'Al día' };
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
  const estado = estadoCliente(f);
  const sinEvaluar = f.evaluados === 0;
  return (
    <Card className={cx('relative overflow-hidden', activa && 'ring-2 ring-navy')}>
      <span className={cx('absolute inset-y-0 left-0 w-1', { crit: 'bg-crit', warn: 'bg-warn', ok: 'bg-ok', neutral: 'bg-slate-300' }[estado.tone])} aria-hidden />
      <button type="button" onClick={onAbrir} className="block w-full text-left" aria-label={`Abrir ${f.c.empresa.nombre}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-navy">{f.c.empresa.nombre}</p>
            <p className="text-xs text-slate-500">
              {RUBRO_LABEL[f.c.empresa.rubro]} · {f.dotacion} trabajadores
              {f.c.empresa.comuna ? ` · ${f.c.empresa.comuna}` : ''}
            </p>
          </div>
          <Badge tone={estado.tone}>{estado.label}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-slate-50 px-2 py-2">
            <p className={cx('text-lg font-bold tabular-nums', f.criticas ? 'text-crit' : 'text-navy')}>{f.criticas}</p>
            <p className="text-[11px] leading-tight text-slate-500">alertas críticas</p>
          </div>
          <div className="rounded-md bg-slate-50 px-2 py-2">
            <p className={cx('text-lg font-bold tabular-nums', f.hallazgosVencidos ? 'text-crit' : 'text-navy')}>{f.hallazgosAbiertos}</p>
            <p className="text-[11px] leading-tight text-slate-500">{f.hallazgosVencidos ? `hallazgos (${f.hallazgosVencidos} vencidos)` : 'hallazgos abiertos'}</p>
          </div>
          <div className="rounded-md bg-slate-50 px-2 py-2">
            <p className="text-lg font-bold text-navy tabular-nums">{sinEvaluar ? '–' : `${f.porcentaje}%`}</p>
            <p className="text-[11px] leading-tight text-slate-500">{sinEvaluar ? 'DS 44 sin evaluar' : 'DS 44'}</p>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarClock className="size-3.5 shrink-0" />
          {f.ultimaActividad
            ? `Último registro ${f.diasSinActividad === 0 ? 'hoy' : f.diasSinActividad === 1 ? 'ayer' : `hace ${f.diasSinActividad} días`}`
            : 'Sin registros en terreno'}
          {f.c.esDemo && <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">DEMO</span>}
        </p>
      </button>
      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onCumplimiento}>
          {sinEvaluar ? 'Evaluar DS 44' : 'Cumplimiento'}
        </Button>
        <Button size="sm" className="flex-1" icon={<ArrowRight className="size-4" />} onClick={onAbrir}>
          Abrir
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
  const evaluadas = filas.filter((f) => f.evaluados > 0);
  const promedio = evaluadas.length ? `${Math.round(evaluadas.reduce((s, f) => s + f.porcentaje, 0) / evaluadas.length)}%` : '–';

  const abrir = (id: string, vista: 'dashboard' | 'cumplimiento') => {
    setActiveCompany(id);
    navigate(vista);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Cartera de clientes" subtitle="Las empresas que necesitan atención aparecen primero" icon={<BriefcaseBusiness className="size-6" />} />

      <StatGrid>
        <Stat label="Empresas" value={filas.length} hint="En su cartera" tone="neutral" />
        <Stat label="Con alertas críticas" value={conCriticas} hint="Atender primero" tone={conCriticas ? 'crit' : 'ok'} />
        <Stat label="Sin registro en 30 días" value={sinVisita} hint="Programar visita" tone={sinVisita ? 'warn' : 'ok'} />
        <Stat label="Cumplimiento DS 44" value={promedio} hint={evaluadas.length ? `Promedio de ${evaluadas.length} evaluadas` : 'Ninguna evaluada aún'} tone="neutral" />
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
