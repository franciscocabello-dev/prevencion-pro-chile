import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ChevronDown, ChevronRight, FileDown, Flame, Megaphone, RefreshCw, ShieldCheck, SlidersHorizontal, Siren, Table2 } from 'lucide-react';
import { useStore } from '../../../services/store';
import { calcularAlertas, type Alerta } from '../../../services/alerts';
import { calcularIndicadores, calcularTasas, fmtCLP, fmtNum, type ResultadoIndicadores } from '../../../utils/indicators';
import { daysFromToday, diffDays, lastMonths, monthKey, monthLabel, parseISO, todayISO, addDays } from '../../../utils/date';
import { generarReporteEjecutivo } from '../../../utils/pdfGenerator';
import { evaluarFuf } from '../../../utils/cumplimientoDs44';
import { Badge, Button, Card, CountUp, Field, Input, Modal, ProgressBar, ProgressRing, Stat, StatGrid, cx, escalon, saludo, type Tone } from '../../ui';
import type { CompanyData, Indicadores, TasasLegales } from '../../../types';

/** Paletas validadas (CVD, contraste) para superficie clara y oscura */
const chartColors = () => {
  const dark = document.documentElement.dataset.theme === 'oscuro';
  return dark
    ? { a: '#2563EB', b: '#0891B2', grid: '#27272A', axis: '#A1A1AA', axisLine: '#3F3F46', cursor: '#1F1F23', tooltipBg: '#111113', tooltipBorder: '#3F3F46', tooltipText: '#FAFAFA' }
    : { a: '#1D4ED8', b: '#0EA5E9', grid: '#E2E8F0', axis: '#64748B', axisLine: '#CBD5E1', cursor: '#F1F5F9', tooltipBg: '#FFFFFF', tooltipBorder: '#CBD5E1', tooltipText: '#0F172A' };
};

