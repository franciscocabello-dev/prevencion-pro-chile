import { useMemo, useState } from 'react';
import { ChevronRight, FileDown, HardHat, PackagePlus, RefreshCw, Search, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { CategoriaEPP, EntregaEPP, Trabajador } from '../../../types';
import { CATEGORIAS_EPP } from '../../../data/catalogos';
import { addDays, daysFromToday, formatDate, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { generarFichaEPP } from '../../../utils/pdfGenerator';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Stat, cx, type Tone } from '../../ui';
import SignaturePad from '../../ui/SignaturePad';

/** Última entrega vigente por categoría para un trabajador */
export const eppVigentes = (entregas: EntregaEPP[], trabajadorId: string): EntregaEPP[] => {
  const map = new Map<CategoriaEPP, EntregaEPP>();
  entregas
    .filter((e) => e.trabajadorId === trabajadorId)
    .forEach((e) => {
      const prev = map.get(e.categoria);
      if (!prev || e.fechaEntrega > prev.fechaEntrega) map.set(e.categoria, e);
    });
  return [...map.values()];
};

const estadoEPP = (e: EntregaEPP): { tone: Tone; label: string; dias: number } => {
  const d = daysFromToday(e.fechaRenovacion);
  if (d < 0) return { tone: 'crit', label: `Vencido ${-d}d`, dias: d };
  if (d <= 15) return { tone: 'warn', label: `Renovar en ${d}d`, dias: d };
  return { tone: 'ok', label: 'Vigente', dias: d };
};

function EntregaForm({ trabajador, categoriaInicial, onClose }: { trabajador: Trabajador; categoriaInicial?: CategoriaEPP; onClose: () => void }) {
  const { state, updateCompany, notify } = useStore();
  const [categoria, setCategoria] = useState<CategoriaEPP>(categoriaInicial ?? 'Calzado de seguridad');
  const info = CATEGORIAS_EPP.find((c) => c.categoria === categoria)!;
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState<EntregaEPP['motivo']>(categoriaInicial ? 'reposicion' : 'ingreso');
  const [fecha, setFecha] = useState(todayISO());
  const [renovacion, setRenovacion] = useState(addDays(todayISO(), info.vidaUtilDias));
  const [firma, setFirma] = useState('');

  const cambiarCategoria = (c: CategoriaEPP) => {
    setCategoria(c);
    const vida = CATEGORIAS_EPP.find((x) => x.categoria === c)!.vidaUtilDias;
    setRenovacion(addDays(fecha, vida));
  };

  return (
    <Modal
      title={`Entrega de EPP · ${trabajador.nombre.split(' ').slice(0, 2).join(' ')}`}
      onClose={onClose}
      footer={
        <Button
          block
          size="lg"
          variant="success"
          icon={<CheckCircle2 className="size-5" />}
          disabled={!firma || cantidad < 1}
          onClick={() => {
            const e: EntregaEPP = {
              id: uid('epp-'),
              trabajadorId: trabajador.id,
              categoria,
              descripcion: descripcion.trim() || categoria,
              cantidad,
              motivo,
              fechaEntrega: fecha,
              fechaRenovacion: renovacion,
              entregadoPor: state.usuario,
              firma,
            };
            updateCompany((c) => ({ ...c, entregasEPP: [e, ...c.entregasEPP] }));
            notify(`${categoria} entregado a ${trabajador.nombre.split(' ')[0]}`);
            onClose();
          }}
        >
          Registrar entrega firmada
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIAS_EPP.map((c) => (
            <button
              key={c.categoria}
              type="button"
              onClick={() => cambiarCategoria(c.categoria)}
              className={cx('rounded-lg border-2 px-2 py-2 text-xs font-semibold', categoria === c.categoria ? 'border-navy bg-navy text-white' : 'border-slate-200 text-slate-600')}
            >
              {c.categoria}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Norma de referencia: {info.norma} · vida útil sugerida {info.vidaUtilDias} días
        </p>
        <Field label="Descripción / modelo / talla">
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={`Ej. ${categoria} talla 42`} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad">
            <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Motivo">
            <Select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as EntregaEPP['motivo'])}
              options={[
                { value: 'ingreso', label: 'Ingreso' },
                { value: 'reposicion', label: 'Reposición' },
                { value: 'deterioro', label: 'Deterioro' },
                { value: 'perdida', label: 'Pérdida' },
              ]}
            />
          </Field>
          <Field label="Fecha de entrega">
            <Input
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                setRenovacion(addDays(e.target.value, info.vidaUtilDias));
              }}
            />
          </Field>
          <Field label="Fecha de renovación">
            <Input type="date" value={renovacion} onChange={(e) => setRenovacion(e.target.value)} />
          </Field>
        </div>
        <SignaturePad label={`Firma de recepción: ${trabajador.nombre}`} value={firma} onChange={setFirma} />
        <p className="text-xs text-slate-500">El trabajador declara recibir conforme y gratuitamente el EPP (Art. 68 Ley 16.744 · Art. 53 DS 594).</p>
      </div>
    </Modal>
  );
}

