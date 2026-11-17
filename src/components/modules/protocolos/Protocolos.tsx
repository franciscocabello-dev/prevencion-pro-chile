import { useState } from 'react';
import { CheckCircle2, Circle, Stethoscope, Users, CalendarClock } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { Protocolo } from '../../../types';
import { PROTOCOLOS_INFO } from '../../../data/catalogos';
import { addMonths, daysFromToday, formatDate } from '../../../utils/date';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, ProgressBar, ReadOnlyNotice, TextArea, cx, type Tone } from '../../ui';

export const semaforoProtocolo = (p: Protocolo): { tone: Tone; label: string; avance: number } => {
  const avance = Math.round((p.etapas.filter((e) => e.completada).length / Math.max(1, p.etapas.length)) * 100);
  if (!p.aplica) return { tone: 'neutral', label: 'No aplica', avance };
  const venc = p.proximaEvaluacion ? daysFromToday(p.proximaEvaluacion) : -1;
  if (!p.ultimaEvaluacion) return { tone: 'crit', label: 'Sin evaluación', avance };
  if (venc < 0) return { tone: 'crit', label: 'Evaluación vencida', avance };
  if (avance < 60) return { tone: 'warn', label: 'En implementación', avance };
  if (venc <= 60) return { tone: 'warn', label: 'Reevaluar pronto', avance };
  return { tone: 'ok', label: avance === 100 ? 'Implementado' : 'Al día', avance };
};

const LIGHT: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', neutral: 'bg-slate-300', info: 'bg-sky-500', dark: 'bg-navy' };

