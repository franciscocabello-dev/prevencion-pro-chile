import { useState } from 'react';
import { Pencil, Plus, Search, Users, UserX, UserCheck } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { Trabajador } from '../../../types';
import { formatDate, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { validateRut } from '../../../utils/rut';
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, Modal, PageHeader, RutInput, Select } from '../../ui';

function TrabajadorForm({ inicial, onClose }: { inicial: Trabajador; onClose: () => void }) {
  const { company, updateCompany, notify } = useStore();
  const [t, setT] = useState(inicial);
  const existe = company.trabajadores.some((x) => x.id === t.id);
  const rutDup = company.trabajadores.some((x) => x.id !== t.id && x.rut === t.rut);
  const ok = t.nombre.trim().length > 3 && validateRut(t.rut) && !rutDup && t.cargo.trim() && t.area;
  return (
    <Modal
      title={existe ? 'Editar trabajador' : 'Nuevo trabajador'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!ok}
            onClick={() => {
              const final = { ...t, nombre: t.nombre.trim(), cargo: t.cargo.trim() };
              updateCompany((c) => ({ ...c, trabajadores: existe ? c.trabajadores.map((x) => (x.id === t.id ? final : x)) : [...c.trabajadores, final] }));
              notify('Trabajador guardado');
              onClose();
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre completo" required>
          <Input value={t.nombre} onChange={(e) => setT({ ...t, nombre: e.target.value })} />
        </Field>
        <RutInput value={t.rut} onChange={(v) => setT({ ...t, rut: v })} required />
        {rutDup && <p className="text-xs font-medium text-crit">Ya existe un trabajador con este RUT.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cargo" required>
            <Input value={t.cargo} onChange={(e) => setT({ ...t, cargo: e.target.value })} />
          </Field>
          <Field label="Área">
            <Select value={t.area} onChange={(e) => setT({ ...t, area: e.target.value })} options={company.areas} />
          </Field>
          <Field label="Fecha de ingreso">
            <Input type="date" value={t.fechaIngreso} onChange={(e) => setT({ ...t, fechaIngreso: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default function Trabajadores() {
  const { company, updateCompany, can } = useStore();
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Trabajador | null>(null);
  const editable = can('gestionarTrabajadores');
  const lista = company.trabajadores
    .filter((t) => !q || `${t.nombre} ${t.rut} ${t.cargo} ${t.area}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre));

  const toggle = (t: Trabajador) => updateCompany((c) => ({ ...c, trabajadores: c.trabajadores.map((x) => (x.id === t.id ? { ...x, activo: !x.activo } : x)) }));

  const odiPendiente = (t: Trabajador) => !company.charlas.some((c) => c.tipo === 'odi' && c.asistentes.some((a) => a.rut === t.rut));

  return (
    <div>
      <PageHeader
        title="Trabajadores"
        subtitle={`${company.trabajadores.filter((t) => t.activo).length} activos · nómina usada en charlas, EPP e incidentes`}
        icon={<Users className="size-6" />}
        actions={
          editable && (
            <Button icon={<Plus className="size-4" />} onClick={() => setForm({ id: uid('w-'), nombre: '', rut: '', cargo: '', area: company.areas[0] ?? '', fechaIngreso: todayISO(), activo: true })}>
              Nuevo trabajador
            </Button>
          )
        }
      />
      <div className="relative mb-4">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar por nombre, RUT, cargo o área" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {lista.length === 0 ? (
        <EmptyState icon={<Users className="size-10" />} title="Sin trabajadores registrados" />
      ) : (
        <>
          <Card bodyClass="p-0" className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] tracking-[0.06em] text-slate-500 uppercase">
                  <th className="px-4 py-2.5 font-semibold">Nombre</th>
                  <th className="px-2 font-semibold">RUT</th>
                  <th className="px-2 font-semibold">Cargo</th>
                  <th className="hidden px-2 font-semibold lg:table-cell">Área</th>
                  <th className="hidden px-2 font-semibold xl:table-cell">Ingreso</th>
                  <th className="px-2 font-semibold">ODI</th>
                  {editable && <th className="w-24" />}
                </tr>
              </thead>
              <tbody>
                {lista.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-navy">
                      {t.nombre} {!t.activo && <Badge>Inactivo</Badge>}
                    </td>
                    <td className="px-2 font-mono text-[13px] whitespace-nowrap tabular-nums">{t.rut}</td>
                    <td className="px-2">{t.cargo}</td>
                    <td className="hidden px-2 lg:table-cell">{t.area}</td>
                    <td className="hidden px-2 whitespace-nowrap tabular-nums xl:table-cell">{formatDate(t.fechaIngreso)}</td>
                    <td className="px-2">{odiPendiente(t) ? <Badge tone="warn">Pendiente</Badge> : <Badge tone="ok">Firmada</Badge>}</td>
                    {editable && (
                      <td className="px-1 whitespace-nowrap">
                        <IconButton label="Editar" onClick={() => setForm(t)}>
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton label={t.activo ? 'Desvincular' : 'Reactivar'} onClick={() => toggle(t)}>
                          {t.activo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                        </IconButton>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white md:hidden">
            {lista.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-navy">
                    <span className="min-w-0 break-words">{t.nombre}</span>
                    {!t.activo && <Badge>Inactivo</Badge>}
                  </p>
                  <p className="mt-0.5 font-mono text-[13px] text-slate-600 tabular-nums">{t.rut}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.cargo} · {t.area} · ingreso <span className="tabular-nums">{formatDate(t.fechaIngreso)}</span>
                  </p>
                  <div className="mt-2">{odiPendiente(t) ? <Badge tone="warn">ODI pendiente</Badge> : <Badge tone="ok">ODI firmada</Badge>}</div>
                </div>
                {editable && (
                  <div className="-mr-2 -mt-1 flex shrink-0">
                    <IconButton label="Editar" onClick={() => setForm(t)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton label={t.activo ? 'Desvincular' : 'Reactivar'} onClick={() => toggle(t)}>
                      {t.activo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                    </IconButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {form && <TrabajadorForm inicial={form} onClose={() => setForm(null)} />}
    </div>
  );
}
