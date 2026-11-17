import { useMemo, useState } from 'react';
import { ClipboardCheck, HardHat, Megaphone, ShieldCheck, Siren, Wrench, ChevronRight, CalendarCheck } from 'lucide-react';
import { useStore } from '../../../services/store';
import { useDiasSinCTP } from '../dashboard/Dashboard';
import { ReporteRapido } from '../incidentes/Incidentes';
import { daysFromToday, formatLongDate, todayISO } from '../../../utils/date';
import { Badge, Card, cx } from '../../ui';
import { CRIT_LABEL, CRIT_TONE } from '../inspecciones/Inspecciones';

function BigAction({ icon, title, sub, onClick, cls }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void; cls: string }) {
  return (
    <button type="button" onClick={onClick} className={cx('flex min-h-32 flex-col items-start justify-between rounded-2xl p-4 text-left shadow-sm transition-transform active:scale-[0.98]', cls)}>
      <span className="rounded-xl bg-white/20 p-2.5">{icon}</span>
      <span>
        <span className="block text-lg leading-tight font-bold">{title}</span>
        <span className="block text-xs opacity-85">{sub}</span>
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
        <h1 className="text-2xl font-bold text-navy">Hola, {state.usuario.split(' ')[0]} 👷</h1>
      </div>

      <div className="flex items-center gap-4 rounded-2xl bg-navy p-4 text-white">
        <ShieldCheck className="size-10 shrink-0 text-ok" />
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-wider text-ok uppercase">Días sin accidentes CTP</p>
          <p className="text-4xl leading-none font-black tabular-nums">{dias}</p>
        </div>
        <div className="text-right text-xs text-slate-300">
          Récord
          <p className="text-lg font-bold text-white">{record}</p>
        </div>
      </div>

      <Card bodyClass="p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-500 uppercase">
          <CalendarCheck className="size-4" /> Tareas del turno
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className={cx('flex items-center gap-2 rounded-lg px-3 py-2 font-medium', charlaHoy ? 'bg-ok-50 text-ok-800' : 'bg-warn-50 text-warn-800')}>
            {charlaHoy ? '✓' : '○'} Charla 5 min
          </span>
          <span className={cx('flex items-center gap-2 rounded-lg px-3 py-2 font-medium', checklistHoy ? 'bg-ok-50 text-ok-800' : 'bg-warn-50 text-warn-800')}>
            {checklistHoy ? '✓' : '○'} Checklist diario
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <BigAction icon={<Megaphone className="size-7" />} title="Charla 5 Minutos" sub="Con firma táctil" cls="bg-ok text-white" onClick={() => navigate('charlas', { nuevo: '1' })} />
        <BigAction icon={<Siren className="size-7" />} title="Reportar" sub="Cuasi-accidente o condición" cls="bg-crit text-white" onClick={() => setReporte(true)} />
        <BigAction icon={<ClipboardCheck className="size-7" />} title="Checklist" sub="Área, equipos o AST" cls="bg-navy text-white" onClick={() => navigate('inspecciones')} />
        <BigAction icon={<HardHat className="size-7" />} title="Entregar EPP" sub="Con firma de recepción" cls="bg-warn text-navy" onClick={() => navigate('epp')} />
      </div>

      <Card
        title="Mis hallazgos pendientes"
        icon={<Wrench className="size-5" />}
        actions={
          <button type="button" onClick={() => navigate('hallazgos')} className="text-sm font-semibold text-navy hover:underline">
            Ver todos
          </button>
        }
        bodyClass="p-0"
      >
        {misHallazgos.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No tiene hallazgos asignados pendientes. 👍</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {misHallazgos.slice(0, 5).map((h) => {
              const d = daysFromToday(h.fechaCompromiso);
              return (
                <li key={h.id}>
                  <button type="button" onClick={() => navigate('hallazgos')} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <Badge tone={CRIT_TONE[h.criticidad]}>{CRIT_LABEL[h.criticidad]}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy">{h.descripcion}</span>
                      <span className={cx('text-xs', d < 0 ? 'font-semibold text-crit' : 'text-slate-500')}>{d < 0 ? `Vencido hace ${-d} días` : `Vence en ${d} días`}</span>
                    </span>
                    <ChevronRight className="size-4 text-slate-400" />
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
