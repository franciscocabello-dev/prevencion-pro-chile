import { useRef, useState } from 'react';
import { Building2, Cog, Database, Download, RotateCcw, Trash2, Upload, X, Plus, UserCircle, Palette, Check, PenLine } from 'lucide-react';
import { TEMAS, useTema } from '../../../services/theme';
import { cx } from '../../ui';
import { useStore } from '../../../services/store';
import type { Empresa, Rubro } from '../../../types';
import { REGIONES, RUBRO_LABEL } from '../../../data/catalogos';
import { exportBackup, parseBackup, storageUsage } from '../../../services/storage';
import { Button, Card, Field, Input, PageHeader, ProgressBar, ReadOnlyNotice, RutInput, Select } from '../../ui';
import { ROL_LABEL } from '../../../utils/permissions';

function ListaEditable({ titulo, items, onChange, editable, placeholder }: { titulo: string; items: string[]; onChange: (v: string[]) => void; editable: boolean; placeholder: string }) {
  const [nuevo, setNuevo] = useState('');
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-navy">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1.5 pl-3 text-sm text-navy">
            {i}
            {editable && (
              <button type="button" onClick={() => onChange(items.filter((x) => x !== i))} className="-my-2.5 -mr-2 flex size-11 items-center justify-center rounded-full text-slate-500 hover:text-crit" aria-label={`Quitar ${i}`}>
                <X className="size-3.5" />
              </button>
            )}
          </span>
        ))}
        {items.length === 0 && <span className="text-sm text-slate-500">Sin registros</span>}
      </div>
      {editable && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = nuevo.trim();
            if (v && !items.includes(v)) onChange([...items, v]);
            setNuevo('');
          }}
        >
          <Input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder={placeholder} />
          <Button type="submit" variant="secondary" icon={<Plus className="size-4" />} disabled={!nuevo.trim()}>
            Agregar
          </Button>
        </form>
      )}
    </div>
  );
}

