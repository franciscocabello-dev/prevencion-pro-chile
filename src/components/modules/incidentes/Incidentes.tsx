import { useEffect, useState } from 'react';
import { AlertOctagon, Ambulance, CheckCircle2, Construction, Eye, FileDown, FileSearch, Plus, Route as RouteIcon, Siren, Trash2, TriangleAlert, Zap } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { Incidente, Investigacion, JerarquiaControl, MedidaCorrectiva, TipoIncidente } from '../../../types';
import { JERARQUIA_LABEL, JERARQUIA_ORDEN, LISTA_CAUSAS, PARTES_CUERPO, TIPO_INCIDENTE_LABEL } from '../../../data/catalogos';
import { addDays, diffDays, formatDate, nowTime, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { generarInformeInvestigacion } from '../../../utils/pdfGenerator';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PhotoInput, Select, Tabs, TextArea, Thumb, cx, type Tone } from '../../ui';

const TIPO_UI: Record<TipoIncidente, { icon: typeof Siren; tone: Tone; cls: string }> = {
  cuasi_accidente: { icon: Zap, tone: 'warn', cls: 'border-warn bg-warn text-navy' },
  condicion_subestandar: { icon: Construction, tone: 'info', cls: 'border-sky-500 bg-sky-500 text-white' },
  accidente_stp: { icon: TriangleAlert, tone: 'warn', cls: 'border-orange-500 bg-orange-500 text-white' },
  accidente_ctp: { icon: Ambulance, tone: 'crit', cls: 'border-crit bg-crit text-white' },
  accidente_trayecto: { icon: RouteIcon, tone: 'neutral', cls: 'border-slate-600 bg-slate-600 text-white' },
};

const ESTADO: Record<Incidente['estado'], { label: string; tone: Tone }> = {
  reportado: { label: 'Reportado', tone: 'warn' },
  en_investigacion: { label: 'En investigación', tone: 'info' },
  cerrado: { label: 'Cerrado', tone: 'ok' },
};