function EditarProtocolo({ p, onClose }: { p: Protocolo; onClose: () => void }) {
  const { updateCompany, notify } = useStore();
  const [d, setD] = useState<Protocolo>(p);
  const info = PROTOCOLOS_INFO[p.codigo];
  return (
    <Modal
      title={`Protocolo ${p.codigo}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              updateCompany((c) => ({ ...c, protocolos: c.protocolos.map((x) => (x.codigo === d.codigo ? d : x)) }));
              notify(`Protocolo ${d.codigo} actualizado`);
              onClose();
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="font-semibold text-navy">{info.nombre}</p>
          <p className="text-xs text-slate-500">{info.norma}</p>
          <p className="mt-1 text-sm text-slate-600">{info.descripcion}</p>
        </div>
        <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm font-medium">
          <input type="checkbox" className="size-5 accent-navy" checked={d.aplica} onChange={(e) => setD({ ...d, aplica: e.target.checked })} />
          El protocolo aplica a la empresa (existen trabajadores expuestos al factor de riesgo)
        </label>
        {d.aplica && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Última evaluación">
                <Input
                  type="date"
                  value={d.ultimaEvaluacion}
                  onChange={(e) => setD({ ...d, ultimaEvaluacion: e.target.value, proximaEvaluacion: e.target.value ? addMonths(e.target.value, info.frecuenciaMeses) : '' })}
                />
              </Field>
              <Field label="Próxima evaluación" hint={`Frecuencia sugerida: ${info.frecuenciaMeses} meses`}>
                <Input type="date" value={d.proximaEvaluacion} onChange={(e) => setD({ ...d, proximaEvaluacion: e.target.value })} />
              </Field>
              <Field label="Trabajadores expuestos">
                <Input type="number" min={0} value={d.trabajadoresExpuestos} onChange={(e) => setD({ ...d, trabajadoresExpuestos: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
            </div>
            <Field label="Responsable">
              <Input value={d.responsable} onChange={(e) => setD({ ...d, responsable: e.target.value })} />
            </Field>
            <div>
              <p className="mb-2 text-sm font-semibold text-navy">Etapas de implementación</p>
              <ul className="space-y-1.5">
                {d.etapas.map((e, i) => (
                  <li key={e.id}>
                    <label className={cx('flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm', e.completada ? 'border-ok/40 bg-ok-50/50' : 'border-slate-200')}>
                      <input type="checkbox" className="size-5 accent-[#10B981]" checked={e.completada} onChange={(ev) => setD({ ...d, etapas: d.etapas.map((x) => (x.id === e.id ? { ...x, completada: ev.target.checked } : x)) })} />
                      <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                      {e.nombre}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <Field label="Observaciones">
          <TextArea value={d.observaciones} onChange={(e) => setD({ ...d, observaciones: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Protocolos() {
  const { company, can } = useStore();
  const editable = can('editarProtocolos');
  const [edit, setEdit] = useState<Protocolo | null>(null);
  const aplican = company.protocolos.filter((p) => p.aplica);
  const verdes = aplican.filter((p) => semaforoProtocolo(p).tone === 'ok').length;
  const rojos = aplican.filter((p) => semaforoProtocolo(p).tone === 'crit').length;

  return (
    <div>
      <PageHeader title="Protocolos MINSAL" subtitle="Tablero semáforo de vigilancia: TMERT, MMC, PREXOR, PLANESI y Psicosocial / Ley Karin" icon={<Stethoscope className="size-6" />} />
      {!editable && <ReadOnlyNotice text="Vista de seguimiento. Sólo el Prevencionista de Riesgos puede actualizar el estado de los protocolos." />}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card bodyClass="p-4 text-center">
          <p className="text-3xl font-bold text-navy">{aplican.length}</p>
          <p className="text-xs text-slate-500">Protocolos aplicables</p>
        </Card>
        <Card bodyClass="p-4 text-center">
          <p className="text-3xl font-bold text-ok-700">{verdes}</p>
          <p className="text-xs text-slate-500">Al día</p>
        </Card>
        <Card bodyClass="p-4 text-center">
          <p className="text-3xl font-bold text-crit">{rojos}</p>
          <p className="text-xs text-slate-500">Críticos</p>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {company.protocolos.map((p) => {
          const s = semaforoProtocolo(p);
          const info = PROTOCOLOS_INFO[p.codigo];
          const venc = p.proximaEvaluacion ? daysFromToday(p.proximaEvaluacion) : null;
          return (
            <Card key={p.codigo} className={cx(!p.aplica && 'opacity-70')} bodyClass="p-5">
              <div className="flex items-start gap-4">
                {/* Semáforo */}
                <div className="flex shrink-0 flex-col gap-1.5 rounded-xl bg-navy p-2">
                  {(['crit', 'warn', 'ok'] as Tone[]).map((t) => (
                    <span key={t} className={cx('size-4 rounded-full', s.tone === t ? LIGHT[t] + ' shadow-[0_0_10px_currentColor]' : 'bg-white/15')} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-black text-navy">{p.codigo === 'PSICOSOCIAL' ? 'PSICOSOCIAL / LEY KARIN' : p.codigo}</p>
                    <Badge tone={s.tone} dot>
                      {s.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{info.nombre}</p>
                  <p className="text-[11px] text-slate-400">{info.norma}</p>
                </div>
              </div>
              {p.aplica ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-slate-600">Avance de implementación</span>
                      <b>{s.avance}%</b>
                    </div>
                    <ProgressBar value={s.avance} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <CalendarClock className="size-3.5" /> Próx.: <b className={cx(venc !== null && venc < 0 && 'text-crit')}>{formatDate(p.proximaEvaluacion)}</b>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Users className="size-3.5" /> {p.trabajadoresExpuestos} expuestos
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {p.etapas.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 text-xs text-slate-600">
                        {e.completada ? <CheckCircle2 className="size-3.5 shrink-0 text-ok" /> : <Circle className="size-3.5 shrink-0 text-slate-300" />}
                        <span className={cx(e.completada && 'text-slate-400')}>{e.nombre}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No aplica según evaluación cualitativa.</p>
              )}
              {p.observaciones && <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{p.observaciones}</p>}
              {editable && (
                <Button size="sm" variant="secondary" block className="mt-4" onClick={() => setEdit(p)}>
                  Actualizar seguimiento
                </Button>
              )}
            </Card>
          );
        })}
      </div>
      {edit && <EditarProtocolo p={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
