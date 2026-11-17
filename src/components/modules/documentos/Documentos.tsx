import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Copy, FileDown, FilePlus2, FileSignature, History, Pencil, Plus, RotateCcw, Search, Trash2, Braces } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { CategoriaPlantilla, DocumentoGenerado, PlantillaDocumento, Trabajador } from '../../../types';
import { CATEGORIA_PLANTILLA_LABEL, CATEGORIAS_PLANTILLA, plantillasBase } from '../../../data/plantillas';
import { renderPlantilla, VARIABLES, variablesDesconocidas } from '../../../utils/templateEngine';
import { hashDocumento, hashFirma, nuevoSesionId, formatDateTime } from '../../../utils/verification';
import { todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { validateRut } from '../../../utils/rut';
import { generarDocumentoPlantilla } from '../../../utils/pdfGenerator';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, ReadOnlyNotice, RutInput, Select, Tabs, TextArea, cx } from '../../ui';
import SignaturePad from '../../ui/SignaturePad';

type TabId = 'generar' | 'plantillas' | 'historial';

const TEMA_LABEL: Record<CategoriaPlantilla, string> = {
  charla5: 'Tema de la charla',
  epp: 'Elementos entregados (opcional)',
  odi: 'Tema (opcional)',
  procedimiento: 'Nombre del procedimiento',
  amonestacion: 'Descripción del incumplimiento',
};

