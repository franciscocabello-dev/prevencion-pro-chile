import { useMemo, useState } from 'react';
import { FileDown, Plus, ShieldAlert, Trash2, Pencil } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { ControlIPER, JerarquiaControl, RiesgoIPER } from '../../../types';
import { CONSECUENCIA_LABEL, JERARQUIA_LABEL, JERARQUIA_ORDEN, PROBABILIDAD_LABEL } from '../../../data/catalogos';
import { calcularVEP, nivelVEP, type NivelRiesgo } from '../../../utils/indicators';
import { todayISO, formatDate } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { generarMatrizIPER } from '../../../utils/pdfGenerator';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, ReadOnlyNotice, Select, cx, type Tone } from '../../ui';

export const NIVEL_TONE: Record<NivelRiesgo, Tone> = { Tolerable: 'ok', Moderado: 'warn', Importante: 'crit', Intolerable: 'crit' };
const NIVEL_BG: Record<NivelRiesgo, string> = {
  Tolerable: 'bg-ok text-white',
  Moderado: 'bg-warn text-navy',
  Importante: 'bg-orange-600 text-white',
  Intolerable: 'bg-crit text-white',
};
const NIVEL_ACCION: Record<NivelRiesgo, string> = {
  Tolerable: 'Mantener controles y verificar periódicamente.',
  Moderado: 'Implementar medidas en un plazo determinado.',
  Importante: 'No iniciar el trabajo hasta reducir el riesgo; medidas urgentes.',
  Intolerable: 'Detener la tarea de inmediato. Prohibido continuar sin reducir el riesgo.',
};

const P_VALUES: (1 | 2 | 4)[] = [1, 2, 4];