function FichaTrabajador({ t, onClose }: { t: Trabajador; onClose: () => void }) {
  const { company, can, notify } = useStore();
  const [entrega, setEntrega] = useState<{ cat?: CategoriaEPP } | null>(null);
  const vigentes = eppVigentes(company.entregasEPP, t.id);
  const historial = company.entregasEPP.filter((e) => e.trabajadorId === t.id).sort((a, b) => b.fechaEntrega.localeCompare(a.fechaEntrega));

  return (
    <Modal
      title="Ficha EPP del trabajador"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            icon={<FileDown className="size-4" />}
            disabled={!historial.length}
            onClick={() => {
              generarFichaEPP(company, t, historial);
              notify('Ficha EPP PDF descargada');
            }}
          >
            Ficha PDF
          </Button>
          {can('entregarEPP') && (
            <Button variant="success" icon={<PackagePlus className="size-4" />} onClick={() => setEntrega({})}>
              Nueva entrega
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-lg font-bold text-navy">{t.nombre}</p>
          <p className="text-sm text-slate-500">
            {t.rut} · {t.cargo} · {t.area}
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">EPP asignado vigente</p>
          {vigentes.length === 0 ? (
            <p className="text-sm text-slate-500">Sin entregas registradas.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {vigentes.map((e) => {
                const s = estadoEPP(e);
                return (
                  <div key={e.id} className={cx('flex items-center gap-3 rounded-xl border p-3', s.tone === 'crit' ? 'border-crit/40 bg-crit-50/40' : s.tone === 'warn' ? 'border-warn/50 bg-warn-50/50' : 'border-slate-200')}>
                    <HardHat className="size-5 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">{e.categoria}</p>
                      <p className="text-xs text-slate-500">Renovar: {formatDate(e.fechaRenovacion)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {can('entregarEPP') && s.tone !== 'ok' && (
                        <button type="button" onClick={() => setEntrega({ cat: e.categoria })} className="flex items-center gap-1 text-xs font-semibold text-navy hover:underline">
                          <RefreshCw className="size-3" /> Reponer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">Historial de entregas ({historial.length})</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {historial.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-20 shrink-0 text-xs text-slate-500 tabular-nums">{formatDate(e.fechaEntrega)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {e.descripcion} × {e.cantidad}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {e.motivo} · entregó {e.entregadoPor}
                  </span>
                </span>
                {e.firma ? <img src={e.firma} alt="Firma" className="h-8 w-20 rounded border border-slate-200 bg-white object-contain" /> : <Badge tone="crit">Sin firma</Badge>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {entrega && <EntregaForm trabajador={t} categoriaInicial={entrega.cat} onClose={() => setEntrega(null)} />}
    </Modal>
  );
}

export default function EPP() {
  const { company } = useStore();
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [sel, setSel] = useState<Trabajador | null>(null);

  const filas = useMemo(
    () =>
      company.trabajadores
        .filter((t) => t.activo)
        .filter((t) => (!area || t.area === area) && (!q || `${t.nombre} ${t.rut} ${t.cargo}`.toLowerCase().includes(q.toLowerCase())))
        .map((t) => {
          const v = eppVigentes(company.entregasEPP, t.id);
          const vencidos = v.filter((e) => estadoEPP(e).tone === 'crit').length;
          const porVencer = v.filter((e) => estadoEPP(e).tone === 'warn').length;
          return { t, total: v.length, vencidos, porVencer };
        })
        .sort((a, b) => b.vencidos - a.vencidos || b.porVencer - a.porVencer),
    [company, q, area],
  );

  const tot = filas.reduce((a, f) => ({ v: a.v + f.vencidos, p: a.p + f.porVencer, n: a.n + f.total }), { v: 0, p: 0, n: 0 });
  const entregasMes = company.entregasEPP.filter((e) => e.fechaEntrega >= addDays(todayISO(), -30)).length;

  return (
    <div>
      <PageHeader title="Control de EPP" subtitle="Entrega, reposición y firma de recepción por trabajador" icon={<HardHat className="size-6" />} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="EPP asignados vigentes" value={tot.n} tone="ok" />
        <Stat label="Por renovar (15 días)" value={tot.p} tone={tot.p ? 'warn' : 'ok'} />
        <Stat label="Vencidos" value={tot.v} tone={tot.v ? 'crit' : 'ok'} />
        <Stat label="Entregas últimos 30 días" value={entregasMes} tone="info" />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar trabajador por nombre, RUT o cargo" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="sm:w-56">
          <Select value={area} onChange={(e) => setArea(e.target.value)} placeholder="Todas las áreas" options={company.areas} />
        </div>
      </div>
      {filas.length === 0 ? (
        <EmptyState icon={<HardHat className="size-10" />} title="Sin trabajadores" text="Registre trabajadores en el módulo Trabajadores para controlar sus EPP." />
      ) : (
        <Card bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {filas.map(({ t, total, vencidos, porVencer }) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSel(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-navy">
                    {t.nombre
                      .split(' ')
                      .slice(0, 2)
                      .map((x) => x[0])
                      .join('')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy">{t.nombre}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {t.cargo} · {t.area}
                    </span>
                  </span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {vencidos > 0 && <Badge tone="crit">{vencidos} vencido(s)</Badge>}
                    {porVencer > 0 && <Badge tone="warn">{porVencer} por renovar</Badge>}
                    {vencidos === 0 && porVencer === 0 && <Badge tone={total ? 'ok' : 'neutral'}>{total ? `${total} al día` : 'Sin EPP'}</Badge>}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {sel && <FichaTrabajador t={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
