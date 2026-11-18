import { useMemo, useState } from 'react';
import { ArrowRight, History, CheckCircle2, ChevronDown, FileDown, Info, Scale, XCircle, MinusCircle, CircleDashed } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { EstadoFuf } from '../../../types';
import { TAMANO_DEDUCIDO, TAMANO_LABEL } from '../../../data/fufDs44';
import {
  ESTADO_LABEL,
  NIVEL_EVIDENCIA_LABEL,
  dotacionEmpresa,
  evaluarFuf,
  nivelPreparacion,
  resumenPorBloque,
  type EstadoCumplimiento,
  type FilaFuf,
  type NivelEvidencia,
} from '../../../utils/cumplimientoDs44';
import { generarInformeCumplimientoDS44 } from '../../../utils/pdfGenerator';
import { formatDate, todayISO } from '../../../utils/date';
import type { CorteFuf } from '../../../types';
import { Badge, Button, Card, CountUp, Field, Modal, PageHeader, ProgressBar, ProgressRing, ReadOnlyNotice, Select, Stat, StatGrid, TextArea, cx, type Tone } from '../../ui';
import { NAV } from '../../layout/nav';

const ESTADO_TONE: Record<EstadoCumplimiento, Tone> = { cumple: 'ok', no_cumple: 'crit', na: 'neutral', pendiente: 'warn' };
const EVIDENCIA_TONE: Record<NivelEvidencia, Tone> = { completa: 'ok', parcial: 'warn', ninguna: 'neutral', manual: 'neutral', sin_modulo: 'neutral' };

type Filtro = 'todos' | 'pendiente' | 'no_cumple' | 'cumple' | 'sancion' | 'con_evidencia';
const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos los ítems' },
  { value: 'pendiente', label: 'Pendientes de evaluar' },
  { value: 'no_cumple', label: 'No cumple' },
  { value: 'cumple', label: 'Cumple' },
  { value: 'sancion', label: 'Materias más sancionadas' },
  { value: 'con_evidencia', label: 'Con evidencia en la app' },
];

const OPCIONES: { estado: EstadoFuf; label: string; icon: typeof CheckCircle2; activo: string }[] = [
  { estado: 'cumple', label: 'Cumple', icon: CheckCircle2, activo: 'border-ok bg-ok/10 text-ok' },
  { estado: 'no_cumple', label: 'No cumple', icon: XCircle, activo: 'border-crit bg-crit/10 text-crit' },
  { estado: 'na', label: 'No aplica', icon: MinusCircle, activo: 'border-slate-500 bg-slate-100 text-slate-700' },
];

