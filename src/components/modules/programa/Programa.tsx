import { useMemo, useState } from 'react';
import { CheckCircle2, FileDown, ListChecks, Plus, RefreshCw, Send, ShieldCheck, Users } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { ActividadPrograma, EstadoActividad, OrigenActividad } from '../../../types';
import { ESTADO_ACTIVIDAD_LABEL, ORIGEN_LABEL, ORIGEN_ORDEN, actualizarDesdeMiper, avancePrograma, generarPrograma, programaDesfasado } from '../../../utils/programa';
import { dotacionEmpresa } from '../../../utils/cumplimientoDs44';
import { generarProgramaTrabajo } from '../../../utils/pdfGenerator';
import { formatDate, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, ProgressBar, ReadOnlyNotice, Select, TextArea, cx, type Tone } from '../../ui';
import SignaturePad from '../../ui/SignaturePad';

const ESTADO_TONE: Record<EstadoActividad, Tone> = { pendiente: 'neutral', en_curso: 'warn', realizada: 'ok' };
const NIVEL_TONE: Record<string, Tone> = { Intolerable: 'crit', Importante: 'crit', Moderado: 'warn', Tolerable: 'ok' };

function EditarActividad({ actividad, nueva, onClose }: { actividad: ActividadPrograma; nueva?: boolean; onClose: () => void }) {
  const { updateCompany, notify, can } = useStore();
  const editable = can('editarPrograma');
  const [a, setA] = useState(actividad);

  const guardar = () => {
    const fechaRealizada = a.estado === 'realizada' ? a.fechaRealizada || todayISO() : undefined;
    const final = { ...a, descripcion: a.descripcion.trim(), responsable: a.responsable.trim(), fechaRealizada };
    updateCompany((c) => {
      if (!c.programa) return c;
      const acts = nueva ? [...c.programa.actividades, final] : c.programa.actividades.map((x) => (x.id === final.id ? final : x));
      const modificaciones = nueva ? [...c.programa.modificaciones, { fecha: todayISO(), motivo: `Actividad agregada: ${final.descripcion}` }] : c.programa.modificaciones;
      return { ...c, programa: { ...c.programa, actividades: acts, modificaciones } };
    });
    notify(nueva ? 'Actividad agregada' : 'Actividad actualizada');
    onClose();
  };

  return (
    <Modal
      title={nueva ? 'Nueva actividad' : 'Actividad del programa'}
      onClose={onClose}
      footer={
        editable ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={!a.descripcion.trim() || !a.responsable.trim() || !a.plazo}>
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
        {a.nivel && (
          <div className="flex flex-wrap gap-2">
            <Badge tone={NIVEL_TONE[a.nivel]}>Riesgo {a.nivel}</Badge>
            <Badge tone="neutral">{ORIGEN_LABEL[a.origen]}</Badge>
          </div>
        )}
        <Field label="Actividad o medida" required>
          <TextArea rows={3} value={a.descripcion} onChange={(e) => setA({ ...a, descripcion: e.target.value })} disabled={!editable} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsable" required>
            <Input value={a.responsable} onChange={(e) => setA({ ...a, responsable: e.target.value })} disabled={!editable} />
          </Field>
          <Field label="Plazo" required>
            <Input type="date" value={a.plazo} onChange={(e) => setA({ ...a, plazo: e.target.value })} disabled={!editable} />
          </Field>
        </div>
        <Field label="Estado">
          <div className="grid grid-cols-3 gap-2">
            {(['pendiente', 'en_curso', 'realizada'] as EstadoActividad[]).map((e) => (
              <button
                key={e}
                type="button"
                disabled={!editable}
                aria-pressed={a.estado === e}
                onClick={() => setA({ ...a, estado: e })}
                className={cx(
                  'min-h-11 rounded-md border-2 px-2 text-xs font-semibold disabled:opacity-60',
                  a.estado === e ? (e === 'realizada' ? 'border-ok bg-ok/10 text-ok' : e === 'en_curso' ? 'border-warn bg-warn/10 text-warn' : 'border-navy bg-slate-100 text-navy') : 'border-slate-200 text-slate-600',
                )}
              >
                {ESTADO_ACTIVIDAD_LABEL[e]}
              </button>
            ))}
          </div>
        </Field>
        {a.estado === 'realizada' && (
          <Field label="Fecha de realización">
            <Input type="date" value={a.fechaRealizada || todayISO()} onChange={(e) => setA({ ...a, fechaRealizada: e.target.value })} disabled={!editable} />
          </Field>
        )}
        <Field label="Medio de verificación" hint="Por ejemplo: acta de charla, factura de compra, fotografía, registro de capacitación.">
          <Input value={a.verificacion} onChange={(e) => setA({ ...a, verificacion: e.target.value })} disabled={!editable} />
        </Field>
      </div>
    </Modal>
  );
}

function Aprobar({ onClose }: { onClose: () => void }) {
  const { company, updateCompany, notify } = useStore();
  const [nombre, setNombre] = useState(company.empresa.representanteLegal);
  const [cargo, setCargo] = useState('Representante legal');
  const [firma, setFirma] = useState('');
  return (
    <Modal
      title="Aprobación del programa"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!nombre.trim() || !firma}
            onClick={() => {
              updateCompany((c) => (c.programa ? { ...c, programa: { ...c.programa, aprobadoPor: nombre.trim(), cargoAprueba: cargo.trim(), aprobadoEn: todayISO(), firmaAprobacion: firma } } : c));
              notify('Programa aprobado');
              onClose();
            }}
          >
            Registrar aprobación
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">El DS 44 exige que el programa conste por escrito y sea aprobado por el representante legal de la empresa.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" required>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Field>
          <Field label="Cargo">
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </Field>
        </div>
        <SignaturePad label="Firma de aprobación" value={firma} onChange={setFirma} />
      </div>
    </Modal>
  );
}

