import { useMemo, useState } from 'react';
import { CalendarCheck, FileDown, Plus, X } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { CompromisoVisita, EstadoCompromiso, Visita } from '../../../types';
import { ESTADO_COMPROMISO_LABEL, compromisosPorRevisar, inicioPeriodo, resumenPeriodo, visitasOrdenadas } from '../../../utils/visitas';
import { generarInformeVisita } from '../../../utils/pdfGenerator';
import { addDays, formatDate, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { Badge, Button, Card, EmptyState, Field, Input, KV, Modal, PageHeader, ReadOnlyNotice, TextArea, cx, type Tone } from '../../ui';
import SignaturePad from '../../ui/SignaturePad';

const ESTADO_TONE: Record<EstadoCompromiso, Tone> = { pendiente: 'warn', cumplido: 'ok', no_cumplido: 'crit' };
const horaActual = () => new Date().toTimeString().slice(0, 5);

function NuevaVisita({ onClose }: { onClose: () => void }) {
  const { company, state, updateCompany, notify } = useStore();
  const hoy = todayISO();
  const [fecha, setFecha] = useState(hoy);
  const [horaInicio, setHoraInicio] = useState(horaActual());
  const [horaFin, setHoraFin] = useState('');
  const [recibidoPor, setRecibidoPor] = useState(company.empresa.representanteLegal);
  const [cargoRecibe, setCargoRecibe] = useState('Representante legal');
  const [actividades, setActividades] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [revision, setRevision] = useState<CompromisoVisita[]>(() => compromisosPorRevisar(company, hoy));
  const [compromisos, setCompromisos] = useState<CompromisoVisita[]>([]);
  const [firmaPrev, setFirmaPrev] = useState('');
  const [firmaRecibe, setFirmaRecibe] = useState('');

  const desde = inicioPeriodo(company, fecha);
  const resumen = useMemo(() => resumenPeriodo(company, desde, fecha), [company, desde, fecha]);

  const agregar = () => setCompromisos((cs) => [...cs, { id: uid('cmp-'), descripcion: '', responsable: '', plazo: addDays(fecha, 30), estado: 'pendiente' }]);
  const editar = (id: string, patch: Partial<CompromisoVisita>) => setCompromisos((cs) => cs.map((k) => (k.id === id ? { ...k, ...patch } : k)));

  const validos = compromisos.filter((k) => k.descripcion.trim());
  const listo = recibidoPor.trim() && firmaPrev && firmaRecibe;

  const guardar = () => {
    const visita: Visita = {
      id: uid('vis-'),
      fecha,
      horaInicio,
      horaFin: horaFin || horaActual(),
      prevencionista: state.usuario || company.empresa.prevencionista,
      recibidoPor: recibidoPor.trim(),
      cargoRecibe: cargoRecibe.trim(),
      actividades: actividades.trim(),
      observaciones: observaciones.trim(),
      resumen,
      revisionAnterior: revision,
      compromisos: validos.map((k) => ({ ...k, descripcion: k.descripcion.trim(), responsable: k.responsable.trim() })),
      firmaPrevencionista: firmaPrev,
      firmaRecibe,
      creadoEn: new Date().toISOString(),
    };
    const estados = new Map(revision.map((k) => [k.id, k.estado]));
    updateCompany((c) => ({
      ...c,
      // Los compromisos revisados quedan actualizados también en la visita en que se acordaron
      visitas: [...(c.visitas ?? []).map((v) => ({ ...v, compromisos: v.compromisos.map((k) => (estados.has(k.id) ? { ...k, estado: estados.get(k.id)! } : k)) })), visita],
    }));
    notify('Visita registrada');
    onClose();
  };

  return (
    <Modal
      title="Nueva visita en terreno"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!listo}>
            Guardar visita
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Fecha" className="col-span-3 sm:col-span-1">
            <Input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Inicio">
            <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </Field>
          <Field label="Término" hint="Vacío: hora de guardado">
            <Input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Resumen automático del período · {formatDate(resumen.desde)} al {formatDate(resumen.hasta)}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KV k="DS 44">{resumen.ds44}%</KV>
            <KV k="Charlas">
              {resumen.charlas} ({resumen.asistencias} asist.)
            </KV>
            <KV k="Inspecciones">{resumen.inspecciones}</KV>
            <KV k="Hallazgos abiertos">
              {resumen.hallazgosAbiertos}
              {resumen.hallazgosVencidos ? ` (${resumen.hallazgosVencidos} vencidos)` : ''}
            </KV>
            <KV k="Hallazgos nuevos">{resumen.hallazgosNuevos}</KV>
            <KV k="Hallazgos cerrados">{resumen.hallazgosCerrados}</KV>
            <KV k="Incidentes">{resumen.incidentes}</KV>
            <KV k="Accidentes CTP">{resumen.accidentesCTP}</KV>
          </dl>
          <p className="mt-2 text-xs text-slate-500">Se calcula con los registros de la app entre la visita anterior y esta.</p>
        </div>

        <Field label="Actividades realizadas en la visita" hint="Por ejemplo: recorrido por bodega, charla de orden y aseo, revisión de extintores.">
          <TextArea rows={4} value={actividades} onChange={(e) => setActividades(e.target.value)} />
        </Field>

        {revision.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Compromisos de la visita anterior</p>
            <ul className="space-y-2">
              {revision.map((k) => (
                <li key={k.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm text-slate-800">{k.descripcion}</p>
                  <p className="text-xs text-slate-500">
                    {k.responsable || 'Sin responsable'} · plazo {formatDate(k.plazo)}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(['cumplido', 'no_cumplido', 'pendiente'] as EstadoCompromiso[]).map((e) => (
                      <button
                        key={e}
                        type="button"
                        aria-pressed={k.estado === e}
                        onClick={() => setRevision((rs) => rs.map((x) => (x.id === k.id ? { ...x, estado: e } : x)))}
                        className={cx(
                          'min-h-11 rounded-md border-2 px-2 text-xs font-semibold',
                          k.estado === e ? (e === 'cumplido' ? 'border-ok bg-ok/10 text-ok' : e === 'no_cumplido' ? 'border-crit bg-crit/10 text-crit' : 'border-warn bg-warn/10 text-warn') : 'border-slate-200 text-slate-600',
                        )}
                      >
                        {ESTADO_COMPROMISO_LABEL[e]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Compromisos acordados</p>
            <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={agregar}>
              Agregar
            </Button>
          </div>
          {compromisos.length === 0 && <p className="text-xs text-slate-500">Agregue las tareas que el cliente se compromete a cumplir antes de la próxima visita.</p>}
          <ul className="space-y-2">
            {compromisos.map((k) => (
              <li key={k.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex gap-2">
                  <Input value={k.descripcion} onChange={(e) => editar(k.id, { descripcion: e.target.value })} placeholder="Compromiso" aria-label="Descripción del compromiso" />
                  <Button variant="ghost" size="sm" aria-label="Quitar compromiso" onClick={() => setCompromisos((cs) => cs.filter((x) => x.id !== k.id))}>
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={k.responsable} onChange={(e) => editar(k.id, { responsable: e.target.value })} placeholder="Responsable" aria-label="Responsable" />
                  <Input type="date" value={k.plazo} onChange={(e) => editar(k.id, { plazo: e.target.value })} aria-label="Plazo" />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Field label="Observaciones">
          <TextArea rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Recibido por" required>
            <Input value={recibidoPor} onChange={(e) => setRecibidoPor(e.target.value)} />
          </Field>
          <Field label="Cargo">
            <Input value={cargoRecibe} onChange={(e) => setCargoRecibe(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SignaturePad label="Firma del prevencionista" value={firmaPrev} onChange={setFirmaPrev} />
          <SignaturePad label="Firma de quien recibe" value={firmaRecibe} onChange={setFirmaRecibe} />
        </div>
        {!listo && <p className="text-xs text-slate-500">Para guardar se necesitan el nombre de quien recibe y las dos firmas.</p>}
      </div>
    </Modal>
  );
}

export default function Visitas() {
  const { company, can, notify } = useStore();
  const [nueva, setNueva] = useState(false);
  const visitas = visitasOrdenadas(company);
  const pendientes = visitas.flatMap((v) => v.compromisos).filter((k) => k.estado === 'pendiente');
  const vencidos = pendientes.filter((k) => k.plazo < todayISO()).length;
  const editable = can('editarVisitas');

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Visitas"
        subtitle={`Registre cada visita a ${company.empresa.nombre} y entregue el informe firmado`}
        icon={<CalendarCheck className="size-6" />}
        actions={
          editable && (
            <Button icon={<Plus className="size-4" />} onClick={() => setNueva(true)}>
              Nueva visita
            </Button>
          )
        }
      />
      {!editable && <ReadOnlyNotice text="Su rol puede ver y descargar los informes; las visitas las registra el prevencionista." />}

      {pendientes.length > 0 && (
        <Card>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-navy">{pendientes.length}</span> {pendientes.length === 1 ? 'compromiso pendiente' : 'compromisos pendientes'} del cliente
            {vencidos ? <span className="text-crit"> · {vencidos} con plazo vencido</span> : null}. Se revisan en la próxima visita.
          </p>
        </Card>
      )}

      {visitas.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="size-8" />} title="Sin visitas registradas" text="Registre su primera visita: la app arma el resumen del período y el informe PDF para el cliente." />
      ) : (
        <div className="space-y-3">
          {visitas.map((v, i) => {
            const anterior = visitas[i + 1];
            const ds44Anterior = anterior ? anterior.resumen.ds44 : null;
            const cumplidos = v.revisionAnterior.filter((k) => k.estado === 'cumplido').length;
            return (
              <Card key={v.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-navy">{formatDate(v.fecha)}</p>
                    <p className="text-xs text-slate-500">
                      {v.horaInicio} a {v.horaFin} · recibió {v.recibidoPor}
                    </p>
                  </div>
                  <Badge tone={v.resumen.ds44 >= 90 ? 'ok' : v.resumen.ds44 >= 60 ? 'warn' : 'crit'}>
                    DS 44 {v.resumen.ds44}%{ds44Anterior !== null && v.resumen.ds44 !== ds44Anterior ? ` (${v.resumen.ds44 > ds44Anterior ? '+' : ''}${v.resumen.ds44 - ds44Anterior})` : ''}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {v.resumen.charlas} {v.resumen.charlas === 1 ? 'charla' : 'charlas'} · {v.resumen.hallazgosAbiertos} {v.resumen.hallazgosAbiertos === 1 ? 'hallazgo abierto' : 'hallazgos abiertos'} · {v.compromisos.length} {v.compromisos.length === 1 ? 'compromiso nuevo' : 'compromisos nuevos'}
                  {v.revisionAnterior.length ? ` · ${cumplidos} de ${v.revisionAnterior.length} anteriores cumplidos` : ''}
                </p>
                {v.compromisos.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {v.compromisos.map((k) => (
                      <li key={k.id}>
                        <Badge tone={ESTADO_TONE[k.estado]}>{k.descripcion.length > 40 ? `${k.descripcion.slice(0, 39)}…` : k.descripcion}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<FileDown className="size-4" />}
                    onClick={() => {
                      generarInformeVisita(company, v, ds44Anterior);
                      notify('Informe de visita descargado');
                    }}
                  >
                    Informe PDF
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {nueva && <NuevaVisita onClose={() => setNueva(false)} />}
    </div>
  );
}