function RiesgoForm({ inicial, onClose }: { inicial: RiesgoIPER; onClose: () => void }) {
  const { company, updateCompany, notify } = useStore();
  const [r, setR] = useState<RiesgoIPER>(inicial);
  const [ctrl, setCtrl] = useState<{ jerarquia: JerarquiaControl; descripcion: string }>({ jerarquia: 'ingenieria', descripcion: '' });
  const vep = calcularVEP(r.probabilidad, r.consecuencia);
  const nivel = nivelVEP(vep);
  const existe = company.iper.some((x) => x.id === r.id);
  const ok = r.proceso.trim() && r.tarea.trim() && r.peligro.trim() && r.riesgo.trim();
  const set = <K extends keyof RiesgoIPER>(k: K, v: RiesgoIPER[K]) => setR((x) => ({ ...x, [k]: v }));

  return (
    <Modal
      title={existe ? 'Editar riesgo' : 'Nuevo riesgo IPER'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {existe && (
            <Button
              variant="ghost"
              className="mr-auto text-crit"
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                if (!confirm('¿Eliminar este riesgo de la matriz?')) return;
                updateCompany((c) => ({ ...c, iper: c.iper.filter((x) => x.id !== r.id) }));
                onClose();
              }}
            >
              Eliminar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!ok}
            onClick={() => {
              const final = { ...r, fechaRevision: todayISO() };
              updateCompany((c) => ({ ...c, iper: existe ? c.iper.map((x) => (x.id === r.id ? final : x)) : [...c.iper, final] }));
              notify('Matriz IPER actualizada');
              onClose();
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Área">
            <Select value={r.area} onChange={(e) => set('area', e.target.value)} options={company.areas} />
          </Field>
          <Field label="Proceso" required>
            <Input value={r.proceso} onChange={(e) => set('proceso', e.target.value)} />
          </Field>
          <Field label="Tarea" required>
            <Input value={r.tarea} onChange={(e) => set('tarea', e.target.value)} />
          </Field>
          <Field label="Tipo de tarea">
            <Select value={r.rutinaria ? 'R' : 'NR'} onChange={(e) => set('rutinaria', e.target.value === 'R')} options={[{ value: 'R', label: 'Rutinaria' }, { value: 'NR', label: 'No rutinaria' }]} />
          </Field>
          <Field label="Peligro (fuente)" required>
            <Input value={r.peligro} onChange={(e) => set('peligro', e.target.value)} placeholder="Ej. Superficie resbaladiza" />
          </Field>
          <Field label="Riesgo (consecuencia)" required>
            <Input value={r.riesgo} onChange={(e) => set('riesgo', e.target.value)} placeholder="Ej. Caída a mismo nivel" />
          </Field>
        </div>

        <div className="grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Probabilidad (P)</span>
            <div className="grid grid-cols-3 gap-1.5">
              {P_VALUES.map((v) => (
                <button key={v} type="button" onClick={() => set('probabilidad', v)} className={cx('rounded-lg border-2 py-2 text-xs font-bold', r.probabilidad === v ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white')}>
                  {PROBABILIDAD_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Consecuencia (C)</span>
            <div className="grid grid-cols-3 gap-1.5">
              {P_VALUES.map((v) => (
                <button key={v} type="button" onClick={() => set('consecuencia', v)} className={cx('rounded-lg border-2 px-1 py-2 text-[11px] leading-tight font-bold', r.consecuencia === v ? 'border-navy bg-navy text-white' : 'border-slate-200 bg-white')}>
                  {CONSECUENCIA_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
          <div className={cx('rounded-xl px-5 py-3 text-center', NIVEL_BG[nivel])}>
            <p className="text-[11px] font-semibold uppercase opacity-90">VEP = P × C</p>
            <p className="text-3xl font-black tabular-nums">{vep}</p>
            <p className="text-xs font-bold">{nivel}</p>
          </div>
          <p className="text-sm text-slate-600 md:col-span-3">{NIVEL_ACCION[nivel]}</p>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-navy">Medidas de control (jerarquía de controles)</p>
          <ul className="mb-2 space-y-1.5">
            {[...r.controles]
              .sort((a, b) => JERARQUIA_ORDEN.indexOf(a.jerarquia) - JERARQUIA_ORDEN.indexOf(b.jerarquia))
              .map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <Badge tone="dark">{JERARQUIA_LABEL[c.jerarquia]}</Badge>
                  <span className="flex-1">{c.descripcion}</span>
                  <button type="button" onClick={() => set('controles', r.controles.filter((x) => x.id !== c.id))} className="text-slate-400 hover:text-crit" aria-label="Quitar control">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:w-56">
              <Select value={ctrl.jerarquia} onChange={(e) => setCtrl({ ...ctrl, jerarquia: e.target.value as JerarquiaControl })} options={JERARQUIA_ORDEN.map((j, i) => ({ value: j, label: `${i + 1}. ${JERARQUIA_LABEL[j]}` }))} />
            </div>
            <Input className="flex-1" placeholder="Descripción de la medida" value={ctrl.descripcion} onChange={(e) => setCtrl({ ...ctrl, descripcion: e.target.value })} />
            <Button
              variant="secondary"
              icon={<Plus className="size-4" />}
              disabled={!ctrl.descripcion.trim()}
              onClick={() => {
                const nc: ControlIPER = { id: uid('c-'), jerarquia: ctrl.jerarquia, descripcion: ctrl.descripcion.trim() };
                set('controles', [...r.controles, nc]);
                setCtrl({ ...ctrl, descripcion: '' });
              }}
            >
              Agregar
            </Button>
          </div>
        </div>
        <Field label="Responsable">
          <Select value={r.responsable} onChange={(e) => set('responsable', e.target.value)} options={[...new Set([...company.supervisores, company.empresa.prevencionista, r.responsable])].filter(Boolean)} />
        </Field>
      </div>
    </Modal>
  );
}

export default function IPER() {
  const { company, can, notify } = useStore();
  const editable = can('editarIPER');
  const [form, setForm] = useState<RiesgoIPER | null>(null);
  const [area, setArea] = useState('');
  const [nivel, setNivel] = useState<NivelRiesgo | ''>('');

  const filas = useMemo(
    () =>
      company.iper
        .filter((r) => (!area || r.area === area) && (!nivel || nivelVEP(calcularVEP(r.probabilidad, r.consecuencia)) === nivel))
        .sort((a, b) => calcularVEP(b.probabilidad, b.consecuencia) - calcularVEP(a.probabilidad, a.consecuencia)),
    [company.iper, area, nivel],
  );

  // Mapa de calor P × C
  const heat = (p: number, c: number) => company.iper.filter((r) => r.probabilidad === p && r.consecuencia === c).length;
  const resumen = (['Intolerable', 'Importante', 'Moderado', 'Tolerable'] as NivelRiesgo[]).map((n) => ({ n, count: company.iper.filter((r) => nivelVEP(calcularVEP(r.probabilidad, r.consecuencia)) === n).length }));

  const nuevo = (): RiesgoIPER => ({
    id: uid('ip-'),
    area: company.areas[0] ?? '',
    proceso: '',
    tarea: '',
    rutinaria: true,
    peligro: '',
    riesgo: '',
    probabilidad: 2,
    consecuencia: 2,
    controles: [],
    responsable: company.supervisores[0] ?? company.empresa.prevencionista,
    fechaRevision: todayISO(),
  });

  return (
    <div>
      <PageHeader
        title="Matriz IPER"
        subtitle="Identificación de Peligros y Evaluación de Riesgos · VEP = Probabilidad × Consecuencia"
        icon={<ShieldAlert className="size-6" />}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<FileDown className="size-4" />}
              disabled={!company.iper.length}
              onClick={() => {
                generarMatrizIPER(company);
                notify('Matriz IPER PDF descargada');
              }}
            >
              Exportar PDF
            </Button>
            {editable && (
              <Button icon={<Plus className="size-4" />} onClick={() => setForm(nuevo())}>
                Nuevo riesgo
              </Button>
            )}
          </>
        }
      />
      {!editable && <ReadOnlyNotice text="Vista de sólo lectura. La creación y edición de la Matriz IPER es exclusiva del Prevencionista de Riesgos." />}

      <div className="mb-4 grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card title="Mapa de calor P × C" bodyClass="p-4">
          <div className="flex gap-2">
            <div className="flex flex-col-reverse justify-around text-[10px] font-semibold text-slate-500">
              {P_VALUES.map((p) => (
                <span key={p} className="h-14 leading-[3.5rem]">
                  P{p}
                </span>
              ))}
            </div>
            <div>
              <div className="grid grid-cols-3 gap-1">
                {[4, 2, 1].map((p) =>
                  P_VALUES.map((c) => {
                    const n = nivelVEP(p * c);
                    const count = heat(p, c);
                    return (
                      <div key={`${p}-${c}`} className={cx('flex size-14 flex-col items-center justify-center rounded-lg', NIVEL_BG[n], count === 0 && 'opacity-35')} title={`P${p} × C${c} = ${p * c} (${n})`}>
                        <span className="text-lg font-black">{count}</span>
                        <span className="text-[9px] font-semibold">VEP {p * c}</span>
                      </div>
                    );
                  }),
                )}
              </div>
              <div className="mt-1 grid grid-cols-3 text-center text-[10px] font-semibold text-slate-500">
                <span>C1</span>
                <span>C2</span>
                <span>C4</span>
              </div>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {resumen.map(({ n, count }) => (
            <button key={n} type="button" onClick={() => setNivel(nivel === n ? '' : n)} className={cx('rounded-xl border bg-white p-4 text-left shadow-sm', nivel === n ? 'border-navy ring-2 ring-navy/20' : 'border-slate-200')}>
              <span className={cx('inline-block rounded px-2 py-0.5 text-xs font-bold', NIVEL_BG[n])}>{n}</span>
              <p className="mt-2 text-3xl font-bold text-navy tabular-nums">{count}</p>
              <p className="text-xs text-slate-500">{NIVEL_ACCION[n]}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="w-56">
          <Select value={area} onChange={(e) => setArea(e.target.value)} placeholder="Todas las áreas" options={company.areas} />
        </div>
        {nivel && (
          <Button size="sm" variant="ghost" onClick={() => setNivel('')}>
            Quitar filtro «{nivel}»
          </Button>
        )}
      </div>

      {filas.length === 0 ? (
        <EmptyState icon={<ShieldAlert className="size-10" />} title="Matriz vacía" text="Agregue los peligros y riesgos identificados por proceso y tarea." />
      ) : (
        <Card bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-navy text-left text-xs text-white uppercase">
                <tr>
                  <th className="px-3 py-2.5">Área / Proceso</th>
                  <th className="px-3">Tarea</th>
                  <th className="px-3">Peligro</th>
                  <th className="px-3">Riesgo</th>
                  <th className="px-2 text-center">P</th>
                  <th className="px-2 text-center">C</th>
                  <th className="px-2 text-center">VEP</th>
                  <th className="px-3">Controles</th>
                  <th className="px-3">Revisión</th>
                  {editable && <th />}
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => {
                  const vep = calcularVEP(r.probabilidad, r.consecuencia);
                  const n = nivelVEP(vep);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-navy">{r.area}</p>
                        <p className="text-xs text-slate-500">{r.proceso}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.tarea} {!r.rutinaria && <Badge tone="info">NR</Badge>}
                      </td>
                      <td className="px-3 py-2.5">{r.peligro}</td>
                      <td className="px-3 py-2.5">{r.riesgo}</td>
                      <td className="px-2 py-2.5 text-center font-semibold">{r.probabilidad}</td>
                      <td className="px-2 py-2.5 text-center font-semibold">{r.consecuencia}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={cx('inline-flex min-w-20 flex-col rounded-lg px-2 py-1 text-center', NIVEL_BG[n])}>
                          <b className="text-base leading-none">{vep}</b>
                          <span className="text-[10px] font-semibold">{n}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <ul className="space-y-1">
                          {r.controles.map((c) => (
                            <li key={c.id} className="text-xs">
                              <b className="text-slate-500">{JERARQUIA_LABEL[c.jerarquia]}:</b> {c.descripcion}
                            </li>
                          ))}
                          {r.controles.length === 0 && <Badge tone="crit">Sin controles</Badge>}
                        </ul>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-500">
                        {formatDate(r.fechaRevision)}
                        <br />
                        {r.responsable}
                      </td>
                      {editable && (
                        <td className="px-2 py-2.5">
                          <button type="button" onClick={() => setForm(r)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Editar">
                            <Pencil className="size-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {form && <RiesgoForm inicial={form} onClose={() => setForm(null)} />}
    </div>
  );
}