// ------------------------------------------------------------
// Reporte rápido (< 30 segundos)
// ------------------------------------------------------------
export function ReporteRapido({ onClose }: { onClose: () => void }) {
  const { company, state, updateCompany, notify } = useStore();
  const [tipo, setTipo] = useState<TipoIncidente | null>(null);
  const [area, setArea] = useState(company.areas[0] ?? '');
  const [descripcion, setDescripcion] = useState('');
  const [foto, setFoto] = useState<string>();
  const [afectadoId, setAfectadoId] = useState('');
  const [parte, setParte] = useState('');
  const [dias, setDias] = useState(0);
  const esAccidente = tipo?.startsWith('accidente');

  const enviar = () => {
    if (!tipo) return;
    const afectado = company.trabajadores.find((t) => t.id === afectadoId);
    const folio = Math.max(1000, ...company.incidentes.map((i) => i.folio)) + 1;
    const fecha = todayISO();
    const inc: Incidente = {
      id: uid('inc-'),
      folio,
      tipo,
      fecha,
      hora: nowTime(),
      area,
      descripcion: descripcion.trim(),
      reportadoPor: state.usuario,
      afectado: afectado?.nombre,
      rutAfectado: afectado?.rut,
      parteCuerpo: esAccidente ? parte : undefined,
      diasPerdidos: tipo === 'accidente_ctp' ? dias : 0,
      foto,
      estado: 'reportado',
      diatEmitida: false,
    };
    updateCompany((c) => {
      const next = { ...c, incidentes: [inc, ...c.incidentes] };
      if (tipo === 'accidente_ctp') {
        // Reinicia el contador y conserva el récord histórico
        const racha = diffDays(c.fechaUltimoAccidenteCTP, fecha);
        next.recordDiasSinAccidentes = Math.max(c.recordDiasSinAccidentes, racha);
        next.fechaUltimoAccidenteCTP = fecha;
        next.indicadores = { ...c.indicadores, accidentesCTP: c.indicadores.accidentesCTP + 1, diasPerdidos: c.indicadores.diasPerdidos + dias };
      }
      return next;
    });
    notify(`Reporte folio #${folio} enviado${tipo === 'accidente_ctp' ? '. Recuerde emitir la DIAT dentro de 24 horas.' : ''}`);
    onClose();
  };

  return (
    <Modal
      title="Reporte rápido"
      onClose={onClose}
      footer={
        <Button block size="lg" variant="danger" icon={<Siren className="size-5" />} disabled={!tipo || descripcion.trim().length < 8 || (esAccidente && !afectadoId)} onClick={enviar}>
          Enviar reporte
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">1. ¿Qué ocurrió?</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TIPO_INCIDENTE_LABEL) as TipoIncidente[]).map((t) => {
              const Icon = TIPO_UI[t].icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cx('flex min-h-16 items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-bold', tipo === t ? TIPO_UI[t].cls : 'border-slate-200 bg-white text-navy', t === 'accidente_trayecto' && 'col-span-2')}
                >
                  <Icon className="size-6 shrink-0" />
                  {TIPO_INCIDENTE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="2. Área">
          <Select value={area} onChange={(e) => setArea(e.target.value)} options={company.areas} />
        </Field>
        <Field label="3. Descripción breve" required>
          <TextArea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Qué pasó, dónde y con qué" />
        </Field>
        {esAccidente && (
          <div className="grid gap-3 rounded-xl bg-crit-50/50 p-3 sm:grid-cols-2">
            <Field label="Trabajador afectado" required>
              <Select value={afectadoId} onChange={(e) => setAfectadoId(e.target.value)} placeholder="Seleccione…" options={company.trabajadores.map((t) => ({ value: t.id, label: `${t.nombre} (${t.rut})` }))} />
            </Field>
            <Field label="Parte del cuerpo">
              <Select value={parte} onChange={(e) => setParte(e.target.value)} placeholder="Seleccione…" options={PARTES_CUERPO} />
            </Field>
            {tipo === 'accidente_ctp' && (
              <Field label="Días perdidos (reposo)" hint="Actualiza indicadores y reinicia el contador CTP">
                <Input type="number" min={0} value={dias} onChange={(e) => setDias(Math.max(0, Number(e.target.value) || 0))} />
              </Field>
            )}
          </div>
        )}
        <PhotoInput value={foto} onChange={setFoto} label="4. Foto (opcional)" />
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
// Ficha de investigación (5 Porqués + causas)
// ------------------------------------------------------------
function CausasChecklist({ titulo, opciones, value, onChange, disabled }: { titulo: string; opciones: string[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const [otra, setOtra] = useState('');
  const todas = [...new Set([...opciones, ...value])];
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-2 text-sm font-semibold text-navy">{titulo}</p>
      <div className="space-y-1.5">
        {todas.map((o) => (
          <label key={o} className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" disabled={disabled} className="mt-0.5 size-4 accent-navy" checked={value.includes(o)} onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} />
            {o}
          </label>
        ))}
      </div>
      {!disabled && (
        <div className="mt-2 flex gap-2">
          <Input placeholder="Otra causa…" value={otra} onChange={(e) => setOtra(e.target.value)} className="py-1.5" />
          <Button
            size="sm"
            variant="secondary"
            disabled={!otra.trim()}
            onClick={() => {
              onChange([...value, otra.trim()]);
              setOtra('');
            }}
          >
            Agregar
          </Button>
        </div>
      )}
    </div>
  );
}

function FichaInvestigacion({ inc, onClose }: { inc: Incidente; onClose: () => void }) {
  const { company, state, can, updateCompany, notify } = useStore();
  const editable = can('investigar') && inc.estado !== 'cerrado';
  const [inv, setInv] = useState<Investigacion>(
    () =>
      inc.investigacion ?? {
        porques: ['', '', '', '', ''],
        causasInmediatas: { acciones: [], condiciones: [] },
        causasBasicas: { personales: [], trabajo: [] },
        medidas: [],
        conclusion: '',
        equipoInvestigador: `${company.empresa.prevencionista}, ${inc.reportadoPor}`,
        fechaInicio: todayISO(),
      },
  );
  const [diat, setDiat] = useState(inc.diatEmitida);
  const [medida, setMedida] = useState<Omit<MedidaCorrectiva, 'id' | 'estado'>>({ descripcion: '', jerarquia: 'ingenieria', responsable: company.supervisores[0] ?? state.usuario, fechaCompromiso: addDays(todayISO(), 10) });

  const save = (p: Partial<Incidente>, msg: string, close = true) => {
    updateCompany((c) => ({ ...c, incidentes: c.incidentes.map((x) => (x.id === inc.id ? { ...x, investigacion: inv, diatEmitida: diat, ...p } : x)) }));
    notify(msg);
    if (close) onClose();
  };

  const puedeCerrar = inv.porques.filter((p) => p.trim()).length >= 3 && inv.medidas.length > 0 && inv.conclusion.trim() && inv.medidas.every((m) => m.estado === 'cumplida');
  const UI = TIPO_UI[inc.tipo];

  return (
    <Modal
      title={`Investigación · Folio #${inc.folio}`}
      onClose={onClose}
      size="xl"
      footer={
        <>
          {can('eliminarRegistros') && (
            <Button
              variant="ghost"
              className="mr-auto text-crit"
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                if (!confirm('¿Eliminar este reporte de incidente?')) return;
                updateCompany((c) => ({ ...c, incidentes: c.incidentes.filter((x) => x.id !== inc.id) }));
                onClose();
              }}
            >
              Eliminar
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<FileDown className="size-4" />}
            onClick={() => {
              generarInformeInvestigacion(company, { ...inc, investigacion: inc.investigacion ?? (editable ? inv : undefined), diatEmitida: diat });
              notify('Informe de investigación PDF descargado');
            }}
          >
            Informe PDF
          </Button>
          {editable && (
            <Button onClick={() => save({ estado: 'en_investigacion' }, 'Investigación guardada')}>Guardar investigación</Button>
          )}
          {can('cerrarInvestigacion') && inc.estado !== 'cerrado' && (
            <Button
              variant="success"
              icon={<CheckCircle2 className="size-4" />}
              disabled={!puedeCerrar}
              title={!puedeCerrar ? 'Requiere ≥3 porqués, conclusión y todas las medidas cumplidas' : undefined}
              onClick={() => {
                const cerrada = { ...inv, cerradoPor: state.usuario, fechaCierre: todayISO() };
                setInv(cerrada);
                updateCompany((c) => ({ ...c, incidentes: c.incidentes.map((x) => (x.id === inc.id ? { ...x, investigacion: cerrada, diatEmitida: diat, estado: 'cerrado' } : x)) }));
                notify('Investigación cerrada formalmente');
                onClose();
              }}
            >
              Cierre final
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Thumb src={inc.foto} className="size-28" />
          <div className="flex-1">
            <div className="mb-1 flex flex-wrap gap-1.5">
              <Badge tone={UI.tone}>{TIPO_INCIDENTE_LABEL[inc.tipo]}</Badge>
              <Badge tone={ESTADO[inc.estado].tone}>{ESTADO[inc.estado].label}</Badge>
            </div>
            <p className="text-sm text-navy">{inc.descripcion}</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatDate(inc.fecha)} {inc.hora} · {inc.area} · reportado por {inc.reportadoPor}
              {inc.afectado && ` · afectado: ${inc.afectado}`}
              {inc.diasPerdidos > 0 && ` · ${inc.diasPerdidos} días perdidos`}
            </p>
            {inc.tipo.startsWith('accidente') && (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-navy" disabled={!editable} checked={diat} onChange={(e) => setDiat(e.target.checked)} />
                DIAT emitida al organismo administrador ({company.empresa.mutualidad})
              </label>
            )}
          </div>
        </div>

        {!can('investigar') && !inc.investigacion ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">La investigación aún no ha sido iniciada por el Prevencionista de Riesgos.</p>
        ) : (
          <>
            <section>
              <h4 className="mb-2 flex items-center gap-2 font-bold text-navy">
                <FileSearch className="size-4" /> Metodología 5 Porqués
              </h4>
              <div className="space-y-2">
                {inv.porques.map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span>
                    <Input
                      disabled={!editable}
                      value={p}
                      placeholder={i === 0 ? '¿Por qué ocurrió el evento?' : `¿Por qué? (respuesta ${i})`}
                      onChange={(e) => setInv({ ...inv, porques: inv.porques.map((x, j) => (j === i ? e.target.value : x)) })}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h4 className="mb-2 font-bold text-navy">Causas inmediatas</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <CausasChecklist titulo="Acciones subestándar" opciones={LISTA_CAUSAS.acciones} disabled={!editable} value={inv.causasInmediatas.acciones} onChange={(v) => setInv({ ...inv, causasInmediatas: { ...inv.causasInmediatas, acciones: v } })} />
                <CausasChecklist titulo="Condiciones subestándar" opciones={LISTA_CAUSAS.condiciones} disabled={!editable} value={inv.causasInmediatas.condiciones} onChange={(v) => setInv({ ...inv, causasInmediatas: { ...inv.causasInmediatas, condiciones: v } })} />
              </div>
            </section>

            <section>
              <h4 className="mb-2 font-bold text-navy">Causas básicas</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <CausasChecklist titulo="Factores personales" opciones={LISTA_CAUSAS.personales} disabled={!editable} value={inv.causasBasicas.personales} onChange={(v) => setInv({ ...inv, causasBasicas: { ...inv.causasBasicas, personales: v } })} />
                <CausasChecklist titulo="Factores del trabajo" opciones={LISTA_CAUSAS.trabajo} disabled={!editable} value={inv.causasBasicas.trabajo} onChange={(v) => setInv({ ...inv, causasBasicas: { ...inv.causasBasicas, trabajo: v } })} />
              </div>
            </section>

            <section>
              <h4 className="mb-2 font-bold text-navy">Medidas correctivas</h4>
              <ul className="mb-3 space-y-2">
                {inv.medidas.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 accent-[#10B981]"
                      disabled={!editable}
                      checked={m.estado === 'cumplida'}
                      onChange={(e) => setInv({ ...inv, medidas: inv.medidas.map((x) => (x.id === m.id ? { ...x, estado: e.target.checked ? 'cumplida' : 'pendiente' } : x)) })}
                      aria-label="Medida cumplida"
                    />
                    <span className={cx('min-w-40 flex-1', m.estado === 'cumplida' && 'text-slate-500 line-through')}>{m.descripcion}</span>
                    <Badge>{JERARQUIA_LABEL[m.jerarquia]}</Badge>
                    <span className="text-xs text-slate-500">
                      {m.responsable} · {formatDate(m.fechaCompromiso)}
                    </span>
                    {editable && (
                      <button type="button" className="text-slate-400 hover:text-crit" onClick={() => setInv({ ...inv, medidas: inv.medidas.filter((x) => x.id !== m.id) })} aria-label="Quitar medida">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
                {inv.medidas.length === 0 && <li className="text-sm text-slate-500">Sin medidas registradas.</li>}
              </ul>
              {editable && (
                <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
                  <Field label="Medida">
                    <Input value={medida.descripcion} onChange={(e) => setMedida({ ...medida, descripcion: e.target.value })} />
                  </Field>
                  <Field label="Jerarquía">
                    <Select value={medida.jerarquia} onChange={(e) => setMedida({ ...medida, jerarquia: e.target.value as JerarquiaControl })} options={JERARQUIA_ORDEN.map((j) => ({ value: j, label: JERARQUIA_LABEL[j] }))} />
                  </Field>
                  <Field label="Responsable">
                    <Select value={medida.responsable} onChange={(e) => setMedida({ ...medida, responsable: e.target.value })} options={[...new Set([...company.supervisores, company.empresa.prevencionista, state.usuario])].filter(Boolean)} />
                  </Field>
                  <Field label="Plazo">
                    <Input type="date" value={medida.fechaCompromiso} onChange={(e) => setMedida({ ...medida, fechaCompromiso: e.target.value })} />
                  </Field>
                  <Button
                    icon={<Plus className="size-4" />}
                    disabled={!medida.descripcion.trim()}
                    onClick={() => {
                      setInv({ ...inv, medidas: [...inv.medidas, { ...medida, descripcion: medida.descripcion.trim(), id: uid('m-'), estado: 'pendiente' }] });
                      setMedida({ ...medida, descripcion: '' });
                    }}
                  >
                    Agregar
                  </Button>
                </div>
              )}
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <Field label="Equipo investigador">
                <Input disabled={!editable} value={inv.equipoInvestigador} onChange={(e) => setInv({ ...inv, equipoInvestigador: e.target.value })} />
              </Field>
              <Field label="Fecha inicio investigación">
                <Input type="date" disabled={!editable} value={inv.fechaInicio} onChange={(e) => setInv({ ...inv, fechaInicio: e.target.value })} />
              </Field>
              <Field label="Conclusión" className="md:col-span-2">
                <TextArea disabled={!editable} value={inv.conclusion} onChange={(e) => setInv({ ...inv, conclusion: e.target.value })} />
              </Field>
            </section>
            {inc.estado === 'cerrado' && inv.fechaCierre && (
              <p className="rounded-lg bg-ok-50 p-3 text-sm font-medium text-ok-800">
                Investigación cerrada el {formatDate(inv.fechaCierre)} por {inv.cerradoPor}.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

type Filtro = 'abiertos' | 'cerrados' | 'todos';

export default function Incidentes() {
  const { company, route, navigate, can } = useStore();
  const [reporte, setReporte] = useState(false);
  const [sel, setSel] = useState<Incidente | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('abiertos');
  const [tipo, setTipo] = useState('');

  useEffect(() => {
    if (route.params.get('nuevo') === '1' && can('reportarIncidente')) {
      setReporte(true);
      navigate('incidentes');
    }
  }, [route, can, navigate]);

  const base = company.incidentes.filter((i) => !tipo || i.tipo === tipo);
  const grupos: Record<Filtro, Incidente[]> = {
    abiertos: base.filter((i) => i.estado !== 'cerrado'),
    cerrados: base.filter((i) => i.estado === 'cerrado'),
    todos: base,
  };
  const lista = [...grupos[filtro]].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const cuenta = (t: TipoIncidente) => company.incidentes.filter((i) => i.tipo === t).length;

  return (
    <div>
      <PageHeader
        title="Incidentes e Investigación"
        subtitle="Reporte de cuasi-accidentes, condiciones subestándar y accidentes (Ley 16.744)"
        icon={<AlertOctagon className="size-6" />}
        actions={
          can('reportarIncidente') && (
            <Button variant="danger" size="lg" icon={<Siren className="size-5" />} onClick={() => setReporte(true)}>
              Reportar ahora
            </Button>
          )
        }
      />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {(Object.keys(TIPO_INCIDENTE_LABEL) as TipoIncidente[]).map((t) => {
          const Icon = TIPO_UI[t].icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(tipo === t ? '' : t)}
              className={cx('flex shrink-0 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-left', tipo === t ? 'border-navy ring-2 ring-navy/20' : 'border-slate-200')}
            >
              <Icon className="size-5 text-slate-500" />
              <span>
                <span className="block text-lg leading-none font-bold text-navy">{cuenta(t)}</span>
                <span className="text-[11px] text-slate-500">{TIPO_INCIDENTE_LABEL[t]}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Tabs<Filtro>
        value={filtro}
        onChange={setFiltro}
        tabs={[
          { id: 'abiertos', label: 'Abiertos', count: grupos.abiertos.length },
          { id: 'cerrados', label: 'Cerrados', count: grupos.cerrados.length },
          { id: 'todos', label: 'Todos', count: grupos.todos.length },
        ]}
      />
      {lista.length === 0 ? (
        <EmptyState icon={<AlertOctagon className="size-10" />} title="Sin reportes en esta vista" />
      ) : (
        <div className="space-y-2">
          {lista.map((i) => {
            const UI = TIPO_UI[i.tipo];
            const Icon = UI.icon;
            return (
              <Card key={i.id} bodyClass="p-3.5">
                <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
                  <span className={cx('flex size-11 shrink-0 items-center justify-center rounded-xl', UI.cls)}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-400">#{i.folio}</span>
                      <span className="text-sm font-semibold text-navy">{TIPO_INCIDENTE_LABEL[i.tipo]}</span>
                      <Badge tone={ESTADO[i.estado].tone}>{ESTADO[i.estado].label}</Badge>
                      {i.tipo.startsWith('accidente') && !i.diatEmitida && <Badge tone="crit">DIAT pendiente</Badge>}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{i.descripcion}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(i.fecha)} · {i.area} · {i.reportadoPor}
                      {i.diasPerdidos > 0 && ` · ${i.diasPerdidos} días perdidos`}
                    </p>
                  </div>
                  <Thumb src={i.foto} className="hidden size-14 sm:block" />
                  <Button size="sm" variant={can('investigar') && i.estado !== 'cerrado' ? 'primary' : 'secondary'} icon={can('investigar') && i.estado !== 'cerrado' ? <FileSearch className="size-4" /> : <Eye className="size-4" />} onClick={() => setSel(i)} className="w-full sm:w-auto">
                    {can('investigar') && i.estado !== 'cerrado' ? 'Investigar' : 'Ver ficha'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {reporte && <ReporteRapido onClose={() => setReporte(false)} />}
      {sel && <FichaInvestigacion inc={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