// ------------------------------------------------------------
// Estado normativo / referencial de cada indicador
// ------------------------------------------------------------
interface Estado {
  tone: Tone;
  label: string;
}
const estadoTasa = (v: number): Estado => (v <= 1.5 ? { tone: 'ok', label: 'Bajo' } : v <= 3 ? { tone: 'warn', label: 'Medio' } : { tone: 'crit', label: 'Alto' });
const estadoIF = (v: number): Estado => (v <= 10 ? { tone: 'ok', label: 'Bajo' } : v <= 25 ? { tone: 'warn', label: 'Medio' } : { tone: 'crit', label: 'Alto' });
const estadoIG = (v: number): Estado => (v <= 100 ? { tone: 'ok', label: 'Bajo' } : v <= 300 ? { tone: 'warn', label: 'Medio' } : { tone: 'crit', label: 'Alto' });

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
  const { company, state, navigate, can, notify, rol } = useStore();
  const { dias, h, m, s, record } = useDiasSinCTP(company);
  const pct = record > 0 ? Math.min(100, (dias / record) * 100) : 100;
  const pad = (n: number) => String(n).padStart(2, '0');
  const { resumen } = useMemo(() => evaluarFuf(company), [company]);
  const evaluado = resumen.cumple + resumen.noCumple > 0;
  const alertas = useMemo(() => calcularAlertas(company), [company]);
  const nombre = (state.usuario || '').split(' ')[0];
  const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors';
  return (
    <section className="hero rise overflow-hidden rounded-xl p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-white/70">
            {saludo()}
            {nombre ? `, ${nombre}` : ''}
          </p>
          <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight sm:text-2xl">{company.empresa.nombre}</h1>
        </div>
        {can('reporteEjecutivo') && (
          <button
            type="button"
            onClick={() => {
              generarReporteEjecutivo(company, alertas, dias);
              notify('Reporte ejecutivo PDF descargado');
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-white/20 px-3 text-xs font-semibold text-white/90 hover:bg-white/10"
          >
            <FileDown className="size-4" />
            <span className="hidden sm:inline">Reporte ejecutivo</span> PDF
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:flex sm:items-center sm:gap-8">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <ProgressRing value={pct} size={112} stroke={10} tone="light" track="rgba(255,255,255,0.12)" label={`${dias} días sin accidentes con tiempo perdido`}>
            <span className="text-4xl leading-none font-bold tabular-nums">
              <CountUp value={dias} />
            </span>
            <span className="mt-1 text-[10px] font-semibold tracking-[0.08em] text-white/60 uppercase">días</span>
          </ProgressRing>
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold">Sin accidentes con tiempo perdido</p>
            <p className="text-xs text-white/60">
              Récord {record} días · <span className="font-mono tabular-nums">{pad(h)}:{pad(m)}:{pad(s)}</span>
            </p>
          </div>
        </div>
        {rol !== 'supervisor' && (
          <button type="button" onClick={() => navigate('cumplimiento')} className="flex flex-col items-center gap-2 rounded-lg text-left sm:flex-row sm:gap-4">
            <ProgressRing value={evaluado ? resumen.porcentaje : 0} size={112} stroke={10} tone={evaluado ? (resumen.porcentaje >= 90 ? 'light' : resumen.porcentaje >= 60 ? 'warn' : 'crit') : 'neutral'} track="rgba(255,255,255,0.12)" label="Cumplimiento DS 44">
              {evaluado ? (
                <span className="text-3xl leading-none font-bold tabular-nums">
                  <CountUp value={resumen.porcentaje} suffix="%" />
                </span>
              ) : (
                <span className="px-3 text-xs leading-tight font-semibold text-white/80">Sin evaluar</span>
              )}
              <span className="mt-1 text-[10px] font-semibold tracking-[0.08em] text-white/60 uppercase">DS 44</span>
            </ProgressRing>
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold">Preparación para fiscalizar</p>
              <p className="text-xs text-white/60">{evaluado ? `${resumen.cumple} de ${resumen.aplicables} ítems cumplen` : 'Toque para comenzar'}</p>
            </div>
          </button>
        )}
      </div>

      {(can('crearCharla') || can('reportarIncidente')) && (
        <div className={cx('mt-5 grid gap-2 sm:flex', can('crearCharla') && can('reportarIncidente') ? 'grid-cols-2' : 'grid-cols-1')}>
          {can('crearCharla') && (
            <button type="button" className={cx(btn, 'bg-white text-slate-900 hover:bg-slate-100')} onClick={() => navigate('charlas', { nuevo: '1' })}>
              <Megaphone className="size-4" /> Nueva charla
            </button>
          )}
          {can('reportarIncidente') && (
            <button type="button" className={cx(btn, 'border border-white/25 text-white hover:bg-white/10')} onClick={() => navigate('incidentes', { nuevo: '1' })}>
              <Siren className="size-4" /> Reportar<span className="hidden sm:inline"> incidente</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Tarjeta ejecutiva de indicadores legales (DS 44 / DS 67)

// ------------------------------------------------------------
function Resultado({ label, formula, value, estado }: { label: string; formula: string; value: string; estado: Estado }) {
  return (
    <div className="flex min-w-0 flex-col bg-white p-2.5 sm:p-4">
      <p className="line-clamp-2 min-h-8 text-[11px] leading-4 font-semibold tracking-[0.04em] break-words hyphens-auto text-slate-500 uppercase" lang="es" title={label}>
        {label}
      </p>
      <p className="mt-1 text-xl leading-7 font-semibold tracking-tight whitespace-nowrap text-navy tabular-nums sm:text-[28px] sm:leading-9">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge tone={estado.tone} dot>
          {estado.label}
        </Badge>
        <span className="hidden font-mono text-[11px] text-slate-500 xl:inline">{formula}</span>
      </div>
    </div>
  );
}

function ResultadosGrid({ r }: { r: ResultadoIndicadores }) {
  return (
    <StatGrid cols={3}>
      <Resultado label="Tasa accidentabilidad" formula="CTP÷Trab×100" value={`${fmtNum(r.tasaAccidentabilidad)}%`} estado={estadoTasa(r.tasaAccidentabilidad)} />
      <Resultado label="Índice frecuencia" formula="CTP×10⁶÷HH" value={fmtNum(r.indiceFrecuencia, 1)} estado={estadoIF(r.indiceFrecuencia)} />
      <Resultado label="Índice gravedad" formula="Días×10⁶÷HH" value={fmtNum(r.indiceGravedad, 0)} estado={estadoIG(r.indiceGravedad)} />
    </StatGrid>
  );
}

function ParametrosSheet({ onClose }: { onClose: () => void }) {
  const { company, updateCompany, can, notify } = useStore();
  const editable = can('editarIndicadores');
  const [d, setD] = useState<Indicadores>(company.indicadores);
  const r = calcularIndicadores(d);
  const set = (k: keyof Indicadores, v: string) => setD((x) => ({ ...x, [k]: k === 'periodo' ? v : Math.max(0, Number(v) || 0) }));

  const sincronizar = () => {
    const desde = addDays(todayISO(), -365);
    const ctp = company.incidentes.filter((i) => i.tipo === 'accidente_ctp' && i.fecha >= desde);
    setD((x) => ({
      ...x,
      accidentesCTP: ctp.length,
      diasPerdidos: ctp.reduce((a, i) => a + i.diasPerdidos, 0),
      promedioTrabajadores: x.promedioTrabajadores || company.trabajadores.filter((t) => t.activo).length,
    }));
    notify(`${ctp.length} accidentes CTP en los últimos 12 meses`, 'info');
  };

  const fields: { k: keyof Indicadores; label: string; step?: number }[] = [
    { k: 'promedioTrabajadores', label: 'Promedio de trabajadores' },
    { k: 'horasHombre', label: 'Horas-hombre trabajadas', step: 1000 },
    { k: 'accidentesCTP', label: 'Accidentes CTP' },
    { k: 'diasPerdidos', label: 'Días perdidos' },
  ];

  return (
    <Modal
      title="Parámetros de cálculo"
      onClose={onClose}
      footer={
        editable ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                updateCompany((c) => ({ ...c, indicadores: d }));
                notify('Indicadores actualizados');
                onClose();
              }}
            >
              Aplicar
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <ResultadosGrid r={r} />
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <Field key={f.k} label={f.label}>
              <Input type="number" min={0} step={f.step ?? 1} inputMode="numeric" className="tabular-nums" value={d[f.k] as number} disabled={!editable} onChange={(e) => set(f.k, e.target.value)} />
            </Field>
          ))}
        </div>
        <Field label="Período evaluado">
          <Input value={d.periodo} disabled={!editable} onChange={(e) => set('periodo', e.target.value)} />
        </Field>
        {editable && (
          <Button block variant="secondary" icon={<RefreshCw className="size-4" />} onClick={sincronizar}>
            Sincronizar desde incidentes registrados
          </Button>
        )}
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 text-sm">
          {[
            ['Tasa de Accidentabilidad', '(Accidentes CTP ÷ Promedio trabajadores) × 100'],
            ['Índice de Frecuencia', '(Accidentes CTP × 1.000.000) ÷ HH trabajadas'],
            ['Índice de Gravedad', '(Días perdidos × 1.000.000) ÷ HH trabajadas'],
          ].map(([k, v]) => (
            <div key={k} className="bg-white px-3 py-2">
              <dt className="text-xs font-medium text-slate-500">{k}</dt>
              <dd className="font-mono text-xs text-navy">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  );
}

function IndicadoresCard() {
  const { company, can } = useStore();
  const [sheet, setSheet] = useState(false);
  const ind = company.indicadores;
  const r = calcularIndicadores(ind);
  const t = calcularTasas(company.tasas);
  return (
    <Card
      title="Indicadores legales"
      subtitle={`DS 44 · DS 67 · ${ind.periodo}`}
      bodyClass="p-0"
      actions={
        <Button size="sm" variant="secondary" icon={<SlidersHorizontal className="size-4" />} onClick={() => setSheet(true)}>
          {can('editarIndicadores') ? 'Ajustar parámetros' : 'Ver parámetros'}
        </Button>
      }
    >
      <div className="p-2.5 sm:p-4">
        <ResultadosGrid r={r} />
      </div>
      <dl className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-4">
        {[
          ['Trabajadores', ind.promedioTrabajadores.toLocaleString('es-CL')],
          ['HH trabajadas', ind.horasHombre.toLocaleString('es-CL')],
          ['Accidentes CTP', String(ind.accidentesCTP)],
          ['Días perdidos', String(ind.diasPerdidos)],
          ['Siniestralidad DS 67', fmtNum(r.tasaSiniestralidad)],
          ['Días / accidente', fmtNum(r.promedioDiasPorAccidente, 1)],
          ['Adicional DS 67', `${fmtNum(t.adicionalDS67)}%`],
          ['Cotización proyectada', `${fmtNum(t.totalDS67)}%`],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0 bg-white px-3 py-2.5 sm:px-4">
            <dt className="truncate text-[11px] text-slate-500">{k}</dt>
            <dd className="text-sm font-semibold text-navy tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500">Estado según umbrales referenciales internos. La cotización adicional la determina el organismo administrador según DS 67.</p>
      {sheet && <ParametrosSheet onClose={() => setSheet(false)} />}
    </Card>
  );
}

// ------------------------------------------------------------
// Cotización Ley 16.744 (DS 110 vs DS 67)
// ------------------------------------------------------------
function TasasSheet({ onClose }: { onClose: () => void }) {
  const { company, updateCompany, can, notify } = useStore();
  const editable = can('editarTasas');
  const [d, setD] = useState<TasasLegales>(company.tasas);
  const set = (k: keyof TasasLegales, v: string) => setD((x) => ({ ...x, [k]: Math.max(0, Number(v) || 0) }));
  const campos: [keyof TasasLegales, string, number][] = [
    ['cotizacionBasica', 'Cotización básica %', 0.01],
    ['cotizacionAdicionalDS110', 'Adicional DS 110 %', 0.01],
    ['cotizacionExtraordinaria', 'Extraordinaria %', 0.01],
    ['tasaSiniestralidadDS67', 'Siniestralidad prom. 3 años', 1],
    ['invalidecesYMuertes', 'Tasa invalideces y muertes (0 a 385)', 5],
    ['remuneracionImponibleMensual', 'Remuneración imponible mensual $', 100000],
  ];
  return (
    <Modal
      title="Tasas de cotización"
      onClose={onClose}
      footer={
        editable ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                updateCompany((c) => ({ ...c, tasas: d }));
                notify('Tasas actualizadas');
                onClose();
              }}
            >
              Aplicar
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        )
      }
    >
      {!editable && <p className="mb-3 text-sm text-slate-500">Sólo el Prevencionista puede modificar las tasas legales.</p>}
      <div className="grid grid-cols-2 gap-3">
        {campos.map(([k, label, step]) => (
          <Field key={k} label={label}>
            <Input type="number" step={step} inputMode="decimal" className="tabular-nums" value={d[k]} disabled={!editable} onChange={(e) => set(k, e.target.value)} />
          </Field>
        ))}
      </div>
    </Modal>
  );
}

function TasasCard() {
  const { company, can } = useStore();
  const [sheet, setSheet] = useState(false);
  const r = calcularTasas(company.tasas);
  const sube = r.diferenciaAnual > 0;
  const igual = r.diferenciaAnual === 0;
  return (
    <Card
      title="Cotización Ley 16.744"
      subtitle="Vigente (DS 110) vs. proyección DS 67"
      bodyClass="p-0"
      actions={
        <Button size="sm" variant="secondary" icon={<SlidersHorizontal className="size-4" />} onClick={() => setSheet(true)}>
          {can('editarTasas') ? 'Ajustar tasas' : 'Ver tasas'}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-px bg-slate-200">
        <div className="min-w-0 bg-white p-4">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase">Vigente</p>
          <p className="mt-1 text-[28px] leading-8 font-semibold text-navy tabular-nums">{fmtNum(r.totalDS110)}%</p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">{fmtCLP(r.costoMensualDS110)} / mes</p>
        </div>
        <div className="min-w-0 bg-white p-4">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase">Proyección DS 67</p>
          <p className="mt-1 text-[28px] leading-8 font-semibold text-navy tabular-nums">{fmtNum(r.totalDS67)}%</p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">{fmtCLP(r.costoMensualDS67)} / mes</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <span className="text-sm text-slate-600">{igual ? 'Sin cambio anual' : sube ? 'Recargo anual estimado' : 'Rebaja anual estimada'}</span>
        <span className={cx('text-sm font-semibold tabular-nums', igual ? 'text-navy' : sube ? 'text-crit-700' : 'text-ok-700')}>
          {sube ? '+' : igual ? '' : '−'}
          {fmtCLP(Math.abs(r.diferenciaAnual))}
        </span>
      </div>
      {sheet && <TasasSheet onClose={() => setSheet(false)} />}
    </Card>
  );
}

// ------------------------------------------------------------
// Gráficos
// ------------------------------------------------------------
function ChartTable({ rows, cols }: { rows: Record<string, string | number>[]; cols: { k: string; label: string }[] }) {
  return (
    <table className="mt-3 w-full table-fixed text-xs">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          {cols.map((c, i) => (
            <th key={c.k} className={cx('py-1.5 font-medium', i > 0 && 'text-right')}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-100">
            {cols.map((c, j) => (
              <td key={c.k} className={cx('truncate py-1.5 text-navy tabular-nums', j > 0 && 'text-right')}>
                {r[c.k]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Charts() {
  const { company } = useStore();
  const [tabla, setTabla] = useState(false);
  const k = chartColors();

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
      lastMonths(6).map((m) => ({
        mes: monthLabel(m),
        Charlas: company.charlas.filter((c) => monthKey(c.fecha) === m).length,
        'Acciones cerradas':
          company.hallazgos.filter((h) => h.estado === 'cerrado' && h.fechaCierre && monthKey(h.fechaCierre) === m).length +
          company.incidentes.reduce((a, i) => a + (i.investigacion?.medidas.filter((x) => x.estado === 'cumplida' && monthKey(x.fechaCompromiso) === m).length ?? 0), 0),
      })),
    [company],
  );

  const tooltipStyle = { borderRadius: 6, border: `1px solid ${k.tooltipBorder}`, fontSize: 12, background: k.tooltipBg, color: k.tooltipText, boxShadow: 'none' };
  const toggle = (
    <Button size="sm" variant="ghost" icon={<Table2 className="size-4" />} onClick={() => setTabla((t) => !t)}>
      {tabla ? 'Ocultar datos' : 'Ver datos'}
    </Button>
  );
  const axis = { fontSize: 11, fill: k.axis };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="Incidentes y hallazgos por área" actions={toggle}>
        <div className="h-64 min-w-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porArea} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={k.grid} />
              <XAxis dataKey="area" tick={axis} tickLine={false} axisLine={{ stroke: k.axisLine }} interval={0} angle={-25} textAnchor="end" height={64} tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)} />
              <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: k.cursor }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" iconSize={10} />
              <Bar dataKey="Incidentes" fill={k.a} radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="Hallazgos" fill={k.b} radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {tabla && <ChartTable rows={porArea} cols={[{ k: 'area', label: 'Área' }, { k: 'Incidentes', label: 'Incid.' }, { k: 'Hallazgos', label: 'Hallazgos' }]} />}
      </Card>
      <Card title="Charlas vs. acciones cerradas" subtitle="Últimos 6 meses" actions={toggle}>
        <div className="h-64 min-w-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mensual} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={k.grid} />
              <XAxis dataKey="mes" tick={axis} tickLine={false} axisLine={{ stroke: k.axisLine }} />
              <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: k.cursor }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" iconSize={10} />
              <Bar dataKey="Charlas" fill={k.a} radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="Acciones cerradas" fill={k.b} radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {tabla && <ChartTable rows={mensual} cols={[{ k: 'mes', label: 'Mes' }, { k: 'Charlas', label: 'Charlas' }, { k: 'Acciones cerradas', label: 'Cerradas' }]} />}
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
      title="Alertas y vencimientos"
      subtitle={
        <span className="tabular-nums">
          {criticas} críticas · {alertas.length - criticas} preventivas
        </span>
      }
      bodyClass="p-0"
    >
      {alertas.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-ok-800">
          <ShieldCheck className="size-5" /> Sin alertas pendientes.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {shown.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => navigate(a.vista)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-md border', a.nivel === 'critico' ? 'border-crit/30 bg-crit-50 text-crit-700' : 'border-warn/40 bg-warn-50 text-warn-700')}>
                  {a.categoria === 'Extintores' ? <Flame className="size-4" /> : <AlertTriangle className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-navy">{a.titulo}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {a.categoria} · {a.detalle}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {limit && alertas.length > limit && (
        <button type="button" className="flex min-h-11 w-full items-center justify-center border-t border-slate-200 text-sm font-medium text-navy hover:bg-slate-50" onClick={() => setAll((x) => !x)}>
          {all ? 'Ver menos' : `Ver todas (${alertas.length})`}
        </button>
      )}
    </Card>
  );
}

// ------------------------------------------------------------
// Cumplimiento por supervisor: tabla ≥768px, tarjetas en móvil
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
    <Card title="Cumplimiento por supervisor" subtitle="Últimos 30 días y hallazgos asignados" bodyClass="p-0">
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No hay supervisores configurados.</p>
      ) : (
        <>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] tracking-[0.06em] text-slate-500 uppercase">
                <th className="px-4 py-2 font-semibold">Supervisor</th>
                <th className="px-2 text-right font-semibold">Charlas</th>
                <th className="px-2 text-right font-semibold">Inspecc.</th>
                <th className="px-2 text-right font-semibold">Hallazgos</th>
                <th className="px-2 text-right font-semibold">Vencidos</th>
                <th className="w-44 px-4 font-semibold">% Cierre</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.s} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-navy">{r.s}</td>
                  <td className="px-2 text-right">{r.charlas30}</td>
                  <td className="px-2 text-right">{r.insp30}</td>
                  <td className="px-2 text-right">{r.hs}</td>
                  <td className={cx('px-2 text-right', r.vencidos > 0 && 'font-semibold text-crit-700')}>{r.vencidos}</td>
                  <td className="px-4">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={r.pct} />
                      <span className="w-9 text-right text-xs font-medium">{r.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-slate-200 md:hidden">
            {rows.map((r) => (
              <li key={r.s} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-navy">{r.s}</p>
                  <span className="text-sm font-semibold text-navy tabular-nums">{r.pct}%</span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={r.pct} />
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-2 text-center tabular-nums">
                  {[
                    ['Charlas', r.charlas30],
                    ['Inspecc.', r.insp30],
                    ['Hallazgos', r.hs],
                    ['Vencidos', r.vencidos],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <dd className={cx('text-base font-semibold', k === 'Vencidos' && (v as number) > 0 ? 'text-crit-700' : 'text-navy')}>{v}</dd>
                      <dt className="text-[11px] text-slate-500">{k}</dt>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------
// Vista principal
// ------------------------------------------------------------
export default function Dashboard() {
  const { company, rol } = useStore();
  const alertas = useMemo(() => calcularAlertas(company), [company]);

  const abiertos = company.hallazgos.filter((h) => h.estado !== 'cerrado');
  const criticosAbiertos = abiertos.filter((h) => h.criticidad === 'alto').length;
  const desde = addDays(todayISO(), -30);
  const charlasMes = company.charlas.filter((c) => c.fecha >= desde).length;
  const capacitados = new Set(company.charlas.filter((c) => c.fecha >= desde).flatMap((c) => c.asistentes.map((a) => a.rut))).size;
  const inspProm = company.inspecciones.length ? Math.round(company.inspecciones.reduce((a, i) => a + i.cumplimiento, 0) / company.inspecciones.length) : 0;
  const pendientesAprob = abiertos.filter((h) => !h.planAprobado).length;
  const diasPerdidosAnio = company.incidentes.filter((i) => diffDays(i.fecha, todayISO()) <= 365).reduce((a, i) => a + i.diasPerdidos, 0);
  const costoDiasPerdidos =
    company.tasas.remuneracionImponibleMensual && company.indicadores.promedioTrabajadores
      ? (company.tasas.remuneracionImponibleMensual / company.indicadores.promedioTrabajadores / 30) * diasPerdidosAnio
      : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {rol === 'gerencia' && <AprobacionesCard pendientesPlanes={pendientesAprob} />}
      <SafetyBanner />

      <div className="rise" style={escalon(1)}>
      <StatGrid>
        <Stat label="Hallazgos abiertos" value={abiertos.length} hint={`${criticosAbiertos} de criticidad alta`} tone={criticosAbiertos ? 'crit' : abiertos.length ? 'warn' : 'ok'} />
        <Stat label="Charlas 30 días" value={charlasMes} hint={`${capacitados} trabajadores`} tone={charlasMes >= 4 ? 'ok' : 'warn'} />
        <Stat label="Cumpl. inspecciones" value={`${inspProm}%`} hint={`${company.inspecciones.length} registradas`} tone={inspProm >= 85 ? 'ok' : inspProm >= 70 ? 'warn' : 'crit'} />
        {rol === 'gerencia' ? (
          <Stat label="Costo días perdidos" value={fmtCLP(costoDiasPerdidos)} hint={`${diasPerdidosAnio} días · 12 meses`} tone={diasPerdidosAnio > 0 ? 'warn' : 'ok'} />
        ) : (
          <Stat label="Planes por aprobar" value={pendientesAprob} hint="Visto bueno de Gerencia" tone={pendientesAprob ? 'warn' : 'ok'} />
        )}
      </StatGrid>
      </div>

      {/* En el celular lo urgente va primero; en escritorio, indicadores a la izquierda */}
      <div className="rise grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" style={escalon(2)}>
        <div className="space-y-4 xl:order-2">
          <AlertsBoard alertas={alertas} limit={5} />
        </div>
        <div className="xl:order-1">
          <IndicadoresCard />
        </div>
      </div>

      <Analisis>
        <Charts />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <SupervisorCompliance />
          <TasasCard />
        </div>
      </Analisis>
    </div>
  );
}

/** Gerencia: lo que espera su decisión, arriba de todo */
function AprobacionesCard({ pendientesPlanes }: { pendientesPlanes: number }) {
  const { company, navigate } = useStore();
  const programaPendiente = !!company.programa && !company.programa.aprobadoEn;
  const items = [
    ...(pendientesPlanes ? [{ label: `${pendientesPlanes} ${pendientesPlanes === 1 ? 'plan de acción' : 'planes de acción'} por aprobar`, vista: 'hallazgos' as const }] : []),
    ...(programaPendiente ? [{ label: `Programa de trabajo ${company.programa!.anio} por aprobar`, vista: 'programa' as const }] : []),
  ];
  return (
    <Card title="Pendiente de su aprobación" subtitle={items.length ? 'Lo que espera su decisión' : 'No hay nada pendiente'}>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">Está todo al día.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.label}>
              <button type="button" onClick={() => navigate(i.vista)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 text-left text-sm font-medium text-navy hover:border-slate-300">
                {i.label}
                <ChevronRight className="size-4 shrink-0 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Gráficos y análisis: abiertos en escritorio, plegados en el celular para no alargar la pantalla */
function Analisis({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="flex min-h-12 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 text-left text-sm font-semibold text-navy hover:border-slate-300"
      >
        <span>{abierto ? 'Ocultar análisis' : 'Ver análisis: gráficos, supervisores y cotización'}</span>
        <ChevronDown className={cx('size-4 text-slate-400 transition-transform', abierto && 'rotate-180')} />
      </button>
      {abierto && children}
    </section>
  );
}
