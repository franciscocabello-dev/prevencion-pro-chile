import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronRight, Circle, ClipboardCheck, HardHat, Megaphone, Siren } from 'lucide-react';
import { useStore } from '../../../services/store';
import { useDiasSinCTP } from '../dashboard/Dashboard';
import { ReporteRapido } from '../incidentes/Incidentes';
import { daysFromToday, formatLongDate, todayISO } from '../../../utils/date';
import { Badge, Card, ProgressBar, cx } from '../../ui';
import { CRIT_LABEL, CRIT_TONE } from '../inspecciones/Inspecciones';

function Accion({ icon, title, sub, onClick, critical }: { icon: ReactNode; title: string; sub: string; onClick: () => void; critical?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex min-h-[104px] min-w-0 flex-col justify-between gap-3 bg-white p-4 text-left transition-colors active:bg-slate-50',
        critical && 'text-crit-700',
      )}
    >
      <span className={cx('flex size-10 items-center justify-center rounded-md border', critical ? 'border-crit/30 bg-crit-50 text-crit-700' : 'border-slate-200 text-navy')}>{icon}</span>
      <span className="min-w-0">
        <span className={cx('block text-[15px] leading-tight font-semibold', critical ? 'text-crit-700' : 'text-navy')}>{title}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{sub}</span>
      </span>
    </button>
  );
}

export default function SupervisorHome() {
  const { company, state, navigate } = useStore();
  const { dias, record } = useDiasSinCTP(company);
  const [reporte, setReporte] = useState(false);
  const hoy = todayISO();

  const misHallazgos = useMemo(
    () =>
      company.hallazgos
        .filter((h) => h.responsable === state.usuario && h.estado !== 'cerrado')
        .sort((a, b) => a.fechaCompromiso.localeCompare(b.fechaCompromiso)),
    [company.hallazgos, state.usuario],
  );
  const charlaHoy = company.charlas.some((c) => c.fecha === hoy && c.relator === state.usuario);
  const checklistHoy = company.inspecciones.some((i) => i.fecha === hoy && i.inspector === state.usuario);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-sm text-slate-500">{formatLongDate(hoy)}</p>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-navy">Hola, {state.usuario.split(' ')[0]}</h1>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
              <span className="size-2 rounded-full bg-ok" /> Días sin accidentes CTP
            </p>
            <p className="mt-1.5 text-5xl leading-none font-semibold tracking-tight text-ok-700 tabular-nums">{dias}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium tracking-[0.06em] text-slate-500 uppercase">Récord</p>
            <p className="text-xl font-semibold text-navy tabular-nums">{record}</p>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={record ? (dias / record) * 100 : 100} tone="ok" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
        {[
          { ok: charlaHoy, label: 'Charla 5 min' },
          { ok: checklistHoy, label: 'Checklist diario' },
        ].map((t) => (
          <div key={t.label} className="flex min-h-12 items-center gap-2 bg-white px-3.5 text-sm">
            {t.ok ? <CheckCircle2 className="size-4 shrink-0 text-ok" /> : <Circle className="size-4 shrink-0 text-warn" />}
            <span className={cx('truncate', t.ok ? 'text-navy' : 'font-medium text-navy')}>{t.label}</span>
            <span className="ml-auto text-xs text-slate-500">{t.ok ? 'Hecho' : 'Pendiente'}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
        <Accion icon={<Megaphone className="size-5" />} title="Charla 5 minutos" sub="Firma táctil o kiosco" onClick={() => navigate('charlas', { nuevo: '1' })} />
        <Accion icon={<Siren className="size-5" />} title="Reportar" sub="Cuasi-accidente o condición" onClick={() => setReporte(true)} critical />
        <Accion icon={<ClipboardCheck className="size-5" />} title="Checklist" sub="Área, equipos o AST" onClick={() => navigate('inspecciones')} />
        <Accion icon={<HardHat className="size-5" />} title="Entregar EPP" sub="Con firma de recepción" onClick={() => navigate('epp')} />
      </div>

      <Card
        title="Mis hallazgos pendientes"
        subtitle={<span className="tabular-nums">{misHallazgos.length} asignados</span>}
        actions={
          <button type="button" onClick={() => navigate('hallazgos')} className="min-h-11 px-1 text-sm font-medium text-navy hover:underline">
            Ver todos
          </button>
        }
        bodyClass="p-0"
      >
        {misHallazgos.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No tiene hallazgos asignados pendientes.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {misHallazgos.slice(0, 5).map((h) => {
              const d = daysFromToday(h.fechaCompromiso);
              return (
                <li key={h.id}>
                  <button type="button" onClick={() => navigate('hallazgos')} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                    <Badge tone={CRIT_TONE[h.criticidad]}>{CRIT_LABEL[h.criticidad]}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy">{h.descripcion}</span>
                      <span className={cx('text-xs tabular-nums', d < 0 ? 'font-medium text-crit-700' : 'text-slate-500')}>{d < 0 ? `Vencido hace ${-d} días` : `Vence en ${d} días`}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {reporte && <ReporteRapido onClose={() => setReporte(false)} />}
    </div>
  );
}
