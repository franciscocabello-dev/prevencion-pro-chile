import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, Pencil, Play, Plus, Siren, Square, Timer, X } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { EscenarioEmergencia, Hallazgo, PlanEmergencia, Simulacro } from '../../../types';
import { ESCENARIO_LABEL, FLUJO_ESPECIFICO, diasDesdeSimulacro, estimarEvacuacion, faltantesPlan, fmtSeg, planInicial, simulacrosOrdenados } from '../../../utils/emergencias';
import { generarPlanEmergencia } from '../../../utils/pdfGenerator';
import { addDays, formatDate, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { Badge, Button, Card, EmptyState, Field, Input, KV, Modal, PageHeader, ReadOnlyNotice, Select, TextArea, cx } from '../../ui';

const ESCENARIOS = Object.keys(ESCENARIO_LABEL) as EscenarioEmergencia[];
const dec = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 2 });
const num = (v: string) => (Number.isFinite(parseFloat(v.replace(',', '.'))) ? parseFloat(v.replace(',', '.')) : 0);

// ------------------------------------------------------------
// Editor del plan
// ------------------------------------------------------------
function EditarPlan({ onClose }: { onClose: () => void }) {
  const { company, updateCompany, notify } = useStore();
  const [p, setP] = useState<PlanEmergencia>(() => company.planEmergencia ?? planInicial(company));
  const est = estimarEvacuacion(p);

  const guardar = () => {
    updateCompany((c) => ({ ...c, planEmergencia: { ...p, actualizadoEn: todayISO() } }));
    notify('Plan de emergencia guardado');
    onClose();
  };

  return (
    <Modal
      title="Plan de emergencia"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Guardar plan</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Escenarios de emergencia</p>
          <div className="flex flex-wrap gap-2">
            {ESCENARIOS.map((e) => {
              const on = p.escenarios.includes(e);
              return (
                <button
                  key={e}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setP({ ...p, escenarios: on ? p.escenarios.filter((x) => x !== e) : [...p.escenarios, e] })}
                  className={cx('min-h-11 rounded-full border-2 px-4 text-sm font-medium', on ? 'border-navy bg-navy text-white' : 'border-slate-200 text-slate-600')}
                >
                  {ESCENARIO_LABEL[e]}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Punto de encuentro" hint="Por ejemplo: estacionamiento norte, frente a portería.">
          <Input value={p.puntoEncuentro} onChange={(e) => setP({ ...p, puntoEncuentro: e.target.value })} />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Brigada de emergencia</p>
          <div className="space-y-2">
            {p.brigada.map((b, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <Input value={b.rol} aria-label="Rol" onChange={(e) => setP({ ...p, brigada: p.brigada.map((x, j) => (j === i ? { ...x, rol: e.target.value } : x)) })} />
                <Input value={b.nombre} placeholder="Nombre" aria-label={`Nombre ${b.rol}`} onChange={(e) => setP({ ...p, brigada: p.brigada.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)) })} />
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setP({ ...p, brigada: [...p.brigada, { rol: '', nombre: '' }] })}>
            Agregar integrante
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Teléfonos de emergencia</p>
          <div className="space-y-2">
            {p.telefonos.map((t, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <Input value={t.nombre} aria-label="Servicio" onChange={(e) => setP({ ...p, telefonos: p.telefonos.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)) })} />
                <Input value={t.numero} inputMode="tel" placeholder="Número" aria-label={`Número ${t.nombre}`} onChange={(e) => setP({ ...p, telefonos: p.telefonos.map((x, j) => (j === i ? { ...x, numero: e.target.value } : x)) })} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Zonas de la instalación</p>
          <p className="mb-2 text-xs text-slate-500">Ocupantes y distancia en metros desde el punto más lejano de la zona hasta la salida.</p>
          <div className="space-y-2">
            {p.zonas.map((z) => (
              <div key={z.id} className="grid grid-cols-[1fr_5rem_5rem_auto] items-center gap-2">
                <Input value={z.nombre} aria-label="Zona" onChange={(e) => setP({ ...p, zonas: p.zonas.map((x) => (x.id === z.id ? { ...x, nombre: e.target.value } : x)) })} />
                <Input inputMode="numeric" value={String(z.ocupantes)} aria-label="Ocupantes" onChange={(e) => setP({ ...p, zonas: p.zonas.map((x) => (x.id === z.id ? { ...x, ocupantes: Math.round(num(e.target.value)) } : x)) })} />
                <Input inputMode="decimal" value={String(z.distancia)} aria-label="Distancia en metros" onChange={(e) => setP({ ...p, zonas: p.zonas.map((x) => (x.id === z.id ? { ...x, distancia: num(e.target.value) } : x)) })} />
                <Button variant="ghost" size="sm" aria-label="Quitar zona" onClick={() => setP({ ...p, zonas: p.zonas.filter((x) => x.id !== z.id) })}>
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setP({ ...p, zonas: [...p.zonas, { id: uid('zn-'), nombre: `Zona ${p.zonas.length + 1}`, ocupantes: 1, distancia: 20 }] })}>
            Agregar zona
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Salidas de emergencia (ancho libre en metros)</p>
          <div className="space-y-2">
            {p.salidas.map((s) => (
              <div key={s.id} className="grid grid-cols-[1fr_5rem_auto] items-center gap-2">
                <Input value={s.nombre} aria-label="Salida" onChange={(e) => setP({ ...p, salidas: p.salidas.map((x) => (x.id === s.id ? { ...x, nombre: e.target.value } : x)) })} />
                <Input inputMode="decimal" value={String(s.ancho)} aria-label="Ancho en metros" onChange={(e) => setP({ ...p, salidas: p.salidas.map((x) => (x.id === s.id ? { ...x, ancho: num(e.target.value) } : x)) })} />
                <Button variant="ghost" size="sm" aria-label="Quitar salida" onClick={() => setP({ ...p, salidas: p.salidas.filter((x) => x.id !== s.id) })}>
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setP({ ...p, salidas: [...p.salidas, { id: uid('sal-'), nombre: `Salida ${p.salidas.length + 1}`, ancho: 0.9 }] })}>
            Agregar salida
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Alarma y reacción (s)" hint="Desde la detección hasta que se empieza a evacuar">
            <Input inputMode="numeric" value={String(p.tiempoAlarmaSeg)} onChange={(e) => setP({ ...p, tiempoAlarmaSeg: Math.round(num(e.target.value)) })} />
          </Field>
          <Field label="Velocidad de marcha (m/s)" hint="1,0 es conservador; menor si hay escaleras o movilidad reducida">
            <Input inputMode="decimal" value={String(p.velocidad)} onChange={(e) => setP({ ...p, velocidad: num(e.target.value) })} />
          </Field>
        </div>
        {est && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Con estos datos, el tiempo estimado de evacuación es de {fmtSeg(est.totalSeg)}.</p>}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
// Registro de simulacro con cronómetro
// ------------------------------------------------------------
function NuevoSimulacro({ onClose }: { onClose: () => void }) {
  const { company, state, updateCompany, notify } = useStore();
  const est = company.planEmergencia ? estimarEvacuacion(company.planEmergencia) : null;
  const [fecha, setFecha] = useState(todayISO());
  const [escenario, setEscenario] = useState<EscenarioEmergencia>(company.planEmergencia?.escenarios[0] ?? 'incendio');
  const [conAviso, setConAviso] = useState(true);
  const [participantes, setParticipantes] = useState(String(est?.ocupantes ?? company.trabajadores.filter((t) => t.activo).length));
  const [coordinador, setCoordinador] = useState(company.planEmergencia?.brigada[0]?.nombre || state.usuario);
  const [obs, setObs] = useState('');
  const [mejoras, setMejoras] = useState<string[]>([]);
  const [mejora, setMejora] = useState('');
  const [crearHallazgos, setCrearHallazgos] = useState(true);
  // Cronómetro
  const [inicio, setInicio] = useState<number | null>(null);
  const [seg, setSeg] = useState(0);
  const [manual, setManual] = useState('');
  const tick = useRef<number | null>(null);
  useEffect(() => {
    if (inicio === null) return;
    tick.current = window.setInterval(() => setSeg(Math.floor((Date.now() - inicio) / 1000)), 250);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [inicio]);
  const corriendo = inicio !== null;
  const tiempoManual = (() => {
    const m = manual.match(/^(\d{1,3})(?::(\d{1,2}))?$/);
    if (!m) return null;
    return m[2] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[1]);
  })();
  const tiempo = tiempoManual ?? seg;

  const guardar = () => {
    const ids: string[] = [];
    const nuevos: Hallazgo[] = crearHallazgos
      ? mejoras.map((m) => {
          const id = uid('hz-');
          ids.push(id);
          return {
            id,
            origen: 'manual',
            descripcion: `Simulacro ${formatDate(fecha)}: ${m}`,
            area: 'General',
            criticidad: 'medio',
            responsable: coordinador,
            fechaDeteccion: fecha,
            fechaCompromiso: addDays(fecha, 30),
            estado: 'abierto',
            planAccion: '',
            planAprobado: false,
          };
        })
      : [];
    const sim: Simulacro = {
      id: uid('sim-'),
      fecha,
      escenario,
      conAviso,
      participantes: Math.round(num(participantes)),
      tiempoRealSeg: tiempo,
      tiempoEstimadoSeg: est?.totalSeg ?? null,
      coordinador: coordinador.trim(),
      observaciones: obs.trim(),
      mejoras,
      hallazgosCreados: ids,
    };
    const actividadCerrada = !!company.programa?.actividades.some((a) => a.origen === 'emergencia' && a.estado !== 'realizada');
    updateCompany((c) => {
      // El simulacro cumple la actividad de emergencias pendiente del programa de trabajo
      let programa = c.programa;
      if (programa) {
        const act = programa.actividades.find((a) => a.origen === 'emergencia' && a.estado !== 'realizada');
        if (act) {
          programa = { ...programa, actividades: programa.actividades.map((a) => (a.id === act.id ? { ...a, estado: 'realizada', fechaRealizada: fecha, verificacion: `Simulacro de ${ESCENARIO_LABEL[escenario].toLowerCase()} registrado en la app` } : a)) };
        }
      }
      return { ...c, simulacros: [...(c.simulacros ?? []), sim], hallazgos: [...c.hallazgos, ...nuevos], programa };
    });
    notify(`Simulacro registrado${nuevos.length ? ` · ${nuevos.length} ${nuevos.length === 1 ? 'hallazgo creado' : 'hallazgos creados'}` : ''}${actividadCerrada ? ' · actividad del programa cumplida' : ''}`);
    onClose();
  };

  return (
    <Modal
      title="Registrar simulacro"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={corriendo || tiempo <= 0 || !coordinador.trim()}>
            Guardar simulacro
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-navy p-4 text-center text-white">
          <p className="text-xs tracking-wide uppercase opacity-70">Tiempo de evacuación</p>
          <p className="my-1 text-5xl font-bold tabular-nums">{fmtSeg(tiempo)}</p>
          {est && <p className="text-xs opacity-70">Estimado por el plan: {fmtSeg(est.totalSeg)}</p>}
          <div className="mt-3 flex justify-center gap-2">
            {!corriendo ? (
              <Button
                variant="secondary"
                icon={<Play className="size-4" />}
                onClick={() => {
                  setManual('');
                  setSeg(0);
                  setInicio(Date.now());
                }}
              >
                {seg ? 'Reiniciar' : 'Iniciar'}
              </Button>
            ) : (
              <Button variant="secondary" icon={<Square className="size-4" />} onClick={() => setInicio(null)}>
                Detener
              </Button>
            )}
          </div>
        </div>
        <Field label="O ingrese el tiempo medido" hint="Minutos:segundos, por ejemplo 3:45">
          <Input value={manual} inputMode="numeric" placeholder="m:ss" onChange={(e) => setManual(e.target.value)} disabled={corriendo} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <Input type="date" value={fecha} max={todayISO()} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Escenario">
            <Select value={escenario} onChange={(e) => setEscenario(e.target.value as EscenarioEmergencia)} options={ESCENARIOS.map((e) => ({ value: e, label: ESCENARIO_LABEL[e] }))} />
          </Field>
          <Field label="Participantes">
            <Input inputMode="numeric" value={participantes} onChange={(e) => setParticipantes(e.target.value)} />
          </Field>
          <Field label="Modalidad">
            <Select value={conAviso ? 'si' : 'no'} onChange={(e) => setConAviso(e.target.value === 'si')} options={[{ value: 'si', label: 'Con aviso' }, { value: 'no', label: 'Sin aviso' }]} />
          </Field>
        </div>
        <Field label="Coordinador" required>
          <Input value={coordinador} onChange={(e) => setCoordinador(e.target.value)} />
        </Field>
        <Field label="Observaciones">
          <TextArea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Mejoras detectadas</p>
          <div className="flex gap-2">
            <Input value={mejora} placeholder="Por ejemplo: salida 2 obstruida con pallets" onChange={(e) => setMejora(e.target.value)} />
            <Button
              variant="secondary"
              disabled={!mejora.trim()}
              onClick={() => {
                setMejoras([...mejoras, mejora.trim()]);
                setMejora('');
              }}
            >
              Agregar
            </Button>
          </div>
          {mejoras.length > 0 && (
            <ul className="mt-2 space-y-1">
              {mejoras.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                  {m}
                  <button type="button" aria-label="Quitar mejora" onClick={() => setMejoras(mejoras.filter((_, j) => j !== i))} className="text-slate-400">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {mejoras.length > 0 && (
            <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={crearHallazgos} onChange={(e) => setCrearHallazgos(e.target.checked)} className="size-5" />
              Crear un hallazgo por cada mejora (plazo 30 días)
            </label>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
// Vista principal
// ------------------------------------------------------------
export default function Emergencias() {
  const { company, can } = useStore();
  const editable = can('editarEmergencias');
  const [editar, setEditar] = useState(false);
  const [simular, setSimular] = useState(false);
  const plan = company.planEmergencia;
  const est = useMemo(() => (plan ? estimarEvacuacion(plan) : null), [plan]);
  const faltan = faltantesPlan(plan);
  const sims = simulacrosOrdenados(company);
  const dias = diasDesdeSimulacro(company);
  const maxBar = est ? Math.max(...est.porZona.map((z) => z.desplazamientoSeg), 1) : 1;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Emergencias y simulacros"
        subtitle="Plan de emergencia, estimación de evacuación y registro de simulacros (DS 44, art. 19)"
        icon={<Siren className="size-6" />}
        actions={
          plan && (
            <Button variant="secondary" icon={<FileDown className="size-4" />} onClick={() => generarPlanEmergencia(company, plan)}>
              PDF
            </Button>
          )
        }
      />
      {!editable && <ReadOnlyNotice text="Su rol puede revisar el plan y los simulacros; los registra el prevencionista." />}

      {!plan ? (
        <EmptyState
          icon={<Siren className="size-8" />}
          title="Aún no hay plan de emergencia"
          text="Defina escenarios, brigada, punto de encuentro, zonas y salidas. La app estima el tiempo de evacuación y lo compara con cada simulacro."
          action={
            editable && (
              <Button icon={<Plus className="size-4" />} onClick={() => setEditar(true)}>
                Crear plan
              </Button>
            )
          }
        />
      ) : (
        <>
          <Card
            title="Plan de emergencia"
            subtitle={`Actualizado el ${formatDate(plan.actualizadoEn)}`}
            actions={
              editable && (
                <Button variant="ghost" size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditar(true)}>
                  Editar
                </Button>
              )
            }
          >
            {faltan.length > 0 && <p className="mb-3 rounded-lg bg-warn/10 p-3 text-sm text-warn">Falta completar: {faltan.join(', ')}.</p>}
            <dl className="grid grid-cols-2 gap-3">
              <KV k="Escenarios">{plan.escenarios.map((e) => ESCENARIO_LABEL[e]).join(', ') || '-'}</KV>
              <KV k="Punto de encuentro">{plan.puntoEncuentro || '-'}</KV>
              <KV k="Brigada">{plan.brigada.filter((b) => b.nombre.trim()).length} de {plan.brigada.length} roles asignados</KV>
              <KV k="Zonas y salidas">
                {plan.zonas.length} {plan.zonas.length === 1 ? 'zona' : 'zonas'} · {plan.salidas.length} {plan.salidas.length === 1 ? 'salida' : 'salidas'}
              </KV>
            </dl>
          </Card>

          {est && (
            <Card title="Estimación de evacuación" subtitle="Referencial: el tiempo real se mide en el simulacro">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Tiempo total estimado</p>
                  <p className="text-4xl font-bold text-navy tabular-nums">{fmtSeg(est.totalSeg)}</p>
                </div>
                <Timer className="size-8 text-slate-300" />
              </div>
              {/* Composición del tiempo */}
              <div className="mt-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label="Composición del tiempo estimado">
                <span className="bg-slate-400" style={{ width: `${(est.alarmaSeg / est.totalSeg) * 100}%` }} />
                <span className="bg-navy" style={{ width: `${(est.desplazamientoSeg / est.totalSeg) * 100}%` }} />
                <span className="bg-warn" style={{ width: `${(est.flujoSeg / est.totalSeg) * 100}%` }} />
              </div>
              <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-3">
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-slate-400" /> Alarma y reacción: {fmtSeg(est.alarmaSeg)}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-navy" /> Desplazamiento ({est.zonaCritica}): {fmtSeg(est.desplazamientoSeg)}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-warn" /> Paso por salidas: {fmtSeg(est.flujoSeg)}
                </li>
              </ul>
              {est.porZona.length > 1 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Desplazamiento por zona</p>
                  {est.porZona.map((z) => (
                    <div key={z.id}>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>
                          {z.nombre} · {z.ocupantes} personas
                        </span>
                        <span className="tabular-nums">{fmtSeg(z.desplazamientoSeg)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div className={cx('h-2 rounded-full', z.nombre === est.zonaCritica ? 'bg-crit' : 'bg-navy')} style={{ width: `${(z.desplazamientoSeg / maxBar) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Modelo simplificado y conservador: alarma + desplazamiento de la zona más lejana a {dec(plan.velocidad)} m/s + paso de {est.ocupantes} personas por {dec(est.anchoEfectivo)} m de ancho efectivo a {dec(FLUJO_ESPECIFICO)} personas por metro por segundo. Sirve para comparar alternativas (por ejemplo, habilitar otra salida); no es un estudio de evacuación.
              </p>
            </Card>
          )}
        </>
      )}

      <Card
        title="Simulacros"
        subtitle={dias === null ? 'Sin simulacros registrados' : `Último ${dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`} · el DS 44 exige al menos uno al año`}
        actions={
          editable &&
          plan && (
            <Button size="sm" icon={<Timer className="size-4" />} onClick={() => setSimular(true)}>
              Registrar simulacro
            </Button>
          )
        }
      >
        {sims.length === 0 ? (
          <p className="text-sm text-slate-500">{plan ? 'Registre el primer simulacro: la app cronometra la evacuación y la compara con lo estimado.' : 'Primero cree el plan de emergencia.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sims.map((s) => {
              const dif = s.tiempoEstimadoSeg !== null ? s.tiempoRealSeg - s.tiempoEstimadoSeg : null;
              return (
                <li key={s.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-navy">
                      {formatDate(s.fecha)} · {ESCENARIO_LABEL[s.escenario]}
                      {!s.conAviso && ' (sin aviso)'}
                    </span>
                    <span className="text-sm text-slate-700 tabular-nums">{fmtSeg(s.tiempoRealSeg)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {s.participantes} participantes · coordinó {s.coordinador}
                    {dif !== null && (
                      <span className={cx('ml-1 font-medium', dif > 0 ? 'text-crit' : 'text-ok')}>
                        · {dif > 0 ? `${fmtSeg(dif)} sobre lo estimado` : `${fmtSeg(-dif)} bajo lo estimado`}
                      </span>
                    )}
                  </p>
                  {s.mejoras.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.mejoras.map((m, i) => (
                        <Badge key={i} tone="warn">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editar && <EditarPlan onClose={() => setEditar(false)} />}
      {simular && <NuevoSimulacro onClose={() => setSimular(false)} />}
    </div>
  );
}