export default function Configuracion() {
  const { company, state, rol, can, updateCompany, setUsuario, resetDemo, replaceState, deleteCompany, notify, firmaRelatorGuardada, guardarFirmaRelator } = useStore();
  const { tema, setTema } = useTema();
  const editable = can('configurarEmpresa');
  const fileRef = useRef<HTMLInputElement>(null);
  const e = company.empresa;
  const setE = <K extends keyof Empresa>(k: K, v: Empresa[K]) => updateCompany((c) => ({ ...c, empresa: { ...c.empresa, [k]: v } }));
  const uso = storageUsage();
  const usoMB = (uso * 2) / 1024 / 1024; // UTF-16 aprox.

  return (
    <div className="space-y-4">
      <PageHeader title="Configuración" subtitle="Datos de la empresa, estructura organizacional y respaldo" icon={<Cog className="size-6" />} />

      <Card title="Tema visual" subtitle="Se guarda en este dispositivo" icon={<Palette className="size-5" />}>
        <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Tema visual">
          {TEMAS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tema === t.id}
              onClick={() => {
                setTema(t.id);
                notify(`Tema «${t.nombre}» aplicado`, 'info');
              }}
              className={cx('relative rounded-lg border p-3 text-left transition-colors', tema === t.id ? 'border-ok ring-2 ring-ok/30' : 'border-slate-200 hover:border-slate-400')}
            >
              {tema === t.id && (
                <span className="absolute top-2 right-2 rounded-full bg-ok p-1 text-white">
                  <Check className="size-3.5" />
                </span>
              )}
              {/* Mini vista previa */}
              <div className="mb-3 flex h-20 overflow-hidden rounded-lg ring-1 ring-black/10">
                <div className="w-1/4" style={{ background: t.muestra[0] }} />
                <div className="flex flex-1 flex-col gap-1.5 p-2" style={{ background: t.muestra[1] }}>
                  <div className="h-2 w-2/3 rounded" style={{ background: t.id === 'oscuro' ? '#334155' : '#CBD5E1' }} />
                  <div className="flex gap-1.5">
                    <div className="h-5 flex-1 rounded" style={{ background: t.muestra[2] }} />
                    <div className="h-5 flex-1 rounded" style={{ background: t.muestra[3] }} />
                  </div>
                  <div className="h-2 w-1/2 rounded" style={{ background: t.id === 'oscuro' ? '#334155' : '#CBD5E1' }} />
                </div>
              </div>
              <p className="font-semibold text-navy">{t.nombre}</p>
              <p className="text-xs text-slate-500">{t.descripcion}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Usuario activo" icon={<UserCircle className="size-5" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre del usuario" hint="Se registra como relator, inspector o responsable en los documentos.">
            <Input value={state.usuario} onChange={(ev) => setUsuario(ev.target.value)} />
          </Field>
          <Field label="Perfil">
            <Input value={ROL_LABEL[rol]} disabled />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
          <PenLine className="size-4 text-slate-500" />
          <span className="text-sm text-slate-700">Firma de relator guardada:</span>
          {firmaRelatorGuardada ? (
            <>
              <img src={firmaRelatorGuardada} alt="Firma guardada" className="paper h-10 w-28 rounded border border-slate-200 object-contain" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  guardarFirmaRelator('');
                  notify('Firma guardada eliminada de este dispositivo', 'info');
                }}
              >
                Borrar
              </Button>
            </>
          ) : (
            <span className="text-sm text-slate-500">ninguna (se guarda al firmar su primera sesión)</span>
          )}
        </div>
      </Card>

      <Card title="Datos de la empresa" subtitle="Aparecen en el encabezado de todas las actas PDF" icon={<Building2 className="size-5" />}>
        {!editable && <ReadOnlyNotice text="Sólo el Prevencionista de Riesgos puede modificar los datos legales de la empresa." />}
        <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nombre de fantasía">
            <Input value={e.nombre} onChange={(ev) => setE('nombre', ev.target.value)} />
          </Field>
          <Field label="Razón social">
            <Input value={e.razonSocial} onChange={(ev) => setE('razonSocial', ev.target.value)} />
          </Field>
          <RutInput label="RUT empresa" value={e.rut} onChange={(v) => setE('rut', v)} />
          <Field label="Rubro">
            <Select value={e.rubro} onChange={(ev) => setE('rubro', ev.target.value as Rubro)} options={Object.entries(RUBRO_LABEL).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Giro">
            <Input value={e.giro} onChange={(ev) => setE('giro', ev.target.value)} />
          </Field>
          <Field label="Organismo administrador (Ley 16.744)">
            <Select value={e.mutualidad} onChange={(ev) => setE('mutualidad', ev.target.value as Empresa['mutualidad'])} options={['ACHS', 'Mutual de Seguridad CChC', 'IST', 'ISL']} />
          </Field>
          <Field label="Dirección">
            <Input value={e.direccion} onChange={(ev) => setE('direccion', ev.target.value)} />
          </Field>
          <Field label="Comuna">
            <Input value={e.comuna} onChange={(ev) => setE('comuna', ev.target.value)} />
          </Field>
          <Field label="Región">
            <Select value={e.region} onChange={(ev) => setE('region', ev.target.value)} options={REGIONES} />
          </Field>
          <Field label="Representante legal / Gerente">
            <Input value={e.representanteLegal} onChange={(ev) => setE('representanteLegal', ev.target.value)} />
          </Field>
          <Field label="Experto en Prevención de Riesgos">
            <Input value={e.prevencionista} onChange={(ev) => setE('prevencionista', ev.target.value)} />
          </Field>
          <Field label="N° registro SEREMI">
            <Input value={e.registroSeremi} onChange={(ev) => setE('registroSeremi', ev.target.value)} />
          </Field>
        </fieldset>
      </Card>

      <Card title="Estructura organizacional">
        <div className="grid gap-6 md:grid-cols-2">
          <ListaEditable titulo="Áreas / Centros de trabajo" items={company.areas} editable={editable} placeholder="Nueva área" onChange={(v) => updateCompany((c) => ({ ...c, areas: v }))} />
          <ListaEditable titulo="Supervisores en terreno" items={company.supervisores} editable={editable} placeholder="Nombre del supervisor" onChange={(v) => updateCompany((c) => ({ ...c, supervisores: v }))} />
        </div>
        {editable && (
          <div className="mt-6 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <Field label="Fecha del último accidente CTP" hint="Base del contador de días sin accidentes">
              <Input type="date" value={company.fechaUltimoAccidenteCTP} onChange={(ev) => updateCompany((c) => ({ ...c, fechaUltimoAccidenteCTP: ev.target.value }))} />
            </Field>
            <Field label="Récord histórico (días)">
              <Input type="number" min={0} value={company.recordDiasSinAccidentes} onChange={(ev) => updateCompany((c) => ({ ...c, recordDiasSinAccidentes: Math.max(0, Number(ev.target.value) || 0) }))} />
            </Field>
          </div>
        )}
      </Card>

      <Card title="Datos y respaldo" subtitle="Toda la información se guarda localmente en este dispositivo" icon={<Database className="size-5" />}>
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span>Uso de almacenamiento local</span>
            <span className="tabular-nums">{usoMB.toFixed(2)} MB de ~5 MB</span>
          </div>
          <ProgressBar value={(usoMB / 5) * 100} tone={usoMB > 4 ? 'crit' : usoMB > 3 ? 'warn' : 'ok'} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="primary"
            icon={<Download className="size-4" />}
            onClick={() => {
              exportBackup(state);
              notify('Respaldo JSON descargado');
            }}
          >
            Exportar respaldo JSON
          </Button>
          {editable && (
            <>
              <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
                Importar respaldo JSON
              </Button>
              <Button
                variant="warning"
                icon={<RotateCcw className="size-4" />}
                onClick={() => {
                  if (!confirm('¿Restaurar las 3 empresas demo a su estado original? Se perderán los cambios hechos en ellas (las empresas propias se conservan).')) return;
                  resetDemo();
                  notify('Datos demo restaurados');
                }}
              >
                Restaurar datos demo
              </Button>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = '';
            if (!f) return;
            try {
              const s = await parseBackup(f);
              if (!confirm(`Se reemplazarán todos los datos actuales por el respaldo (${Object.keys(s.companies).length} empresas). ¿Continuar?`)) return;
              replaceState(s);
              notify('Respaldo importado correctamente');
            } catch (err) {
              notify((err as Error).message, 'error');
            }
          }}
        />
        {editable && Object.keys(state.companies).length > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-crit/30 bg-crit-50/50 p-3">
            <p className="text-sm text-crit-800">
              Eliminar la empresa <b>{company.empresa.nombre}</b> y todos sus registros de este dispositivo.
            </p>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                if (!confirm(`¿Eliminar definitivamente "${company.empresa.nombre}"? Exporte un respaldo antes si lo necesita.`)) return;
                deleteCompany(company.id);
                notify('Empresa eliminada', 'info');
              }}
            >
              Eliminar empresa
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
