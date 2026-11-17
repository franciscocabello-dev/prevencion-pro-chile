import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileDown, Flame, MinusCircle, Plus, RotateCcw, Trash2, XCircle, AlertTriangle, ClipboardList, HardHat, Cog } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { Criticidad, EstadoItem, Extintor, Hallazgo, Inspeccion, PlantillaChecklist, RespuestaItem } from '../../../types';
import { PLANTILLAS } from '../../../data/catalogos';
import { addDays, addMonths, daysFromToday, formatDate, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { generarInformeInspeccion } from '../../../utils/pdfGenerator';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PhotoInput, ProgressBar, Select, Tabs, TextArea, cx, type Tone } from '../../ui';
import SignaturePad from '../../ui/SignaturePad';

type TabId = 'nueva' | 'historial' | 'extintores';

interface HallazgoDraft {
  descripcion: string;
  criticidad: Criticidad;
  responsable: string;
  fechaCompromiso: string;
  foto?: string;
}

const ICONOS: Record<PlantillaChecklist['id'], typeof ClipboardCheck> = { ds594: ClipboardList, maquinaria: Cog, ast: HardHat };

export const CRIT_TONE: Record<Criticidad, Tone> = { alto: 'crit', medio: 'warn', bajo: 'ok' };
export const CRIT_LABEL: Record<Criticidad, string> = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };

function CriticidadPicker({ value, onChange }: { value: Criticidad; onChange: (c: Criticidad) => void }) {
  const opts: { v: Criticidad; cls: string }[] = [
    { v: 'alto', cls: 'border-crit bg-crit text-white' },
    { v: 'medio', cls: 'border-warn bg-warn text-navy' },
    { v: 'bajo', cls: 'border-ok bg-ok text-white' },
  ];
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">Criticidad</span>
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)} className={cx('min-h-11 rounded-md border py-2 text-sm font-semibold', value === o.v ? o.cls : 'border-slate-200 bg-white text-slate-600')}>
            {CRIT_LABEL[o.v]}
          </button>
        ))}
      </div>
    </div>
  );
}

