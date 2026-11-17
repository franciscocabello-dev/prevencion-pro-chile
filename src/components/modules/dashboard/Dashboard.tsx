import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Calculator,
  ChevronRight,
  FileDown,
  Flame,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  Siren,
  Table2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useStore } from '../../../services/store';
import { calcularAlertas, type Alerta } from '../../../services/alerts';
import { calcularIndicadores, calcularTasas, fmtCLP, fmtNum } from '../../../utils/indicators';
import { daysFromToday, diffDays, lastMonths, monthKey, monthLabel, parseISO, todayISO, addDays } from '../../../utils/date';
import { generarReporteEjecutivo } from '../../../utils/pdfGenerator';
import { Badge, Button, Card, Field, Input, PageHeader, ProgressBar, Stat, cx } from '../../ui';
import type { CompanyData, Indicadores, TasasLegales } from '../../../types';

/** Paletas validadas (CVD, contraste) para superficie clara y oscura */
const chartColors = () => {
  const dark = document.documentElement.dataset.theme === 'oscuro';
  return dark
    ? { a: '#2563EB', b: '#0891B2', grid: '#1E293B', axis: '#94A3B8', axisLine: '#334155', cursor: '#1E293B', tooltipBg: '#111A2E', tooltipBorder: '#334155', tooltipText: '#E2E8F0' }
    : { a: '#1D4ED8', b: '#0EA5E9', grid: '#E2E8F0', axis: '#64748B', axisLine: '#CBD5E1', cursor: '#F1F5F9', tooltipBg: '#FFFFFF', tooltipBorder: '#E2E8F0', tooltipText: '#0F172A' };
};

// ------------------------------------------------------------
// Contador en vivo de días sin accidentes CTP
// ------------------------------------------------------------
export function useDiasSinCTP(company: CompanyData) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const desde = parseISO(company.fechaUltimoAccidenteCTP).getTime();
  const ms = Math.max(0, now - desde);
  const dias = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { dias, h, m, s, record: Math.max(company.recordDiasSinAccidentes, dias) };
}