/** Resalta las variables {{...}} en la vista previa del editor */
function TextoConVariables({ texto }: { texto: string }) {
  const parts = texto.split(/(\{\{\s*[A-Z_]+\s*\}\})/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\{\{/.test(p) ? (
          <mark key={i} className="rounded bg-sky-50 px-0.5 font-mono text-[0.85em] text-sky-800">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

// ------------------------------------------------------------
// Editor de plantillas
// ------------------------------------------------------------
function EditorPlantilla({ inicial, onClose }: { inicial: PlantillaDocumento; onClose: () => void }) {
  const { company, state, updateCompany, notify } = useStore();
  const [p, setP] = useState(inicial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const existe = company.plantillas.some((x) => x.id === p.id);
  const desconocidas = variablesDesconocidas(`${p.titulo} ${p.cuerpo}`);
  const ejemplo = company.trabajadores[0];
  const ctx = { company, trabajador: ejemplo, relator: state.usuario, tema: 'Ejemplo de tema', area: ejemplo?.area };

  const insertar = (key: string) => {
    const el = ref.current;
    const token = `{{${key}}}`;
    if (!el) return setP({ ...p, cuerpo: p.cuerpo + token });
    const start = el.selectionStart ?? p.cuerpo.length;
    const end = el.selectionEnd ?? start;
    const cuerpo = p.cuerpo.slice(0, start) + token + p.cuerpo.slice(end);
    setP({ ...p, cuerpo });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <Modal
      title={existe ? 'Editar plantilla' : 'Nueva plantilla'}
      onClose={onClose}
      size="xl"
      footer={
        <>
          {existe && (
            <Button
              variant="ghost"
              className="mr-auto text-crit"
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                if (!confirm('¿Eliminar esta plantilla?')) return;
                updateCompany((c) => ({ ...c, plantillas: c.plantillas.filter((x) => x.id !== p.id) }));
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
            disabled={!p.nombre.trim() || !p.titulo.trim() || !p.cuerpo.trim()}
            onClick={() => {
              const final = { ...p, actualizada: todayISO() };
              updateCompany((c) => ({ ...c, plantillas: existe ? c.plantillas.map((x) => (x.id === p.id ? final : x)) : [...c.plantillas, final] }));
              notify('Plantilla guardada');
              onClose();
            }}
          >
            Guardar plantilla
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre interno" required>
              <Input value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} />
            </Field>
            <Field label="Categoría">
              <Select value={p.categoria} onChange={(e) => setP({ ...p, categoria: e.target.value as CategoriaPlantilla })} options={CATEGORIAS_PLANTILLA.map((c) => ({ value: c, label: CATEGORIA_PLANTILLA_LABEL[c] }))} />
            </Field>
          </div>
          <Field label="Título del documento" required hint="También admite variables, p. ej. «Charla: {{TEMA}}»">
            <Input value={p.titulo} onChange={(e) => setP({ ...p, titulo: e.target.value })} />
          </Field>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Braces className="size-4" /> Insertar variable en el cursor
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  title={`${v.descripcion} · ej: ${v.ejemplo}`}
                  onClick={() => insertar(v.key)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] text-navy hover:border-navy"
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>
          <Field label="Cuerpo del documento" required hint="Use una línea en blanco para separar párrafos.">
            <TextArea ref={ref} rows={14} value={p.cuerpo} onChange={(e) => setP({ ...p, cuerpo: e.target.value })} className="font-mono text-[13px]" />
          </Field>
          {desconocidas.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-warn-50 p-2.5 text-xs text-warn-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Variables no reconocidas (no se reemplazarán): {desconocidas.map((d) => `{{${d}}}`).join(', ')}
            </p>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-navy" checked={p.firmaTrabajador} onChange={(e) => setP({ ...p, firmaTrabajador: e.target.checked })} />
              Requiere firma del trabajador
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-navy" checked={p.firmaEmisor} onChange={(e) => setP({ ...p, firmaEmisor: e.target.checked })} />
              Requiere firma del emisor
            </label>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Vista previa {ejemplo ? `(con ${ejemplo.nombre.split(' ')[0]})` : '(datos de ejemplo)'}</p>
          <div className="paper rounded-xl border border-slate-200 p-5 shadow-inner">
            <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{company.empresa.razonSocial}</p>
            <p className="mb-3 border-b-2 border-ok pb-2 text-lg font-bold">{renderPlantilla(p.titulo, ctx)}</p>
            <div className="text-sm leading-relaxed whitespace-pre-line">{renderPlantilla(p.cuerpo, ctx)}</div>
          </div>
          <p className="mt-3 mb-1 text-xs font-semibold text-slate-500 uppercase">Plantilla original</p>
          <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-line text-slate-600">
            <TextoConVariables texto={p.cuerpo} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------
// Generación de documento con firmas
// ------------------------------------------------------------
function GenerarDocumento({ plantilla, onClose }: { plantilla: PlantillaDocumento; onClose: () => void }) {
  const { company, state, rol, updateCompany, notify, firmaRelatorGuardada, guardarFirmaRelator } = useStore();
  const [q, setQ] = useState('');
  const [trab, setTrab] = useState<Pick<Trabajador, 'nombre' | 'rut' | 'cargo' | 'area'> & { id?: string; fechaIngreso?: string }>({ nombre: '', rut: '', cargo: '', area: company.areas[0] ?? '' });
  const [tema, setTema] = useState('');
  const [emisor, setEmisor] = useState(state.usuario);
  const [cargoEmisor, setCargoEmisor] = useState(rol === 'prevencionista' ? 'Experto en Prevención de Riesgos' : rol === 'supervisor' ? 'Supervisor' : 'Jefatura');
  const [firmaTrab, setFirmaTrab] = useState('');
  const [usarGuardada, setUsarGuardada] = useState(!!firmaRelatorGuardada);
  const [firmaEmi, setFirmaEmi] = useState('');
  const firmaEmisor = usarGuardada && firmaRelatorGuardada ? firmaRelatorGuardada : firmaEmi;

  const ctx = { company, trabajador: trab.nombre ? trab : undefined, relator: emisor, tema, area: trab.area };
  const titulo = renderPlantilla(plantilla.titulo, ctx);
  const cuerpo = renderPlantilla(plantilla.cuerpo, ctx);
  const sugeridos = company.trabajadores.filter((t) => t.activo && (!q || `${t.nombre} ${t.rut}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 8);
  const temaRequerido = plantilla.categoria === 'amonestacion' || plantilla.categoria === 'procedimiento' || plantilla.categoria === 'charla5';
  const ok =
    trab.nombre.trim().length > 3 &&
    validateRut(trab.rut) &&
    trab.cargo.trim() &&
    (!temaRequerido || tema.trim()) &&
    emisor.trim() &&
    (!plantilla.firmaTrabajador || firmaTrab) &&
    (!plantilla.firmaEmisor || firmaEmisor);

  const generar = () => {
    if (!usarGuardada && firmaEmi) guardarFirmaRelator(firmaEmi);
    const base: Omit<DocumentoGenerado, 'hash'> = {
      id: uid('doc-'),
      sesionId: nuevoSesionId(todayISO()),
      plantillaId: plantilla.id,
      categoria: plantilla.categoria,
      titulo,
      cuerpo,
      trabajadorId: trab.id,
      trabajadorNombre: trab.nombre.trim(),
      trabajadorRut: trab.rut,
      trabajadorCargo: trab.cargo.trim(),
      area: trab.area,
      emisor: emisor.trim(),
      cargoEmisor: cargoEmisor.trim(),
      firmaTrabajador: firmaTrab,
      firmaEmisor,
      creadoEn: new Date().toISOString(),
    };
    const doc: DocumentoGenerado = { ...base, hash: hashDocumento(base) };
    updateCompany((c) => ({ ...c, documentos: [doc, ...c.documentos] }));
    generarDocumentoPlantilla(company, doc);
    notify('Documento firmado, sellado y descargado en PDF');
    onClose();
  };

  return (
    <Modal
      title={`Generar: ${plantilla.nombre}`}
      onClose={onClose}
      size="xl"
      footer={
        <Button variant="success" icon={<FileDown className="size-4" />} disabled={!ok} onClick={generar}>
          Firmar y generar PDF
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-navy">1. Trabajador</p>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Buscar en nómina" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sugeridos.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTrab({ id: t.id, nombre: t.nombre, rut: t.rut, cargo: t.cargo, area: t.area, fechaIngreso: t.fechaIngreso });
                    setFirmaTrab('');
                  }}
                  className={cx('rounded-full border px-3 py-1.5 text-xs font-medium', trab.rut === t.rut ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-navy')}
                >
                  {t.nombre.split(' ').slice(0, 2).join(' ')}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre completo" className="sm:col-span-2">
                <Input value={trab.nombre} onChange={(e) => setTrab({ ...trab, id: undefined, nombre: e.target.value })} />
              </Field>
              <RutInput value={trab.rut} onChange={(v) => setTrab({ ...trab, id: undefined, rut: v })} required />
              <Field label="Cargo">
                <Input value={trab.cargo} onChange={(e) => setTrab({ ...trab, cargo: e.target.value })} />
              </Field>
              <Field label="Área" className="sm:col-span-2">
                <Select value={trab.area} onChange={(e) => setTrab({ ...trab, area: e.target.value })} options={[...new Set([...company.areas, trab.area].filter(Boolean))]} />
              </Field>
            </div>
          </div>
          <Field label={`2. ${TEMA_LABEL[plantilla.categoria]}`} required={temaRequerido} hint="Valor de la variable {{TEMA}}">
            <TextArea rows={2} value={tema} onChange={(e) => setTema(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Emisor / Relator">
              <Input value={emisor} onChange={(e) => setEmisor(e.target.value)} />
            </Field>
            <Field label="Cargo del emisor">
              <Input value={cargoEmisor} onChange={(e) => setCargoEmisor(e.target.value)} />
            </Field>
          </div>
          {plantilla.firmaTrabajador && <SignaturePad label={`Firma del trabajador${trab.nombre ? `: ${trab.nombre}` : ''}`} value={firmaTrab} onChange={setFirmaTrab} />}
          {plantilla.firmaEmisor && (
            <div>
              {firmaRelatorGuardada && (
                <label className="mb-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-navy" checked={usarGuardada} onChange={(e) => setUsarGuardada(e.target.checked)} />
                  Usar mi firma guardada de relator
                </label>
              )}
              {usarGuardada && firmaRelatorGuardada ? (
                <img src={firmaRelatorGuardada} alt="Firma emisor" className="paper h-20 w-full rounded-lg border border-slate-200 object-contain" />
              ) : (
                <SignaturePad label={`Firma del emisor: ${emisor}`} value={firmaEmi} onChange={setFirmaEmi} />
              )}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Vista previa con variables reemplazadas</p>
          <div className="paper sticky top-0 rounded-xl border border-slate-200 p-5 shadow-inner">
            <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              {company.empresa.razonSocial} · RUT {company.empresa.rut}
            </p>
            <p className="mb-3 border-b-2 border-ok pb-2 text-lg font-bold">{titulo}</p>
            <div className="text-sm leading-relaxed whitespace-pre-line">{cuerpo}</div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-center text-xs">
              <div>
                {firmaTrab ? <img src={firmaTrab} alt="" className="mx-auto h-12 object-contain" /> : <div className="h-12" />}
                <div className="border-t border-slate-400 pt-1 font-semibold">{trab.nombre || 'Trabajador'}</div>
              </div>
              <div>
                {firmaEmisor ? <img src={firmaEmisor} alt="" className="mx-auto h-12 object-contain" /> : <div className="h-12" />}
                <div className="border-t border-slate-400 pt-1 font-semibold">{emisor}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Documentos() {
  const { company, can, updateCompany, notify } = useStore();
  const [tab, setTab] = useState<TabId>(can('generarDocumentos') ? 'generar' : 'historial');
  const [cat, setCat] = useState<CategoriaPlantilla>('epp');
  const [editar, setEditar] = useState<PlantillaDocumento | null>(null);
  const [generar, setGenerar] = useState<PlantillaDocumento | null>(null);
  const [q, setQ] = useState('');

  const delCat = company.plantillas.filter((p) => p.categoria === cat);
  const historial = useMemo(
    () => company.documentos.filter((d) => !q || `${d.titulo} ${d.trabajadorNombre} ${d.trabajadorRut} ${d.sesionId}`.toLowerCase().includes(q.toLowerCase())),
    [company.documentos, q],
  );

  const nueva = (): PlantillaDocumento => ({
    id: uid('pl-'),
    categoria: cat,
    nombre: `Nueva plantilla ${CATEGORIA_PLANTILLA_LABEL[cat]}`,
    titulo: CATEGORIA_PLANTILLA_LABEL[cat],
    cuerpo: 'Yo, {{NOMBRE_TRABAJADOR}}, RUT {{RUT_TRABAJADOR}}, cargo {{CARGO}}, de {{EMPRESA}}…',
    firmaTrabajador: true,
    firmaEmisor: true,
    actualizada: todayISO(),
    base: false,
  });

  const tabsCat = (
    <Tabs<CategoriaPlantilla>
      value={cat}
      onChange={setCat}
      tabs={CATEGORIAS_PLANTILLA.map((c) => ({ id: c, label: CATEGORIA_PLANTILLA_LABEL[c], count: company.plantillas.filter((p) => p.categoria === c).length }))}
    />
  );

  return (
    <div>
      <PageHeader title="Plantillas y Documentos" subtitle="Documentos con variables dinámicas, firma táctil y QR de verificación" icon={<FileSignature className="size-6" />} />
      <Tabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          ...(can('generarDocumentos') ? [{ id: 'generar' as TabId, label: 'Generar documento' }] : []),
          { id: 'plantillas', label: 'Editor de plantillas', count: company.plantillas.length },
          { id: 'historial', label: 'Historial', count: company.documentos.length },
        ]}
      />

      {tab === 'generar' && (
        <>
          {tabsCat}
          {delCat.length === 0 ? (
            <EmptyState icon={<FileSignature className="size-10" />} title="Sin plantillas en esta categoría" text="Cree una en el Editor de plantillas." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {delCat.map((p) => (
                <Card key={p.id} bodyClass="p-4 flex h-full flex-col">
                  <p className="font-semibold text-navy">{p.nombre}</p>
                  <p className="mt-1 line-clamp-3 flex-1 text-xs text-slate-500">
                    <TextoConVariables texto={p.cuerpo.slice(0, 220)} />…
                  </p>
                  <Button className="mt-3" block variant="success" icon={<FilePlus2 className="size-4" />} onClick={() => setGenerar(p)}>
                    Generar y firmar
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'plantillas' && (
        <>
          {!can('editarPlantillas') && <ReadOnlyNotice text="Sólo el Prevencionista de Riesgos puede crear y editar plantillas." />}
          {tabsCat}
          {can('editarPlantillas') && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Button icon={<Plus className="size-4" />} onClick={() => setEditar(nueva())}>
                Nueva plantilla
              </Button>
              <Button
                variant="secondary"
                icon={<RotateCcw className="size-4" />}
                onClick={() => {
                  if (!confirm('¿Restaurar las 5 plantillas base? Las plantillas propias se conservan.')) return;
                  updateCompany((c) => ({ ...c, plantillas: [...plantillasBase(), ...c.plantillas.filter((x) => !x.base)] }));
                  notify('Plantillas base restauradas');
                }}
              >
                Restaurar plantillas base
              </Button>
            </div>
          )}
          <div className="space-y-2">
            {delCat.map((p) => (
              <Card key={p.id} bodyClass="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-navy">{p.nombre}</p>
                      {p.base ? <Badge>Base</Badge> : <Badge tone="info">Propia</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">
                      Título: «{p.titulo}» · actualizada {p.actualizada}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                      <TextoConVariables texto={p.cuerpo} />
                    </p>
                  </div>
                  {can('editarPlantillas') && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" icon={<Copy className="size-4" />} onClick={() => setEditar({ ...p, id: uid('pl-'), nombre: `${p.nombre} (copia)`, base: false })}>
                        Duplicar
                      </Button>
                      <Button size="sm" variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditar(p)}>
                        Editar
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Card title="Variables disponibles" className="mt-4" icon={<Braces className="size-5" />}>
            <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {VARIABLES.map((v) => (
                <p key={v.key}>
                  <code className="rounded bg-slate-100 px-1 font-mono text-xs">{`{{${v.key}}}`}</code> <span className="text-slate-600">{v.descripcion}</span>
                </p>
              ))}
            </div>
          </Card>
        </>
      )}

      {tab === 'historial' && (
        <>
          <div className="relative mb-4">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar por trabajador, RUT, título o sesión" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {historial.length === 0 ? (
            <EmptyState icon={<History className="size-10" />} title="Sin documentos generados" />
          ) : (
            <Card bodyClass="p-0">
              <ul className="divide-y divide-slate-100">
                {historial.map((d) => {
                  const integro = hashDocumento(d) === d.hash;
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Badge tone="dark">{CATEGORIA_PLANTILLA_LABEL[d.categoria]}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy">{d.titulo}</p>
                        <p className="text-xs text-slate-500">
                          {d.trabajadorNombre} · {d.trabajadorRut} · {formatDateTime(d.creadoEn)} · <span className="font-mono">{d.sesionId}</span> · huella {hashFirma(d.firmaTrabajador)}
                        </p>
                      </div>
                      <Badge tone={integro ? 'ok' : 'crit'} dot>
                        {integro ? 'Íntegro' : 'Alterado'}
                      </Badge>
                      <Button size="sm" variant="secondary" icon={<FileDown className="size-4" />} onClick={() => generarDocumentoPlantilla(company, d)}>
                        PDF
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}

      {editar && <EditorPlantilla inicial={editar} onClose={() => setEditar(null)} />}
      {generar && <GenerarDocumento plantilla={generar} onClose={() => setGenerar(null)} />}
    </div>
  );
}