function EjecutarChecklist({ plantilla, onClose, onSaved }: { plantilla: PlantillaChecklist; onClose: () => void; onSaved: (i: Inspeccion) => void }) {
  const { company, state, updateCompany, notify } = useStore();
  const [area, setArea] = useState(company.areas[0] ?? '');
  const [inspector, setInspector] = useState(state.usuario);
  const [tarea, setTarea] = useState('');
  const [equipo, setEquipo] = useState('');
  const [resp, setResp] = useState<Record<string, RespuestaItem>>(() => Object.fromEntries(plantilla.items.map((i) => [i.id, { itemId: i.id, estado: null, observacion: '' }])));
  const [drafts, setDrafts] = useState<Record<string, HallazgoDraft>>({});
  const [firma, setFirma] = useState('');
  const responsables = company.supervisores.length ? company.supervisores : [state.usuario];

  const secciones = useMemo(() => [...new Set(plantilla.items.map((i) => i.seccion))], [plantilla]);
  const respondidas = Object.values(resp).filter((r) => r.estado).length;
  const aplicables = Object.values(resp).filter((r) => r.estado && r.estado !== 'na');
  const cumplimiento = aplicables.length ? Math.round((aplicables.filter((r) => r.estado === 'cumple').length / aplicables.length) * 100) : 100;

  const marcar = (itemId: string, estado: EstadoItem) => {
    setResp((r) => ({ ...r, [itemId]: { ...r[itemId], estado } }));
    if (estado === 'no_cumple' && !drafts[itemId]) {
      const item = plantilla.items.find((i) => i.id === itemId)!;
      setDrafts((d) => ({
        ...d,
        [itemId]: { descripcion: `${item.texto} – no cumple`, criticidad: 'medio', responsable: responsables[0], fechaCompromiso: addDays(todayISO(), 7) },
      }));
    }
    if (estado !== 'no_cumple') {
      setDrafts((d) => {
        const n = { ...d };
        delete n[itemId];
        return n;
      });
    }
  };

  const marcarTodoCumple = () => {
    setResp((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.estado ? v : { ...v, estado: 'cumple' as EstadoItem }])));
  };

  const draftsOk = Object.values(drafts).every((d) => d.descripcion.trim() && d.responsable && d.fechaCompromiso);
  const listo = respondidas === plantilla.items.length && draftsOk && firma && area && inspector.trim() && (plantilla.id !== 'ast' || tarea.trim());

  const guardar = () => {
    const insId = uid('ins-');
    const hoy = todayISO();
    const nuevos: Hallazgo[] = [];
    const respuestas = plantilla.items.map((it) => {
      const r = resp[it.id];
      const d = drafts[it.id];
      if (r.estado === 'no_cumple' && d) {
        const hId = uid('hz-');
        nuevos.push({
          id: hId,
          origen: 'inspeccion',
          origenId: insId,
          descripcion: d.descripcion.trim(),
          area,
          criticidad: d.criticidad,
          responsable: d.responsable,
          fechaDeteccion: hoy,
          fechaCompromiso: d.fechaCompromiso,
          foto: d.foto,
          estado: 'abierto',
          planAccion: '',
          planAprobado: false,
        });
        return { ...r, hallazgoId: hId };
      }
      return r;
    });
    const ins: Inspeccion = {
      id: insId,
      plantillaId: plantilla.id,
      fecha: hoy,
      area,
      inspector: inspector.trim(),
      tarea: plantilla.id === 'ast' ? tarea.trim() : undefined,
      equipoTrabajo: plantilla.id === 'ast' ? equipo.trim() : undefined,
      respuestas,
      cumplimiento,
      firmaInspector: firma,
      estado: 'finalizada',
    };
    updateCompany((c) => ({ ...c, inspecciones: [ins, ...c.inspecciones], hallazgos: [...nuevos, ...c.hallazgos] }));
    notify(`Inspección guardada (${cumplimiento}% cumplimiento). ${nuevos.length} hallazgo(s) creados.`);
    onSaved(ins);
  };

  return (
    <Modal
      title={plantilla.nombre}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-40 flex-1 items-center gap-2">
            <ProgressBar value={(respondidas / plantilla.items.length) * 100} tone="dark" />
            <span className="text-xs font-semibold whitespace-nowrap text-slate-600">
              {respondidas}/{plantilla.items.length}
            </span>
          </div>
          <Button variant="success" disabled={!listo} icon={<CheckCircle2 className="size-4" />} onClick={guardar}>
            Finalizar inspección
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {plantilla.descripcion} <span className="font-medium">({plantilla.norma})</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Área / Lugar">
            <Select value={area} onChange={(e) => setArea(e.target.value)} options={company.areas} />
          </Field>
          <Field label="Inspector">
            <Input value={inspector} onChange={(e) => setInspector(e.target.value)} />
          </Field>
          {plantilla.id === 'ast' && (
            <>
              <Field label="Tarea crítica / no rutinaria" required>
                <Input value={tarea} onChange={(e) => setTarea(e.target.value)} placeholder="Ej. Cambio de luminarias a 6 m" />
              </Field>
              <Field label="Equipo de trabajo">
                <Input value={equipo} onChange={(e) => setEquipo(e.target.value)} placeholder="Nombres de los ejecutores" />
              </Field>
            </>
          )}
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-sm">
            Cumplimiento parcial: <b className={cx(cumplimiento >= 85 ? 'text-ok-700' : cumplimiento >= 70 ? 'text-warn-700' : 'text-crit')}>{cumplimiento}%</b>
          </span>
          <Button size="sm" variant="ghost" onClick={marcarTodoCumple}>
            Marcar pendientes como Cumple
          </Button>
        </div>

        {secciones.map((sec) => (
          <div key={sec}>
            <p className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{sec}</p>
            <div className="space-y-2">
              {plantilla.items
                .filter((i) => i.seccion === sec)
                .map((it) => {
                  const r = resp[it.id];
                  const d = drafts[it.id];
                  return (
                    <div key={it.id} className={cx('rounded-lg border p-3', r.estado === 'no_cumple' ? 'border-crit/40 bg-crit-50/40' : r.estado === 'cumple' ? 'border-ok/40' : 'border-slate-200')}>
                      <p className="text-sm font-medium text-navy">
                        {it.texto} {it.referencia && <span className="text-xs font-normal text-slate-400">({it.referencia})</span>}
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => marcar(it.id, 'cumple')} className={cx('flex items-center justify-center gap-1.5 min-h-12 rounded-md border py-2.5 text-sm font-semibold', r.estado === 'cumple' ? 'border-ok bg-ok text-white' : 'border-slate-200 text-slate-600')}>
                          <CheckCircle2 className="size-4" /> Cumple
                        </button>
                        <button type="button" onClick={() => marcar(it.id, 'no_cumple')} className={cx('flex items-center justify-center gap-1.5 min-h-12 rounded-md border py-2.5 text-sm font-semibold', r.estado === 'no_cumple' ? 'border-crit bg-crit text-white' : 'border-slate-200 text-slate-600')}>
                          <XCircle className="size-4" /> No cumple
                        </button>
                        <button type="button" onClick={() => marcar(it.id, 'na')} className={cx('flex items-center justify-center gap-1.5 min-h-12 rounded-md border py-2.5 text-sm font-semibold', r.estado === 'na' ? 'border-slate-500 bg-slate-500 text-white' : 'border-slate-200 text-slate-600')}>
                          <MinusCircle className="size-4" /> N/A
                        </button>
                      </div>
                      {r.estado && r.estado !== 'no_cumple' && (
                        <Input className="mt-2" placeholder="Observación (opcional)" value={r.observacion} onChange={(e) => setResp((x) => ({ ...x, [it.id]: { ...x[it.id], observacion: e.target.value } }))} />
                      )}
                      {d && (
                        <div className="mt-3 space-y-3 rounded-lg border border-crit/30 bg-white p-3">
                          <p className="flex items-center gap-1.5 text-sm font-bold text-crit-700">
                            <AlertTriangle className="size-4" /> Nuevo hallazgo
                          </p>
                          <Field label="Descripción del hallazgo">
                            <TextArea rows={2} value={d.descripcion} onChange={(e) => setDrafts((x) => ({ ...x, [it.id]: { ...d, descripcion: e.target.value } }))} />
                          </Field>
                          <CriticidadPicker value={d.criticidad} onChange={(c) => setDrafts((x) => ({ ...x, [it.id]: { ...d, criticidad: c, fechaCompromiso: addDays(todayISO(), c === 'alto' ? 3 : c === 'medio' ? 7 : 15) } }))} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Supervisor responsable">
                              <Select value={d.responsable} onChange={(e) => setDrafts((x) => ({ ...x, [it.id]: { ...d, responsable: e.target.value } }))} options={responsables} />
                            </Field>
                            <Field label="Fecha compromiso">
                              <Input type="date" min={todayISO()} value={d.fechaCompromiso} onChange={(e) => setDrafts((x) => ({ ...x, [it.id]: { ...d, fechaCompromiso: e.target.value } }))} />
                            </Field>
                          </div>
                          <PhotoInput value={d.foto} onChange={(f) => setDrafts((x) => ({ ...x, [it.id]: { ...d, foto: f } }))} />
                          <Input placeholder="Observación adicional" value={r.observacion} onChange={(e) => setResp((x) => ({ ...x, [it.id]: { ...x[it.id], observacion: e.target.value } }))} />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
        <SignaturePad label="Firma del inspector" value={firma} onChange={setFirma} />
      </div>
    </Modal>
  );
}

function DetalleInspeccion({ ins, onClose }: { ins: Inspeccion; onClose: () => void }) {
  const { company, can, updateCompany, notify } = useStore();
  const pl = PLANTILLAS.find((p) => p.id === ins.plantillaId)!;
  const hallazgos = company.hallazgos.filter((h) => h.origenId === ins.id);
  return (
    <Modal
      title={pl.nombre}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {can('eliminarRegistros') && (
            <Button
              variant="ghost"
              className="mr-auto text-crit"
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                if (!confirm('¿Eliminar la inspección? Los hallazgos asociados se mantienen.')) return;
                updateCompany((c) => ({ ...c, inspecciones: c.inspecciones.filter((x) => x.id !== ins.id) }));
                onClose();
              }}
            >
              Eliminar
            </Button>
          )}
          <Button
            icon={<FileDown className="size-4" />}
            onClick={() => {
              generarInformeInspeccion(company, ins, pl, hallazgos);
              notify('Informe PDF descargado');
            }}
          >
            Descargar informe PDF
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Fecha</p>
            <p className="font-medium">{formatDate(ins.fecha)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Área</p>
            <p className="font-medium">{ins.area}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Inspector</p>
            <p className="font-medium">{ins.inspector}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Cumplimiento</p>
            <p className="font-bold">{ins.cumplimiento}%</p>
          </div>
        </div>
        {ins.tarea && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm">
            <b>Tarea:</b> {ins.tarea} {ins.equipoTrabajo && <> · <b>Equipo:</b> {ins.equipoTrabajo}</>}
          </p>
        )}
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {pl.items.map((it) => {
            const r = ins.respuestas.find((x) => x.itemId === it.id);
            return (
              <li key={it.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                {r?.estado === 'cumple' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : r?.estado === 'no_cumple' ? <XCircle className="mt-0.5 size-4 shrink-0 text-crit" /> : <MinusCircle className="mt-0.5 size-4 shrink-0 text-slate-400" />}
                <span className="flex-1">
                  {it.texto}
                  {r?.observacion && <span className="block text-xs text-slate-500">{r.observacion}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        {hallazgos.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Hallazgos generados</p>
            {hallazgos.map((h) => (
              <div key={h.id} className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                <Badge tone={CRIT_TONE[h.criticidad]}>{CRIT_LABEL[h.criticidad]}</Badge>
                <span className="flex-1">{h.descripcion}</span>
                <Badge tone={h.estado === 'cerrado' ? 'ok' : 'warn'}>{h.estado.replace('_', ' ')}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ExtintoresPanel() {
  const { company, updateCompany, can, notify } = useStore();
  const editable = can('gestionarExtintores');
  const [form, setForm] = useState<Extintor | null>(null);

  const estado = (e: Extintor): { tone: Tone; label: string } => {
    const d = daysFromToday(e.fechaVencimiento);
    if (d < 0) return { tone: 'crit', label: `Vencido (${-d} d)` };
    if (d <= 30) return { tone: 'warn', label: `Vence en ${d} d` };
    return { tone: 'ok', label: 'Vigente' };
  };

  const extOrdenados = [...company.extintores].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
  const mantencion = (e: Extintor) => {
    updateCompany((c) => ({ ...c, extintores: c.extintores.map((x) => (x.id === e.id ? { ...x, fechaVencimiento: addMonths(todayISO(), 12) } : x)) }));
    notify(`${e.codigo}: mantención registrada, vigente 12 meses`);
  };

  const guardar = () => {
    if (!form) return;
    updateCompany((c) => ({
      ...c,
      extintores: c.extintores.some((x) => x.id === form.id) ? c.extintores.map((x) => (x.id === form.id ? form : x)) : [...c.extintores, form],
    }));
    setForm(null);
    notify('Extintor guardado');
  };

  return (
    <Card
      title="Control de extintores"
      subtitle="Mantención anual NCh 2056 · DS 594 Art. 45-52"
      icon={<Flame className="size-5" />}
      actions={
        editable && (
          <Button
            size="sm"
            icon={<Plus className="size-4" />}
            onClick={() => setForm({ id: uid('ext-'), codigo: `EXT-${String(company.extintores.length + 1).padStart(3, '0')}`, ubicacion: '', tipo: 'PQS ABC', capacidadKg: 6, fechaVencimiento: addMonths(todayISO(), 12) })}
          >
            Agregar
          </Button>
        )
      }
    >
      {company.extintores.length === 0 ? (
        <p className="text-sm text-slate-500">No hay extintores registrados.</p>
      ) : (
        <>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] tracking-[0.06em] text-slate-500 uppercase">
                <th className="py-2 pr-2 font-semibold">Código</th>
                <th className="px-2 font-semibold">Ubicación</th>
                <th className="px-2 font-semibold">Tipo</th>
                <th className="px-2 font-semibold">Próx. mantención</th>
                <th className="px-2 font-semibold">Estado</th>
                {editable && <th className="px-2" />}
              </tr>
            </thead>
            <tbody>
              {extOrdenados.map((e) => {
                const s = estado(e);
                return (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-2 font-mono text-[13px] font-medium">{e.codigo}</td>
                    <td className="px-2">{e.ubicacion}</td>
                    <td className="px-2 whitespace-nowrap">
                      {e.tipo} · <span className="tabular-nums">{e.capacidadKg} kg</span>
                    </td>
                    <td className="px-2 tabular-nums">{formatDate(e.fechaVencimiento)}</td>
                    <td className="px-2">
                      <Badge tone={s.tone} dot>
                        {s.label}
                      </Badge>
                    </td>
                    {editable && (
                      <td className="px-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} title="Registrar mantención (vigencia +12 meses)" onClick={() => mantencion(e)}>
                            Mantención
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setForm(e)}>
                            Editar
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ul className="-mx-4 -my-4 divide-y divide-slate-200 md:hidden">
            {extOrdenados.map((e) => {
              const s = estado(e);
              return (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] font-medium text-navy">{e.codigo}</p>
                      <p className="text-sm font-medium break-words text-navy">{e.ubicacion}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {e.tipo} · <span className="tabular-nums">{e.capacidadKg} kg</span> · vence <span className="tabular-nums">{formatDate(e.fechaVencimiento)}</span>
                      </p>
                    </div>
                    <Badge tone={s.tone} dot>
                      {s.label}
                    </Badge>
                  </div>
                  {editable && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={() => mantencion(e)}>
                        Mantención
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setForm(e)}>
                        Editar
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {form && (
        <Modal
          title="Extintor"
          onClose={() => setForm(null)}
          footer={
            <>
              {company.extintores.some((x) => x.id === form.id) && (
                <Button
                  variant="ghost"
                  className="mr-auto text-crit"
                  onClick={() => {
                    updateCompany((c) => ({ ...c, extintores: c.extintores.filter((x) => x.id !== form.id) }));
                    setForm(null);
                  }}
                >
                  Eliminar
                </Button>
              )}
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button disabled={!form.ubicacion.trim()} onClick={guardar}>
                Guardar
              </Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código">
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </Field>
            <Field label="Ubicación" required>
              <Input value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} />
            </Field>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Extintor['tipo'] })} options={['PQS ABC', 'CO2', 'Agua', 'Clase K', 'Espuma AFFF']} />
            </Field>
            <Field label="Capacidad (kg)">
              <Input type="number" min={1} value={form.capacidadKg} onChange={(e) => setForm({ ...form, capacidadKg: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Vencimiento mantención" className="sm:col-span-2">
              <Input type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}
    </Card>
  );
}

export default function Inspecciones() {
  const { company, can } = useStore();
  const [tab, setTab] = useState<TabId>(can('crearInspeccion') ? 'nueva' : 'historial');
  const [ejecutando, setEjecutando] = useState<PlantillaChecklist | null>(null);
  const [detalle, setDetalle] = useState<Inspeccion | null>(null);
  const [filtro, setFiltro] = useState('');

  const historial = company.inspecciones.filter((i) => !filtro || i.plantillaId === filtro).sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div>
      <PageHeader title="Inspecciones en Terreno" subtitle="Checklists normativos DS 594, maquinaria y AST" icon={<ClipboardCheck className="size-6" />} />
      <Tabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          ...(can('crearInspeccion') ? [{ id: 'nueva' as TabId, label: 'Nueva inspección' }] : []),
          { id: 'historial', label: 'Historial', count: company.inspecciones.length },
          { id: 'extintores', label: 'Extintores', count: company.extintores.length },
        ]}
      />

      {tab === 'nueva' && (
        <div className="grid gap-3 md:grid-cols-3">
          {PLANTILLAS.map((p) => {
            const Icon = ICONOS[p.id];
            return (
              <button key={p.id} type="button" onClick={() => setEjecutando(p)} className="group text-left">
                <Card className="h-full transition-colors group-hover:border-slate-400" bodyClass="p-4">
                  <span className="mb-3 inline-flex rounded-lg bg-navy p-3 text-white">
                    <Icon className="size-6" />
                  </span>
                  <p className="font-bold text-navy">{p.nombre}</p>
                  <p className="mt-1 text-sm text-slate-500">{p.descripcion}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge>{p.items.length} ítems</Badge>
                    <span className="text-xs font-medium text-slate-400">{p.norma}</span>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {tab === 'historial' && (
        <div>
          <div className="mb-3 max-w-xs">
            <Select value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Todas las plantillas" options={PLANTILLAS.map((p) => ({ value: p.id, label: p.nombre }))} />
          </div>
          {historial.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="size-10" />} title="Sin inspecciones" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {historial.map((i) => {
                const pl = PLANTILLAS.find((p) => p.id === i.plantillaId)!;
                const nc = i.respuestas.filter((r) => r.estado === 'no_cumple').length;
                return (
                  <button key={i.id} type="button" className="text-left" onClick={() => setDetalle(i)}>
                    <Card bodyClass="p-4" className=" transition-colors hover:border-slate-400">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-navy">{pl.nombre}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(i.fecha)} · {i.area} · {i.inspector}
                          </p>
                        </div>
                        <span className={cx('text-2xl font-black tabular-nums', i.cumplimiento >= 85 ? 'text-ok-700' : i.cumplimiento >= 70 ? 'text-warn-700' : 'text-crit')}>{i.cumplimiento}%</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <ProgressBar value={i.cumplimiento} />
                        {nc > 0 && <Badge tone="crit">{nc} NC</Badge>}
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'extintores' && <ExtintoresPanel />}

      {ejecutando && (
        <EjecutarChecklist
          plantilla={ejecutando}
          onClose={() => setEjecutando(null)}
          onSaved={(i) => {
            setEjecutando(null);
            setTab('historial');
            setDetalle(i);
          }}
        />
      )}
      {detalle && <DetalleInspeccion ins={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}