export default function Programa() {
  const { company, updateCompany, notify, can } = useStore();
  const editable = can('editarPrograma');
  const pr = company.programa;
  const av = avancePrograma(pr);
  const desfasado = programaDesfasado(company);
  const comite = dotacionEmpresa(company) > 25;
  const [sel, setSel] = useState<{ a: ActividadPrograma; nueva?: boolean } | null>(null);
  const [aprobar, setAprobar] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'pendientes' | 'vencidas'>('todas');
  const hoy = todayISO();

  const grupos = useMemo(() => {
    if (!pr) return [];
    const pasa = (a: ActividadPrograma) => (filtro === 'pendientes' ? a.estado !== 'realizada' : filtro === 'vencidas' ? a.estado !== 'realizada' && a.plazo < hoy : true);
    return ORIGEN_ORDEN.map((o) => ({ origen: o, acts: pr.actividades.filter((a) => a.origen === o && pasa(a)) })).filter((g) => g.acts.length);
  }, [pr, filtro, hoy]);

  if (!pr) {
    return (
      <div className="space-y-4">
        <PageHeader title="Programa de trabajo" subtitle="Convierta la matriz de riesgos en un plan anual con plazos y responsables" icon={<ListChecks className="size-6" />} />
        <EmptyState
          icon={<ListChecks className="size-8" />}
          title="Aún no hay programa de trabajo"
          text={
            company.iper.length
              ? `La app puede armarlo desde los ${company.iper.length} riesgos de la MIPER: cada medida de control pasa a ser una actividad con responsable y plazo según el nivel de riesgo, y se agregan las actividades de capacitación, emergencias y promoción que exige el DS 44.`
              : 'Primero registre los riesgos en la Matriz IPER; el programa se genera a partir de ella.'
          }
          action={
            editable &&
            company.iper.length > 0 && (
              <Button
                icon={<ListChecks className="size-4" />}
                onClick={() => {
                  updateCompany((c) => ({ ...c, programa: generarPrograma(c) }));
                  notify('Programa generado desde la MIPER');
                }}
              >
                Generar desde la MIPER
              </Button>
            )
          }
        />
      </div>
    );
  }

  const marcar = (campo: 'difundidoEn' | 'enviadoComiteEn', msg: string) => {
    updateCompany((c) => (c.programa ? { ...c, programa: { ...c.programa, [campo]: todayISO() } } : c));
    notify(msg);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={`Programa de trabajo ${pr.anio}`}
        subtitle={`Elaborado el ${formatDate(pr.elaboradoEn)} desde la MIPER${pr.miperBase ? ` revisada el ${formatDate(pr.miperBase)}` : ''}`}
        icon={<ListChecks className="size-6" />}
        actions={
          <Button variant="secondary" icon={<FileDown className="size-4" />} onClick={() => generarProgramaTrabajo(company, pr)}>
            PDF
          </Button>
        }
      />
      {!editable && <ReadOnlyNotice text="Su rol puede revisar el programa; lo administra el prevencionista." />}

      {desfasado && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-warn">La MIPER se revisó después de elaborar el programa. El DS 44 pide actualizarlo dentro de 30 días.</p>
            {editable && (
              <Button
                size="sm"
                icon={<RefreshCw className="size-4" />}
                onClick={() => {
                  const { programa, agregadas } = actualizarDesdeMiper(company, pr);
                  updateCompany((c) => ({ ...c, programa }));
                  notify(agregadas ? `${agregadas} ${agregadas === 1 ? 'medida nueva agregada' : 'medidas nuevas agregadas'}` : 'Sin medidas nuevas; base actualizada');
                }}
              >
                Actualizar desde la MIPER
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Avance del programa</p>
            <p className="mt-1 text-4xl font-bold text-navy tabular-nums">{av.porcentaje}%</p>
            <p className="text-xs text-slate-500">
              {av.realizadas} de {av.total} actividades realizadas
            </p>
          </div>
          {av.vencidas > 0 && <Badge tone="crit">{av.vencidas} vencidas</Badge>}
        </div>
        <div className="mt-3">
          <ProgressBar value={av.porcentaje} tone={av.vencidas ? 'warn' : 'ok'} />
        </div>
      </Card>

      <Card title="Requisitos formales (art. 8)">
        <ul className="space-y-2.5 text-sm">
          {[
            { ok: !!pr.aprobadoEn, label: 'Aprobado por el representante legal', detalle: pr.aprobadoEn ? `${pr.aprobadoPor} · ${formatDate(pr.aprobadoEn)}` : 'Pendiente' },
            { ok: !!pr.difundidoEn, label: 'Difundido a los trabajadores', detalle: pr.difundidoEn ? formatDate(pr.difundidoEn) : 'Pendiente' },
            ...(comite ? [{ ok: !!pr.enviadoComiteEn, label: 'Copia enviada al comité paritario', detalle: pr.enviadoComiteEn ? formatDate(pr.enviadoComiteEn) : 'Pendiente' }] : []),
          ].map((r) => (
            <li key={r.label} className="flex items-start gap-2">
              <CheckCircle2 className={cx('mt-0.5 size-5 shrink-0', r.ok ? 'text-ok' : 'text-slate-300')} />
              <span>
                <span className="block text-slate-800">{r.label}</span>
                <span className={cx('text-xs', r.ok ? 'text-slate-500' : 'text-warn')}>{r.detalle}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {editable && (
        <div className="flex flex-wrap gap-2">
          {!pr.aprobadoEn && (
            <Button size="sm" icon={<ShieldCheck className="size-4" />} onClick={() => setAprobar(true)}>
              Registrar aprobación
            </Button>
          )}
          {!pr.difundidoEn && (
            <Button size="sm" variant="secondary" icon={<Users className="size-4" />} onClick={() => marcar('difundidoEn', 'Difusión registrada')}>
              Marcar difundido
            </Button>
          )}
          {comite && !pr.enviadoComiteEn && (
            <Button size="sm" variant="secondary" icon={<Send className="size-4" />} onClick={() => marcar('enviadoComiteEn', 'Envío al comité registrado')}>
              Marcar enviado al comité
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus className="size-4" />}
            onClick={() => setSel({ nueva: true, a: { id: uid('act-'), origen: 'manual' as OrigenActividad, descripcion: '', responsable: company.empresa.prevencionista, plazo: todayISO(), estado: 'pendiente', verificacion: '' } })}
          >
            Agregar actividad
          </Button>
        </div>
      )}

      <Field label="Mostrar">
        <Select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as typeof filtro)}
          options={[
            { value: 'todas', label: 'Todas las actividades' },
            { value: 'pendientes', label: 'Pendientes y en curso' },
            { value: 'vencidas', label: 'Vencidas' },
          ]}
        />
      </Field>

      <div className="space-y-3">
        {grupos.map((g) => (
          <Card key={g.origen} title={ORIGEN_LABEL[g.origen]} bodyClass="p-0!">
            <ul>
              {g.acts.map((a) => {
                const vencida = a.estado !== 'realizada' && a.plazo < hoy;
                return (
                  <li key={a.id}>
                    <button type="button" onClick={() => setSel({ a })} className="flex w-full items-start gap-3 border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50">
                      <CheckCircle2 className={cx('mt-0.5 size-5 shrink-0', a.estado === 'realizada' ? 'text-ok' : a.estado === 'en_curso' ? 'text-warn' : 'text-slate-300')} />
                      <span className="min-w-0 flex-1">
                        <span className={cx('block text-sm', a.estado === 'realizada' ? 'text-slate-500' : 'text-slate-800')}>{a.descripcion}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          {a.nivel && <Badge tone={NIVEL_TONE[a.nivel]}>{a.nivel}</Badge>}
                          <Badge tone={ESTADO_TONE[a.estado]}>{ESTADO_ACTIVIDAD_LABEL[a.estado]}</Badge>
                          <span className={cx(vencida && 'font-semibold text-crit')}>
                            {a.responsable} · {vencida ? 'venció' : 'plazo'} {formatDate(a.plazo)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
        {!grupos.length && <p className="py-8 text-center text-sm text-slate-500">No hay actividades con este filtro.</p>}
      </div>

      {pr.modificaciones.length > 0 && (
        <Card title="Registro de modificaciones">
          <ul className="space-y-1 text-sm text-slate-600">
            {[...pr.modificaciones].reverse().map((m, i) => (
              <li key={i}>
                <span className="font-medium text-navy">{formatDate(m.fecha)}</span> · {m.motivo}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs text-slate-500">Los plazos se sugieren según el nivel de riesgo (intolerable 7 días, importante 30, moderado 90, tolerable 180) y se pueden ajustar. No son un criterio normativo.</p>

      {sel && <EditarActividad actividad={sel.a} nueva={sel.nueva} onClose={() => setSel(null)} />}
      {aprobar && <Aprobar onClose={() => setAprobar(false)} />}
    </div>
  );
}
