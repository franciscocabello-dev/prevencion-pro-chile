import { useState } from 'react';
import { CheckCheck, CheckCircle2, Clock, Plus, ShieldCheck, Wrench, PlayCircle, Calendar, User } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { Criticidad, EstadoHallazgo, Hallazgo } from '../../../types';
import { addDays, daysFromToday, formatDate, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PhotoInput, Select, Stat, StatGrid, Tabs, TextArea, Thumb, cx } from '../../ui';
import { CRIT_LABEL, CRIT_TONE } from '../inspecciones/Inspecciones';

type Filtro = 'abiertos' | 'por_aprobar' | 'vencidos' | 'cerrados' | 'todos';

const ESTADO_LABEL: Record<EstadoHallazgo, string> = { abierto: 'Abierto', en_proceso: 'En proceso', cerrado: 'Cerrado' };

function GestionHallazgo({ h, onClose }: { h: Hallazgo; onClose: () => void }) {
  const { company, state, can, updateCompany, notify } = useStore();
  const [plan, setPlan] = useState(h.planAccion);
  const [responsable, setResponsable] = useState(h.responsable);
  const [fecha, setFecha] = useState(h.fechaCompromiso);
  const [evidencia, setEvidencia] = useState<string | undefined>(h.evidenciaCierre);
  const [comentario, setComentario] = useState(h.comentarioCierre ?? '');
  const editable = can('gestionarHallazgos') && h.estado !== 'cerrado';
  const responsables = [...new Set([...company.supervisores, h.responsable])];

  const patch = (p: Partial<Hallazgo>, msg: string) => {
    updateCompany((c) => ({ ...c, hallazgos: c.hallazgos.map((x) => (x.id === h.id ? { ...x, ...p } : x)) }));
    notify(msg);
    onClose();
  };

  const vence = daysFromToday(h.fechaCompromiso);

  return (
    <Modal
      title="Hallazgo y plan de acción"
      onClose={onClose}
      size="lg"
      footer={
        <>
          {editable && (
            <Button
              variant="secondary"
              onClick={() =>
                patch(
                  {
                    planAccion: plan.trim(),
                    responsable,
                    fechaCompromiso: fecha,
                    evidenciaCierre: evidencia,
                    comentarioCierre: comentario,
                    // Si cambia el plan, requiere nueva aprobación
                    planAprobado: plan.trim() === h.planAccion ? h.planAprobado : false,
                  },
                  'Cambios guardados',
                )
              }
            >
              Guardar cambios
            </Button>
          )}
          {editable && h.estado === 'abierto' && (
            <Button variant="warning" icon={<PlayCircle className="size-4" />} disabled={!plan.trim()} onClick={() => patch({ estado: 'en_proceso', planAccion: plan.trim(), responsable, fechaCompromiso: fecha }, 'Hallazgo en proceso')}>
              Iniciar ejecución
            </Button>
          )}
          {can('aprobarPlanes') && !h.planAprobado && h.estado !== 'cerrado' && (
            <Button
              variant="primary"
              icon={<CheckCheck className="size-4" />}
              disabled={!plan.trim()}
              onClick={() => patch({ planAccion: plan.trim(), planAprobado: true, aprobadoPor: state.usuario }, 'Plan de acción aprobado')}
            >
              Aprobar plan
            </Button>
          )}
          {can('cerrarHallazgo') && h.estado !== 'cerrado' && (
            <Button
              variant="success"
              icon={<CheckCircle2 className="size-4" />}
              disabled={!comentario.trim()}
              title={!comentario.trim() ? 'Ingrese comentario de verificación' : undefined}
              onClick={() => patch({ estado: 'cerrado', fechaCierre: todayISO(), evidenciaCierre: evidencia, comentarioCierre: comentario.trim(), planAccion: plan.trim() || h.planAccion }, 'Hallazgo cerrado y verificado')}
            >
              Cerrar hallazgo
            </Button>
          )}
          {can('cerrarHallazgo') && h.estado === 'cerrado' && (
            <Button variant="secondary" onClick={() => patch({ estado: 'en_proceso', fechaCierre: undefined }, 'Hallazgo reabierto')}>
              Reabrir
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <Thumb src={h.foto} className="size-24" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap gap-1.5">
              <Badge tone={CRIT_TONE[h.criticidad]}>Criticidad {CRIT_LABEL[h.criticidad]}</Badge>
              <Badge tone={h.estado === 'cerrado' ? 'ok' : h.estado === 'en_proceso' ? 'info' : 'warn'}>{ESTADO_LABEL[h.estado]}</Badge>
              {h.planAprobado ? <Badge tone="ok">Plan aprobado</Badge> : <Badge tone="warn">Plan sin aprobar</Badge>}
            </div>
            <p className="font-semibold text-navy">{h.descripcion}</p>
            <p className="text-xs text-slate-500">
              {h.area} · detectado {formatDate(h.fechaDeteccion)} · origen {h.origen}
              {h.estado !== 'cerrado' && <> · {vence < 0 ? <b className="text-crit">vencido hace {-vence} días</b> : `vence en ${vence} días`}</>}
            </p>
            {h.aprobadoPor && <p className="text-xs text-slate-500">Aprobado por: {h.aprobadoPor}</p>}
          </div>
        </div>
        <Field label="Plan de acción / medida correctiva" hint="Considere la jerarquía de controles: eliminación, sustitución, ingeniería, administración, EPP.">
          <TextArea rows={3} value={plan} disabled={!editable} onChange={(e) => setPlan(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Responsable">
            <Select value={responsable} disabled={!editable} onChange={(e) => setResponsable(e.target.value)} options={responsables} />
          </Field>
          <Field label="Fecha compromiso">
            <Input type="date" value={fecha} disabled={!editable} onChange={(e) => setFecha(e.target.value)} />
          </Field>
        </div>
        {(can('gestionarHallazgos') || can('cerrarHallazgo')) && h.estado !== 'cerrado' ? (
          <>
            <PhotoInput label="Evidencia de corrección" value={evidencia} onChange={setEvidencia} />
            <Field label="Comentario de verificación / cierre">
              <TextArea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Describa la acción ejecutada y su verificación en terreno" />
            </Field>
          </>
        ) : (
          h.estado === 'cerrado' && (
            <div className="rounded-lg bg-ok-50 p-3 text-sm text-ok-800">
              <p className="font-semibold">Cerrado el {formatDate(h.fechaCierre)}</p>
              <p>{h.comentarioCierre}</p>
              {h.evidenciaCierre && <Thumb src={h.evidenciaCierre} className="mt-2 size-24" />}
            </div>
          )
        )}
      </div>
    </Modal>
  );
}

function NuevoHallazgo({ onClose }: { onClose: () => void }) {
  const { company, state, updateCompany, notify } = useStore();
  const [d, setD] = useState({
    descripcion: '',
    area: company.areas[0] ?? '',
    criticidad: 'medio' as Criticidad,
    responsable: company.supervisores[0] ?? state.usuario,
    fechaCompromiso: addDays(todayISO(), 7),
    planAccion: '',
    foto: undefined as string | undefined,
  });
  return (
    <Modal
      title="Nuevo hallazgo"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!d.descripcion.trim()}
            onClick={() => {
              const h: Hallazgo = { id: uid('hz-'), origen: 'manual', fechaDeteccion: todayISO(), estado: 'abierto', planAprobado: false, ...d, descripcion: d.descripcion.trim() };
              updateCompany((c) => ({ ...c, hallazgos: [h, ...c.hallazgos] }));
              notify('Hallazgo registrado');
              onClose();
            }}
          >
            Registrar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Descripción" required>
          <TextArea value={d.descripcion} onChange={(e) => setD({ ...d, descripcion: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Área">
            <Select value={d.area} onChange={(e) => setD({ ...d, area: e.target.value })} options={company.areas} />
          </Field>
          <Field label="Criticidad">
            <Select value={d.criticidad} onChange={(e) => setD({ ...d, criticidad: e.target.value as Criticidad })} options={[{ value: 'alto', label: 'Alto' }, { value: 'medio', label: 'Medio' }, { value: 'bajo', label: 'Bajo' }]} />
          </Field>
          <Field label="Responsable">
            <Select value={d.responsable} onChange={(e) => setD({ ...d, responsable: e.target.value })} options={company.supervisores.length ? company.supervisores : [state.usuario]} />
          </Field>
          <Field label="Fecha compromiso">
            <Input type="date" value={d.fechaCompromiso} onChange={(e) => setD({ ...d, fechaCompromiso: e.target.value })} />
          </Field>
        </div>
        <Field label="Plan de acción propuesto">
          <TextArea value={d.planAccion} onChange={(e) => setD({ ...d, planAccion: e.target.value })} />
        </Field>
        <PhotoInput value={d.foto} onChange={(f) => setD({ ...d, foto: f })} />
      </div>
    </Modal>
  );
}

export default function Hallazgos() {
  const { company, rol, state, can } = useStore();
  const [filtro, setFiltro] = useState<Filtro>(rol === 'gerencia' ? 'por_aprobar' : 'abiertos');
  const [soloMios, setSoloMios] = useState(rol === 'supervisor');
  const [area, setArea] = useState('');
  const [sel, setSel] = useState<Hallazgo | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const base = company.hallazgos.filter((h) => (!soloMios || h.responsable === state.usuario) && (!area || h.area === area));
  const grupos: Record<Filtro, Hallazgo[]> = {
    abiertos: base.filter((h) => h.estado !== 'cerrado'),
    por_aprobar: base.filter((h) => h.estado !== 'cerrado' && !h.planAprobado),
    vencidos: base.filter((h) => h.estado !== 'cerrado' && daysFromToday(h.fechaCompromiso) < 0),
    cerrados: base.filter((h) => h.estado === 'cerrado'),
    todos: base,
  };
  const orden: Record<Criticidad, number> = { alto: 0, medio: 1, bajo: 2 };
  const lista = [...grupos[filtro]].sort((a, b) => orden[a.criticidad] - orden[b.criticidad] || a.fechaCompromiso.localeCompare(b.fechaCompromiso));
  const tasaCierre = base.length ? Math.round((grupos.cerrados.length / base.length) * 100) : 100;

  return (
    <div>
      <PageHeader
        title="Hallazgos y Planes de Acción"
        subtitle={rol === 'gerencia' ? 'Aprobación de planes y seguimiento de cierre' : 'Seguimiento de desviaciones detectadas en terreno'}
        icon={<Wrench className="size-6" />}
        actions={
          can('gestionarHallazgos') && (
            <Button icon={<Plus className="size-4" />} onClick={() => setNuevo(true)}>
              Nuevo hallazgo
            </Button>
          )
        }
      />
      <StatGrid className="mb-4">
        <Stat label="Abiertos" value={grupos.abiertos.length} tone={grupos.abiertos.length ? 'warn' : 'ok'} />
        <Stat label="Críticos abiertos" value={grupos.abiertos.filter((h) => h.criticidad === 'alto').length} tone={grupos.abiertos.some((h) => h.criticidad === 'alto') ? 'crit' : 'ok'} />
        <Stat label="Plazo vencido" value={grupos.vencidos.length} tone={grupos.vencidos.length ? 'crit' : 'ok'} />
        <Stat label="Tasa de cierre" value={`${tasaCierre}%`} tone={tasaCierre >= 80 ? 'ok' : 'warn'} />
      </StatGrid>
      <Tabs<Filtro>
        value={filtro}
        onChange={setFiltro}
        tabs={[
          { id: 'abiertos', label: 'Abiertos', count: grupos.abiertos.length },
          { id: 'por_aprobar', label: 'Por aprobar', count: grupos.por_aprobar.length },
          { id: 'vencidos', label: 'Vencidos', count: grupos.vencidos.length },
          { id: 'cerrados', label: 'Cerrados', count: grupos.cerrados.length },
          { id: 'todos', label: 'Todos', count: grupos.todos.length },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-56">
          <Select value={area} onChange={(e) => setArea(e.target.value)} placeholder="Todas las áreas" options={company.areas} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4 accent-navy" checked={soloMios} onChange={(e) => setSoloMios(e.target.checked)} />
          Sólo asignados a mí ({state.usuario})
        </label>
      </div>

      {lista.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="size-10" />} title="Sin hallazgos en esta vista" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lista.map((h) => {
            const d = daysFromToday(h.fechaCompromiso);
            return (
              <button key={h.id} type="button" onClick={() => setSel(h)} className="text-left">
                <Card bodyClass="p-3.5" className={cx(' transition-colors hover:border-slate-400')}>
                  <div className="flex gap-3">
                    <Thumb src={h.foto} className="size-16" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap gap-1.5">
                        <Badge tone={CRIT_TONE[h.criticidad]}>{CRIT_LABEL[h.criticidad]}</Badge>
                        <Badge tone={h.estado === 'cerrado' ? 'ok' : h.estado === 'en_proceso' ? 'info' : 'neutral'}>{ESTADO_LABEL[h.estado]}</Badge>
                        {!h.planAprobado && h.estado !== 'cerrado' && <Badge tone="warn">Por aprobar</Badge>}
                      </div>
                      <p className="line-clamp-2 text-sm font-semibold text-navy">{h.descripcion}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="size-3.5" /> {h.responsable}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3.5" /> {formatDate(h.fechaCompromiso)}
                        </span>
                        {h.estado !== 'cerrado' && (
                          <span className={cx('flex items-center gap-1 font-semibold', d < 0 ? 'text-crit' : d <= 3 ? 'text-warn-700' : '')}>
                            <Clock className="size-3.5" /> {d < 0 ? `Vencido ${-d}d` : `${d}d restantes`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}
      {sel && <GestionHallazgo h={sel} onClose={() => setSel(null)} />}
      {nuevo && <NuevoHallazgo onClose={() => setNuevo(false)} />}
    </div>
  );
}