function SafetyBanner() {
  const { company, navigate } = useStore();
  const { dias, h, m, s, record } = useDiasSinCTP(company);
  const pct = record > 0 ? Math.min(100, (dias / record) * 100) : 100;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="relative overflow-hidden rounded-2xl bg-navy p-5 text-white shadow-lg sm:p-6">
      <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-ok/15 blur-2xl" />
      <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-ok uppercase">
            <ShieldCheck className="size-4" /> Días sin accidentes con tiempo perdido (CTP)
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
            <span className="text-6xl leading-none font-black tabular-nums sm:text-7xl">{dias}</span>
            <span className="pb-1 font-mono text-lg text-slate-300 tabular-nums">
              {pad(h)}:{pad(m)}:{pad(s)}
            </span>
          </div>
          <div className="mt-4 max-w-md">
            <div className="mb-1 flex justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1">
                <Award className="size-3.5 text-warn" /> Récord histórico: <b className="text-white">{record} días</b>
              </span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
          <Button variant="success" size="lg" icon={<Megaphone className="size-5" />} onClick={() => navigate('charlas', { nuevo: '1' })}>
            + Nueva Charla
          </Button>
          <Button variant="danger" size="lg" icon={<Siren className="size-5" />} onClick={() => navigate('incidentes', { nuevo: '1' })}>
            + Reportar Incidente
          </Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Calculadora de indicadores DS 40 / DS 67
// ------------------------------------------------------------
function IndicatorCalculator() {
  const { company, updateCompany, can, notify } = useStore();
  const ind = company.indicadores;
  const r = calcularIndicadores(ind);
  const editable = can('editarIndicadores');

  const set = (k: keyof Indicadores, v: string) =>
    updateCompany((c) => ({ ...c, indicadores: { ...c.indicadores, [k]: k === 'periodo' ? v : Math.max(0, Number(v) || 0) } }));

  const sincronizar = () => {
    const desde = addDays(todayISO(), -365);
    const ctp = company.incidentes.filter((i) => i.tipo === 'accidente_ctp' && i.fecha >= desde);
    updateCompany((c) => ({
      ...c,
      indicadores: {
        ...c.indicadores,
        accidentesCTP: ctp.length,
        diasPerdidos: ctp.reduce((a, i) => a + i.diasPerdidos, 0),
        promedioTrabajadores: c.indicadores.promedioTrabajadores || c.trabajadores.filter((t) => t.activo).length,
      },
    }));
    notify(`Sincronizado: ${ctp.length} accidentes CTP en los últimos 12 meses.`);
  };

  const fields: { k: keyof Indicadores; label: string; step?: number }[] = [
    { k: 'promedioTrabajadores', label: 'N° promedio trabajadores' },
    { k: 'horasHombre', label: 'Horas-hombre trabajadas', step: 1000 },
    { k: 'accidentesCTP', label: 'Accidentes CTP' },
    { k: 'diasPerdidos', label: 'Días perdidos' },
  ];

  const tasaTone = r.tasaAccidentabilidad > 3 ? 'crit' : r.tasaAccidentabilidad > 1.5 ? 'warn' : 'ok';

  return (
    <Card
      title="Calculadora de Indicadores Legales"
      subtitle="DS 40 · DS 67 · Estadística Ley 16.744"
      icon={<Calculator className="size-5" />}
      actions={
        editable && (
          <Button size="sm" variant="secondary" icon={<RefreshCw className="size-4" />} onClick={sincronizar}>
            Sincronizar desde incidentes
          </Button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {fields.map((f) => (
          <Field key={f.k} label={f.label}>
            <Input type="number" min={0} step={f.step ?? 1} inputMode="numeric" value={ind[f.k] as number} disabled={!editable} onChange={(e) => set(f.k, e.target.value)} />
          </Field>
        ))}
      </div>
      <Field label="Período evaluado" className="mt-3">
        <Input value={ind.periodo} disabled={!editable} onChange={(e) => set('periodo', e.target.value)} />
      </Field>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase">Tasa de Accidentabilidad</p>
            <Badge tone={tasaTone} dot>
              {tasaTone === 'ok' ? 'Baja' : tasaTone === 'warn' ? 'Media' : 'Alta'}
            </Badge>
          </div>
          <p className="mt-1 text-3xl font-bold text-navy tabular-nums">{fmtNum(r.tasaAccidentabilidad)}%</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">(CTP ÷ Prom. trabajadores) × 100</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase">Índice de Frecuencia (IF)</p>
          <p className="mt-1 text-3xl font-bold text-navy tabular-nums">{fmtNum(r.indiceFrecuencia)}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">(CTP × 1.000.000) ÷ HH</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase">Índice de Gravedad (IG)</p>
          <p className="mt-1 text-3xl font-bold text-navy tabular-nums">{fmtNum(r.indiceGravedad, 1)}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">(Días perdidos × 1.000.000) ÷ HH</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <p className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
          Tasa de siniestralidad temporal (DS 67): <b className="tabular-nums">{fmtNum(r.tasaSiniestralidad)}</b>
        </p>
        <p className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
          Promedio días perdidos por accidente: <b className="tabular-nums">{fmtNum(r.promedioDiasPorAccidente, 1)}</b>
        </p>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------
// Tasas de cotización (DS 110 vs DS 67)
// ------------------------------------------------------------
function TasasPanel() {
  const { company, updateCompany, can } = useStore();
  const t = company.tasas;
  const r = calcularTasas(t);
  const editable = can('editarTasas');
  const set = (k: keyof TasasLegales, v: string) => updateCompany((c) => ({ ...c, tasas: { ...c.tasas, [k]: Math.max(0, Number(v) || 0) } }));
  const sube = r.diferenciaAnual > 0;
  return (
    <Card title="Cotización Ley 16.744 y Costos" subtitle="Proyección de evaluación DS 67 (referencial)" icon={<TrendingUp className="size-5" />}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cotización básica %">
          <Input type="number" step={0.01} value={t.cotizacionBasica} disabled={!editable} onChange={(e) => set('cotizacionBasica', e.target.value)} />
        </Field>
        <Field label="Adicional DS 110 %">
          <Input type="number" step={0.01} value={t.cotizacionAdicionalDS110} disabled={!editable} onChange={(e) => set('cotizacionAdicionalDS110', e.target.value)} />
        </Field>
        <Field label="Extraordinaria %">
          <Input type="number" step={0.01} value={t.cotizacionExtraordinaria} disabled={!editable} onChange={(e) => set('cotizacionExtraordinaria', e.target.value)} />
        </Field>
        <Field label="Tasa siniestralidad prom. 3 años">
          <Input type="number" step={1} value={t.tasaSiniestralidadDS67} disabled={!editable} onChange={(e) => set('tasaSiniestralidadDS67', e.target.value)} />
        </Field>
        <Field label="Factor invalideces y muertes">
          <Input type="number" step={5} value={t.invalidecesYMuertes} disabled={!editable} onChange={(e) => set('invalidecesYMuertes', e.target.value)} />
        </Field>
        <Field label="Remuneración imponible mensual ($)">
          <Input type="number" step={100000} value={t.remuneracionImponibleMensual} disabled={!editable} onChange={(e) => set('remuneracionImponibleMensual', e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase">Vigente</p>
          <p className="text-2xl font-bold text-navy tabular-nums">{fmtNum(r.totalDS110)}%</p>
          <p className="text-xs text-slate-500 tabular-nums">{fmtCLP(r.costoMensualDS110)} / mes</p>
        </div>
        <div className={cx('rounded-xl p-3 ring-1', sube ? 'bg-crit-50 ring-crit/30' : 'bg-ok-50 ring-ok/30')}>
          <p className="text-xs font-semibold text-slate-500 uppercase">Proyección DS 67</p>
          <p className="text-2xl font-bold text-navy tabular-nums">{fmtNum(r.totalDS67)}%</p>
          <p className="text-xs text-slate-500 tabular-nums">Adicional {fmtNum(r.adicionalDS67)}% · {fmtCLP(r.costoMensualDS67)} / mes</p>
        </div>
      </div>
      <p className={cx('mt-3 rounded-lg px-3 py-2 text-sm font-semibold', sube ? 'bg-crit-50 text-crit-800' : 'bg-ok-50 text-ok-800')}>
        {sube ? '▲ Recargo' : r.diferenciaAnual < 0 ? '▼ Rebaja' : '= Sin cambio'} anual estimado: {fmtCLP(Math.abs(r.diferenciaAnual))}
      </p>
      {!editable && <p className="mt-2 text-xs text-slate-500">Sólo el Prevencionista puede modificar las tasas legales.</p>}
    </Card>
  );
}

// ------------------------------------------------------------
// Gráficos
// ------------------------------------------------------------
function ChartTable({ rows, cols }: { rows: Record<string, string | number>[]; cols: { k: string; label: string }[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            {cols.map((c) => (
              <th key={c.k} className="px-2 py-1 font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {cols.map((c) => (
                <td key={c.k} className="px-2 py-1 text-navy tabular-nums">
                  {r[c.k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Charts() {
  const { company } = useStore();
  const [tabla, setTabla] = useState(false);

  const porArea = useMemo(
    () =>
      company.areas.map((area) => ({
        area,
        Incidentes: company.incidentes.filter((i) => i.area === area).length,
        Hallazgos: company.hallazgos.filter((h) => h.area === area).length,
      })),
    [company],
  );

  const mensual = useMemo(
    () =>
      lastMonths(6).map((k) => ({
        mes: monthLabel(k),
        Charlas: company.charlas.filter((c) => monthKey(c.fecha) === k).length,
        'Acciones cerradas':
          company.hallazgos.filter((h) => h.estado === 'cerrado' && h.fechaCierre && monthKey(h.fechaCierre) === k).length +
          company.incidentes.reduce((a, i) => a + (i.investigacion?.medidas.filter((m) => m.estado === 'cumplida' && monthKey(m.fechaCompromiso) === k).length ?? 0), 0),
      })),
    [company],
  );

  const k = chartColors();
  const SERIE_A = k.a;
  const SERIE_B = k.b;
  const tooltipStyle = { borderRadius: 10, border: `1px solid ${k.tooltipBorder}`, fontSize: 12, background: k.tooltipBg, color: k.tooltipText };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card
        title="Incidentes y hallazgos por área"
        icon={<BarChart3 className="size-5" />}
        actions={
          <Button size="sm" variant="ghost" icon={<Table2 className="size-4" />} onClick={() => setTabla((t) => !t)}>
            {tabla ? 'Ocultar tabla' : 'Ver tabla'}
          </Button>
        }
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porArea} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={k.grid} />
              <XAxis dataKey="area" tick={{ fontSize: 11, fill: k.axis }} tickLine={false} axisLine={{ stroke: k.axisLine }} interval={0} angle={-18} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: k.axis }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: k.cursor }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              <Bar dataKey="Incidentes" fill={SERIE_A} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Hallazgos" fill={SERIE_B} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {tabla && <ChartTable rows={porArea} cols={[{ k: 'area', label: 'Área' }, { k: 'Incidentes', label: 'Incidentes' }, { k: 'Hallazgos', label: 'Hallazgos' }]} />}
      </Card>
      <Card
        title="Evolución mensual: charlas vs. acciones cerradas"
        icon={<TrendingUp className="size-5" />}
        actions={
          <Button size="sm" variant="ghost" icon={<Table2 className="size-4" />} onClick={() => setTabla((t) => !t)}>
            {tabla ? 'Ocultar tabla' : 'Ver tabla'}
          </Button>
        }
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mensual} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={k.grid} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: k.axis }} tickLine={false} axisLine={{ stroke: k.axisLine }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: k.axis }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: k.cursor }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              <Bar dataKey="Charlas" fill={SERIE_A} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Acciones cerradas" fill={SERIE_B} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {tabla && <ChartTable rows={mensual} cols={[{ k: 'mes', label: 'Mes' }, { k: 'Charlas', label: 'Charlas' }, { k: 'Acciones cerradas', label: 'Acciones cerradas' }]} />}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------
// Alertas críticas
// ------------------------------------------------------------
export function AlertsBoard({ alertas, limit }: { alertas: Alerta[]; limit?: number }) {
  const { navigate } = useStore();
  const [all, setAll] = useState(false);
  const shown = all || !limit ? alertas : alertas.slice(0, limit);
  const criticas = alertas.filter((a) => a.nivel === 'critico').length;
  return (
    <Card
      title="Alertas Críticas y Vencimientos"
      subtitle={`${criticas} críticas · ${alertas.length - criticas} advertencias`}
      icon={<AlertTriangle className="size-5" />}
    >
      {alertas.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg bg-ok-50 px-3 py-3 text-sm font-medium text-ok-800">
          <ShieldCheck className="size-5" /> Sin alertas pendientes. ¡Excelente gestión!
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => navigate(a.vista)} className="flex w-full items-start gap-3 py-2.5 text-left hover:bg-slate-50">
                <span className={cx('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', a.nivel === 'critico' ? 'bg-crit-50 text-crit' : 'bg-warn-50 text-warn-700')}>
                  {a.categoria === 'Extintores' ? <Flame className="size-4" /> : <AlertTriangle className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-navy">{a.titulo}</span>
                    <Badge tone={a.nivel === 'critico' ? 'crit' : 'warn'}>{a.nivel === 'critico' ? 'Crítico' : 'Alerta'}</Badge>
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {a.categoria} · {a.detalle}
                  </span>
                </span>
                <ChevronRight className="mt-2 size-4 shrink-0 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {limit && alertas.length > limit && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAll((x) => !x)}>
          {all ? 'Ver menos' : `Ver todas (${alertas.length})`}
        </Button>
      )}
    </Card>
  );
}

// ------------------------------------------------------------
// Cumplimiento por supervisor (vista gerencial)
// ------------------------------------------------------------
function SupervisorCompliance() {
  const { company } = useStore();
  const desde = addDays(todayISO(), -30);
  const rows = company.supervisores.map((s) => {
    const hs = company.hallazgos.filter((h) => h.responsable === s);
    const cerrados = hs.filter((h) => h.estado === 'cerrado').length;
    const vencidos = hs.filter((h) => h.estado !== 'cerrado' && daysFromToday(h.fechaCompromiso) < 0).length;
    return {
      s,
      charlas30: company.charlas.filter((c) => c.relator === s && c.fecha >= desde).length,
      insp30: company.inspecciones.filter((i) => i.inspector === s && i.fecha >= desde).length,
      hs: hs.length,
      cerrados,
      vencidos,
      pct: hs.length ? Math.round((cerrados / hs.length) * 100) : 100,
    };
  });
  return (
    <Card title="Seguimiento de cumplimiento por supervisor" subtitle="Últimos 30 días y hallazgos asignados" icon={<Users className="size-5" />}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No hay supervisores configurados.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                <th className="px-4 py-2 sm:px-2">Supervisor</th>
                <th className="px-2 py-2 text-center">Charlas</th>
                <th className="px-2 py-2 text-center">Inspecc.</th>
                <th className="px-2 py-2 text-center">Hallazgos</th>
                <th className="px-2 py-2 text-center">Vencidos</th>
                <th className="w-40 px-2 py-2">% Cierre</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.s} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-navy sm:px-2">{r.s}</td>
                  <td className="px-2 text-center tabular-nums">{r.charlas30}</td>
                  <td className="px-2 text-center tabular-nums">{r.insp30}</td>
                  <td className="px-2 text-center tabular-nums">{r.hs}</td>
                  <td className="px-2 text-center">{r.vencidos > 0 ? <Badge tone="crit">{r.vencidos}</Badge> : <Badge tone="ok">0</Badge>}</td>
                  <td className="px-2">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={r.pct} />
                      <span className="w-10 text-right text-xs font-semibold tabular-nums">{r.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------
// Vista principal
// ------------------------------------------------------------
export default function Dashboard() {
  const { company, rol, can, notify } = useStore();
  const alertas = useMemo(() => calcularAlertas(company), [company]);
  const { dias } = useDiasSinCTP(company);

  const abiertos = company.hallazgos.filter((h) => h.estado !== 'cerrado');
  const criticosAbiertos = abiertos.filter((h) => h.criticidad === 'alto').length;
  const desde = addDays(todayISO(), -30);
  const charlasMes = company.charlas.filter((c) => c.fecha >= desde).length;
  const capacitados = new Set(company.charlas.filter((c) => c.fecha >= desde).flatMap((c) => c.asistentes.map((a) => a.rut))).size;
  const inspProm = company.inspecciones.length ? Math.round(company.inspecciones.reduce((a, i) => a + i.cumplimiento, 0) / company.inspecciones.length) : 0;
  const pendientesAprob = abiertos.filter((h) => !h.planAprobado).length;
  const diasPerdidosAnio = company.incidentes.filter((i) => diffDays(i.fecha, todayISO()) <= 365).reduce((a, i) => a + i.diasPerdidos, 0);
  const costoDiasPerdidos = company.tasas.remuneracionImponibleMensual && company.indicadores.promedioTrabajadores
    ? (company.tasas.remuneracionImponibleMensual / company.indicadores.promedioTrabajadores / 30) * diasPerdidosAnio
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={rol === 'gerencia' ? 'Vista Ejecutiva y Control' : 'Dashboard Ejecutivo'}
        subtitle={`${company.empresa.nombre} · ${company.indicadores.periodo}`}
        icon={<BarChart3 className="size-6" />}
        actions={
          can('reporteEjecutivo') && (
            <Button
              variant="primary"
              icon={<FileDown className="size-4" />}
              onClick={() => {
                generarReporteEjecutivo(company, alertas, dias);
                notify('Reporte ejecutivo PDF descargado');
              }}
            >
              Reporte ejecutivo PDF
            </Button>
          )
        }
      />
      <SafetyBanner />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hallazgos abiertos" value={abiertos.length} hint={`${criticosAbiertos} de criticidad alta`} tone={criticosAbiertos ? 'crit' : abiertos.length ? 'warn' : 'ok'} />
        <Stat label="Charlas (30 días)" value={charlasMes} hint={`${capacitados} trabajadores capacitados`} tone={charlasMes >= 4 ? 'ok' : 'warn'} />
        <Stat label="Cumplimiento inspecciones" value={`${inspProm}%`} hint={`${company.inspecciones.length} inspecciones registradas`} tone={inspProm >= 85 ? 'ok' : inspProm >= 70 ? 'warn' : 'crit'} />
        {rol === 'gerencia' ? (
          <Stat label="Costo días perdidos (12m)" value={fmtCLP(costoDiasPerdidos)} hint={`${diasPerdidosAnio} días perdidos · estimado`} tone={diasPerdidosAnio > 0 ? 'warn' : 'ok'} />
        ) : (
          <Stat label="Planes por aprobar" value={pendientesAprob} hint="Requieren visto bueno de Gerencia" tone={pendientesAprob ? 'warn' : 'ok'} />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <IndicatorCalculator />
        <AlertsBoard alertas={alertas} limit={7} />
      </div>

      <Charts />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SupervisorCompliance />
        <TasasPanel />
      </div>
    </div>
  );
}