function EvaluarItem({ fila, onClose }: { fila: FilaFuf; onClose: () => void }) {
  const { state, updateCompany, notify, navigate, can } = useStore();
  const editable = can('editarCumplimiento');
  const [estado, setEstado] = useState<EstadoFuf | null>(fila.respuesta?.estado ?? null);
  const [obs, setObs] = useState(fila.respuesta?.observacion ?? '');
  const { item, evidencia } = fila;

  const guardar = () => {
    if (!estado) return;
    updateCompany((c) => ({
      ...c,
      cumplimientoFuf: {
        ...(c.cumplimientoFuf ?? {}),
        [String(item.n)]: { estado, observacion: obs.trim(), actualizadoEn: new Date().toISOString(), actualizadoPor: state.usuario },
      },
    }));
    notify(`Ítem ${item.n} actualizado`);
    onClose();
  };

  const limpiar = () => {
    updateCompany((c) => {
      const resto = { ...(c.cumplimientoFuf ?? {}) };
      delete resto[String(item.n)];
      return { ...c, cumplimientoFuf: resto };
    });
    notify(`Ítem ${item.n} vuelve a pendiente`);
    onClose();
  };

  return (
    <Modal
      title={`Ítem ${item.n} del FUF`}
      onClose={onClose}
      size="lg"
      footer={
        editable ? (
          <>
            {fila.respuesta && (
              <Button variant="ghost" onClick={limpiar}>
                Volver a pendiente
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={!estado}>
              Guardar
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
        <div>
          <p className="text-sm font-semibold text-navy">{item.texto}</p>
          <p className="mt-1 text-xs text-slate-500">
            DS 44/2024 · {item.articulo}
            {item.tamano && ` · aplica a ${TAMANO_LABEL[item.tamano]}${TAMANO_DEDUCIDO.has(item.n) ? ' (condición deducida del decreto; el formulario no la indica)' : ''}`}
          </p>
          {item.sancion && (
            <div className="mt-2">
              <Badge tone="warn">Materia más sancionada por la DT</Badge>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Evidencia que pide el formulario</p>
          <p className="mt-1 text-slate-700">{item.evidencia}</p>
        </div>

        <div className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Lo que la app puede mostrar</p>
            <Badge tone={EVIDENCIA_TONE[evidencia.nivel]}>{NIVEL_EVIDENCIA_LABEL[evidencia.nivel]}</Badge>
          </div>
          <p className="mt-1 text-slate-700">{evidencia.resumen}</p>
          {evidencia.vista && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 -ml-3"
              icon={<ArrowRight className="size-4" />}
              onClick={() => {
                onClose();
                navigate(evidencia.vista!);
              }}
            >
              Abrir {NAV[evidencia.vista].short}
            </Button>
          )}
          <p className="mt-2 text-xs text-slate-500">La aplicación sugiere evidencia, pero no decide el cumplimiento: lo confirma usted.</p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Su evaluación</p>
          <div className="grid grid-cols-3 gap-2">
            {OPCIONES.map((o) => {
              const Icon = o.icon;
              const activo = estado === o.estado;
              return (
                <button
                  key={o.estado}
                  type="button"
                  disabled={!editable}
                  onClick={() => setEstado(o.estado)}
                  aria-pressed={activo}
                  className={cx(
                    'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 text-xs font-semibold transition-colors disabled:opacity-60',
                    activo ? o.activo : 'border-slate-200 text-slate-600 hover:border-slate-300',
                  )}
                >
                  <Icon className="size-5" />
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Observación o ubicación de la evidencia" hint="Por ejemplo: carpeta física, nombre del documento o fecha del acta.">
          <TextArea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} disabled={!editable} />
        </Field>

        {fila.respuesta && (
          <p className="text-xs text-slate-500">
            Última actualización: {formatDate(fila.respuesta.actualizadoEn.slice(0, 10))} por {fila.respuesta.actualizadoPor || 'sin nombre'}.
          </p>
        )}
      </div>
    </Modal>
  );
}

function FilaItem({ fila, onOpen }: { fila: FilaFuf; onOpen: () => void }) {
  const { item, evidencia } = fila;
  const Icon = fila.estado === 'cumple' ? CheckCircle2 : fila.estado === 'no_cumple' ? XCircle : fila.estado === 'na' ? MinusCircle : CircleDashed;
  const color = { ok: 'text-ok', crit: 'text-crit', neutral: 'text-slate-400', warn: 'text-warn', info: 'text-slate-500', dark: 'text-navy' }[ESTADO_TONE[fila.estado]];
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 border-t border-slate-100 px-3 py-3 text-left transition-colors first:border-t-0 hover:bg-slate-50">
      <Icon className={cx('mt-0.5 size-5 shrink-0', color)} aria-label={ESTADO_LABEL[fila.estado]} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-800">
          <span className="font-semibold text-navy tabular-nums">{item.n}.</span> {item.texto}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">{item.articulo}</span>
          {item.sancion && <Badge tone="warn">Más sancionada</Badge>}
          {item.tamano && !fila.aplicaPorTamano && <Badge tone="neutral">No aplica por tamaño</Badge>}
          {(evidencia.nivel === 'completa' || evidencia.nivel === 'parcial') && <Badge tone={EVIDENCIA_TONE[evidencia.nivel]}>{NIVEL_EVIDENCIA_LABEL[evidencia.nivel]}</Badge>}
        </span>
      </span>
    </button>
  );
}

const MAX_CORTES = 24;

function HistorialCortes({ resumen, dotacion }: { resumen: ReturnType<typeof evaluarFuf>['resumen']; dotacion: number }) {
  const { company, state, updateCompany, notify, can } = useStore();
  const cortes = company.historialFuf ?? [];
  const hoy = todayISO();
  const hayHoy = cortes.some((c) => c.fecha === hoy);

  const guardar = () => {
    const corte: CorteFuf = {
      id: `fuf-${hoy}-${Date.now()}`,
      fecha: hoy,
      porcentaje: resumen.porcentaje,
      cumple: resumen.cumple,
      noCumple: resumen.noCumple,
      pendiente: resumen.pendiente,
      aplicables: resumen.aplicables,
      dotacion,
      creadoPor: state.usuario,
    };
    // Un solo corte por día: el de hoy reemplaza al anterior del mismo día
    updateCompany((c) => ({ ...c, historialFuf: [...(c.historialFuf ?? []).filter((x) => x.fecha !== hoy), corte].slice(-MAX_CORTES) }));
    notify(hayHoy ? 'Corte de hoy actualizado' : 'Corte guardado');
  };

  const filas = [...cortes].reverse();
  return (
    <Card
      title="Historial de cortes"
      subtitle="Foto fechada de su autoevaluación"
      actions={
        can('editarCumplimiento') && (
          <Button variant="secondary" size="sm" icon={<History className="size-4" />} onClick={guardar}>
            {hayHoy ? 'Actualizar corte de hoy' : 'Guardar corte'}
          </Button>
        )
      }
    >
      {filas.length === 0 ? (
        <p className="text-sm text-slate-500">Aún no hay cortes. Guarde uno cuando termine una revisión para poder comparar el avance más adelante.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filas.map((c, i) => {
            const anterior = filas[i + 1];
            const delta = anterior ? c.porcentaje - anterior.porcentaje : null;
            return (
              <li key={c.id} className="py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-navy">{formatDate(c.fecha)}</span>
                  <span className="text-sm tabular-nums text-slate-700">
                    {c.porcentaje}%
                    {delta !== null && delta !== 0 && <span className={cx('ml-2 text-xs font-medium', delta > 0 ? 'text-ok' : 'text-crit')}>{delta > 0 ? `+${delta}` : delta} pts</span>}
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={c.porcentaje} tone={c.porcentaje >= 90 ? 'ok' : c.porcentaje >= 60 ? 'warn' : 'crit'} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {c.cumple} de {c.aplicables} cumple · {c.noCumple} no cumple · {c.pendiente} pendientes · dotación {c.dotacion}
                  {c.creadoPor ? ` · ${c.creadoPor}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function Cumplimiento() {
  const { company, can, notify } = useStore();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [abierto, setAbierto] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<number | null>(null);

  const { filas, resumen } = useMemo(() => evaluarFuf(company), [company]);
  const bloques = useMemo(() => resumenPorBloque(filas), [filas]);
  const nivel = nivelPreparacion(resumen);
  const trabajadores = dotacionEmpresa(company);

  const pasa = (f: FilaFuf) => {
    switch (filtro) {
      case 'pendiente':
        return f.estado === 'pendiente';
      case 'no_cumple':
        return f.estado === 'no_cumple';
      case 'cumple':
        return f.estado === 'cumple';
      case 'sancion':
        return !!f.item.sancion;
      case 'con_evidencia':
        return f.evidencia.nivel === 'completa' || f.evidencia.nivel === 'parcial';
      default:
        return true;
    }
  };

  const filaSel = sel !== null ? filas.find((f) => f.item.n === sel) : undefined;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Cumplimiento DS 44"
        subtitle="Revise los 60 ítems que pide el fiscalizador y vea qué falta"
        actions={
          can('exportarActas') && (
            <Button
              variant="secondary"
              icon={<FileDown className="size-4" />}
              onClick={() => {
                generarInformeCumplimientoDS44(company);
                notify('Informe de autoevaluación DS 44 descargado');
              }}
            >
              Informe PDF
            </Button>
          )
        }
      />

      {!can('editarCumplimiento') && <ReadOnlyNotice text="Su rol puede consultar la autoevaluación, pero solo el prevencionista la modifica." />}

      <Card className="rise">
        <div className="flex items-center gap-4">
          <ProgressRing value={resumen.cumple + resumen.noCumple === 0 ? 0 : resumen.porcentaje} size={104} stroke={10} tone={resumen.cumple + resumen.noCumple === 0 ? 'neutral' : nivel.tone === 'ok' ? 'ok' : nivel.tone === 'warn' ? 'warn' : 'crit'} label="Preparación para fiscalización">
            {resumen.cumple + resumen.noCumple === 0 ? (
              <span className="px-3 text-xs leading-tight font-semibold text-slate-500">Sin evaluar</span>
            ) : (
              <span className="text-2xl font-bold text-navy tabular-nums">
                <CountUp value={resumen.porcentaje} suffix="%" />
              </span>
            )}
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Preparación para fiscalización</p>
            {resumen.cumple + resumen.noCumple === 0 ? (
              <p className="mt-1 text-sm text-slate-600">Abra un bloque y marque cada ítem; la app le muestra la evidencia que ya tiene.</p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                {resumen.cumple} de {resumen.aplicables} ítems aplicables confirmados como «cumple»
              </p>
            )}
            <div className="mt-2">
              <Badge tone={nivel.tone}>{nivel.label}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <StatGrid>
        <Stat label="No cumple" value={resumen.noCumple} hint={resumen.sancionadosNoCumple ? `${resumen.sancionadosNoCumple} entre los más sancionados` : 'Ninguno de los más sancionados'} tone={resumen.noCumple ? 'crit' : 'ok'} />
        <Stat label="Pendientes" value={resumen.pendiente} hint="Sin evaluar" tone={resumen.pendiente ? 'warn' : 'ok'} />
        <Stat label="Con evidencia en la app" value={resumen.conEvidencia} hint="Para confirmar" tone="neutral" />
        <Stat label="No aplican" value={resumen.na} hint={`Dotación: ${trabajadores}`} tone="neutral" />
      </StatGrid>

      <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
        <p>
          Autoevaluación interna según el FUF del DS 44/2024; no reemplaza una fiscalización. Los ítems por tamaño de empresa usan una dotación de {trabajadores} trabajadores (el mayor valor entre el registro de personal y los indicadores).
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Field label="Mostrar">
            <Select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} options={FILTROS} />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        {bloques.map((b) => {
          const visibles = b.filas.filter(pasa);
          if (!visibles.length) return null;
          const abiertoBloque = filtro !== 'todos' || abierto[b.id];
          const tone: Tone = b.noCumple ? 'crit' : b.pendiente ? 'warn' : b.aplicables ? 'ok' : 'neutral';
          return (
            <Card key={b.id} className="overflow-hidden" bodyClass="p-0!">
              <button
                type="button"
                onClick={() => setAbierto((a) => ({ ...a, [b.id]: !a[b.id] }))}
                aria-expanded={!!abiertoBloque}
                className="flex w-full items-center gap-3 px-3 py-3 text-left"
              >
                <Scale className="size-5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-navy">{b.titulo}</span>
                  <span className="mt-1.5 block">
                    <ProgressBar value={b.porcentaje} tone={tone} />
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                  {b.cumple}/{b.aplicables}
                </span>
                <ChevronDown className={cx('size-4 shrink-0 text-slate-400 transition-transform', abiertoBloque && 'rotate-180')} />
              </button>
              {abiertoBloque && (
                <div className="border-t border-slate-100">
                  {visibles.map((f) => (
                    <FilaItem key={f.item.n} fila={f} onOpen={() => setSel(f.item.n)} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        {!filas.some(pasa) && <p className="py-8 text-center text-sm text-slate-500">No hay ítems con este filtro.</p>}
      </div>

      <HistorialCortes resumen={resumen} dotacion={trabajadores} />

      {filaSel && <EvaluarItem fila={filaSel} onClose={() => setSel(null)} />}
    </div>
  );
}
