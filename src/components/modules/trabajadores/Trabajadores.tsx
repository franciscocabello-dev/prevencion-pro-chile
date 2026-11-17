import { useState } from 'react';
import { Pencil, Plus, Search, Users, UserX, UserCheck } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { Trabajador } from '../../../types';
import { formatDate, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { validateRut } from '../../../utils/rut';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, RutInput, Select } from '../../ui';

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
        <Card bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                  <th className="px-4 py-2.5">Nombre</th>
                  <th className="px-2">RUT</th>
                  <th className="px-2">Cargo</th>
                  <th className="px-2">Área</th>
                  <th className="px-2">Ingreso</th>
                  <th className="px-2">ODI</th>
                  {editable && <th />}
                </tr>
              </thead>
              <tbody>
                {lista.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-navy">
                      {t.nombre} {!t.activo && <Badge>Inactivo</Badge>}
                    </td>
                    <td className="px-2 whitespace-nowrap tabular-nums">{t.rut}</td>
                    <td className="px-2">{t.cargo}</td>
                    <td className="px-2">{t.area}</td>
                    <td className="px-2 whitespace-nowrap">{formatDate(t.fechaIngreso)}</td>
                    <td className="px-2">{odiPendiente(t) ? <Badge tone="warn">Pendiente</Badge> : <Badge tone="ok">Firmada</Badge>}</td>
                    {editable && (
                      <td className="px-2 whitespace-nowrap">
                        <button type="button" className="rounded p-2 text-slate-500 hover:bg-slate-100" onClick={() => setForm(t)} aria-label="Editar">
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-2 text-slate-500 hover:bg-slate-100"
                          title={t.activo ? 'Desvincular' : 'Reactivar'}
                          onClick={() => updateCompany((c) => ({ ...c, trabajadores: c.trabajadores.map((x) => (x.id === t.id ? { ...x, activo: !x.activo } : x)) }))}
                        >
                          {t.activo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {form && <TrabajadorForm inicial={form} onClose={() => setForm(null)} />}
    </div>
  );
}
