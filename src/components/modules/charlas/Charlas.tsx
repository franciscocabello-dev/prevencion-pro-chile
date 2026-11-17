import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calendar, Clock, FileDown, Megaphone, Plus, Search, Trash2, UserPlus, Users, X, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../../services/store';
import type { Asistente, Charla, TipoCharla } from '../../../types';
import { TEMAS_CHARLA, TIPO_CHARLA_LABEL } from '../../../data/catalogos';
import { formatDate, nowTime, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { validateRut } from '../../../utils/rut';
import { generarActaCharla } from '../../../utils/pdfGenerator';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, RutInput, Select, Tabs, TextArea, cx } from '../../ui';
import SignaturePad from '../../ui/SignaturePad';

type Filtro = 'todas' | TipoCharla;

const emptyAsistente = () => ({ nombre: '', rut: '', cargo: '', firma: '' });

function NuevaCharla({ onClose, onSaved }: { onClose: () => void; onSaved: (c: Charla) => void }) {
  const { company, state, rol, updateCompany, notify } = useStore();
  const rubro = company.empresa.rubro;
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<TipoCharla>('charla5');
  const [temaId, setTemaId] = useState('');
  const [tema, setTema] = useState('');
  const [contenido, setContenido] = useState('');
  const [fecha, setFecha] = useState(todayISO());
  const [hora, setHora] = useState(nowTime());
  const [duracion, setDuracion] = useState(5);
  const [area, setArea] = useState(company.areas[0] ?? '');
  const [relator, setRelator] = useState(state.usuario);
  const [cargoRelator, setCargoRelator] = useState(rol === 'prevencionista' ? 'Experto en Prevención de Riesgos' : rol === 'supervisor' ? 'Supervisor' : 'Jefatura');
  const [firmaRelator, setFirmaRelator] = useState('');
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [nuevo, setNuevo] = useState(emptyAsistente());
  const [buscar, setBuscar] = useState('');

  const temas = useMemo(() => TEMAS_CHARLA.filter((t) => t.rubros === 'todos' || t.rubros.includes(rubro)), [rubro]);
  const otrosTemas = useMemo(() => TEMAS_CHARLA.filter((t) => !(t.rubros === 'todos' || t.rubros.includes(rubro))), [rubro]);

  const elegirTema = (id: string) => {
    setTemaId(id);
    if (id === 'libre') {
      setTema('');
      setContenido('');
      return;
    }
    const t = TEMAS_CHARLA.find((x) => x.id === id);
    if (t) {
      setTema(t.titulo);
      setContenido(t.contenido);
    }
  };

  const sugeridos = company.trabajadores.filter(
    (t) => t.activo && !asistentes.some((a) => a.rut === t.rut) && (buscar ? `${t.nombre} ${t.rut}`.toLowerCase().includes(buscar.toLowerCase()) : t.area === area),
  );

  const rutValido = validateRut(nuevo.rut);
  const rutDuplicado = asistentes.some((a) => a.rut === nuevo.rut);
  const puedeAgregar = nuevo.nombre.trim().length > 3 && rutValido && !rutDuplicado && nuevo.cargo.trim() && nuevo.firma;

  const agregar = () => {
    if (!puedeAgregar) return;
    setAsistentes((a) => [...a, { id: uid('as'), ...nuevo, nombre: nuevo.nombre.trim(), cargo: nuevo.cargo.trim() }]);
    setNuevo(emptyAsistente());
    setBuscar('');
    notify(`${nuevo.nombre.split(' ')[0]} agregado a la lista`, 'info');
  };

  const guardar = () => {
    const charla: Charla = {
      id: uid('ch-'),
      tipo,
      tema: tema.trim(),
      contenido: contenido.trim(),
      fecha,
      hora,
      duracionMin: duracion,
      area,
      relator: relator.trim(),
      cargoRelator: cargoRelator.trim(),
      firmaRelator,
      asistentes,
      creadoPor: rol,
    };
    updateCompany((c) => ({ ...c, charlas: [charla, ...c.charlas] }));
    notify('Registro guardado con firmas');
    onSaved(charla);
  };

  const paso1Ok = tema.trim() && contenido.trim() && area && relator.trim();

  return (
    <Modal
      title={`Nueva ${TIPO_CHARLA_LABEL[tipo].split(' (')[0]}`}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Paso {step} de 3</span>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                Atrás
              </Button>
            )}
            {step === 1 && (
              <Button disabled={!paso1Ok} onClick={() => setStep(2)}>
                Continuar a asistentes
              </Button>
            )}
            {step === 2 && (
              <Button disabled={asistentes.length === 0} onClick={() => setStep(3)}>
                Continuar ({asistentes.length} firmas)
              </Button>
            )}
            {step === 3 && (
              <Button variant="success" disabled={!firmaRelator} icon={<CheckCircle2 className="size-4" />} onClick={guardar}>
                Guardar registro
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {['Tema', 'Asistentes y firmas', 'Cierre relator'].map((l, i) => (
          <div key={l} className={cx('h-1.5 rounded-full', step > i ? 'bg-ok' : 'bg-slate-200')} title={l} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TIPO_CHARLA_LABEL) as TipoCharla[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTipo(t);
                  setDuracion(t === 'charla5' ? 5 : t === 'odi' ? 30 : 60);
                }}
                className={cx('rounded-lg border-2 px-2 py-3 text-center text-xs font-semibold sm:text-sm', tipo === t ? 'border-navy bg-navy text-white' : 'border-slate-200 text-slate-600')}
              >
                {t === 'charla5' ? 'Charla 5 min' : t === 'capacitacion' ? 'Capacitación' : 'ODI (DS 40)'}
              </button>
            ))}
          </div>
          <Field label="Biblioteca de temas" hint={`Temas sugeridos para el rubro de ${company.empresa.nombre}`}>
            <Select
              value={temaId}
              onChange={(e) => elegirTema(e.target.value)}
              placeholder="Seleccione un tema…"
              options={[
                ...temas.map((t) => ({ value: t.id, label: `${t.categoria} · ${t.titulo}` })),
                ...otrosTemas.map((t) => ({ value: t.id, label: `(Otro rubro) ${t.titulo}` })),
                { value: 'libre', label: '✎ Tema libre…' },
              ]}
            />
          </Field>
          <Field label="Tema tratado" required>
            <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej. Uso de escaleras portátiles" />
          </Field>
          <Field label="Contenido / puntos clave" required>
            <TextArea rows={5} value={contenido} onChange={(e) => setContenido(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Fecha">
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Field>
            <Field label="Hora">
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </Field>
            <Field label="Duración (min)">
              <Input type="number" min={1} value={duracion} onChange={(e) => setDuracion(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
            <Field label="Área">
              <Select value={area} onChange={(e) => setArea(e.target.value)} options={company.areas} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Relator" required>
              <Input value={relator} onChange={(e) => setRelator(e.target.value)} />
            </Field>
            <Field label="Cargo del relator">
              <Input value={cargoRelator} onChange={(e) => setCargoRelator(e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-navy">
              <Users className="size-4" /> Selección rápida desde nómina
            </p>
            <div className="relative mb-2">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Buscar por nombre o RUT (por defecto: trabajadores del área)" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sugeridos.slice(0, 12).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setNuevo({ nombre: t.nombre, rut: t.rut, cargo: t.cargo, firma: '' })}
                  className={cx('rounded-full border px-3 py-1.5 text-xs font-medium', nuevo.rut === t.rut ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-navy hover:border-navy')}
                >
                  {t.nombre.split(' ').slice(0, 2).join(' ')}
                </button>
              ))}
              {sugeridos.length === 0 && <span className="text-xs text-slate-500">Sin coincidencias. Ingrese los datos manualmente.</span>}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border-2 border-navy/10 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">
              <UserPlus className="size-4" /> Asistente N° {asistentes.length + 1}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nombre completo" required className="sm:col-span-3">
                <Input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre y apellidos" />
              </Field>
              <RutInput value={nuevo.rut} onChange={(v) => setNuevo({ ...nuevo, rut: v })} required className="sm:col-span-1" />
              <Field label="Cargo" required className="sm:col-span-2">
                <Input value={nuevo.cargo} onChange={(e) => setNuevo({ ...nuevo, cargo: e.target.value })} />
              </Field>
            </div>
            {rutDuplicado && <p className="text-xs font-medium text-crit">Este RUT ya firmó en esta actividad.</p>}
            <SignaturePad label="Firma del asistente" value={nuevo.firma} onChange={(f) => setNuevo((n) => ({ ...n, firma: f }))} />
            <Button block variant="success" size="lg" disabled={!puedeAgregar} icon={<UserPlus className="size-5" />} onClick={agregar}>
              Agregar asistente firmado
            </Button>
          </div>

          {asistentes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-navy">Lista de asistencia ({asistentes.length})</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {asistentes.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy">{a.nombre}</span>
                      <span className="block text-xs text-slate-500">
                        {a.rut} · {a.cargo}
                      </span>
                    </span>
                    <img src={a.firma} alt="Firma" className="h-9 w-24 rounded border border-slate-200 bg-white object-contain" />
                    <button type="button" onClick={() => setAsistentes((x) => x.filter((y) => y.id !== a.id))} className="rounded p-1.5 text-slate-400 hover:bg-crit-50 hover:text-crit" aria-label="Quitar">
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-navy">{tema}</p>
            <p className="mt-1 text-slate-600">
              {formatDate(fecha)} · {hora} hrs · {duracion} min · {area}
            </p>
            <p className="mt-1 text-slate-600">{asistentes.length} asistentes con firma registrada</p>
          </div>
          <SignaturePad label={`Firma del relator: ${relator}`} value={firmaRelator} onChange={setFirmaRelator} />
          <p className="text-xs text-slate-500">Al guardar se podrá descargar el Acta Legal PDF lista para fiscalización de la Inspección del Trabajo o SEREMI de Salud.</p>
        </div>
      )}
    </Modal>
  );
}

function DetalleCharla({ charla, onClose }: { charla: Charla; onClose: () => void }) {
  const { company, can, updateCompany, notify } = useStore();
  return (
    <Modal
      title={charla.tema}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {can('eliminarRegistros') && (
            <Button
              variant="ghost"
              className="mr-auto text-crit"
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
                updateCompany((c) => ({ ...c, charlas: c.charlas.filter((x) => x.id !== charla.id) }));
                notify('Registro eliminado', 'info');
                onClose();
              }}
            >
              Eliminar
            </Button>
          )}
          <Button
            icon={<FileDown className="size-4" />}
            onClick={() => {
              generarActaCharla(company, charla);
              notify('Acta legal PDF descargada');
            }}
          >
            Descargar Acta Legal PDF
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="dark">{TIPO_CHARLA_LABEL[charla.tipo]}</Badge>
          <Badge>{charla.area}</Badge>
          <Badge tone="ok">{charla.asistentes.length} firmas</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Fecha</p>
            <p className="font-medium">{formatDate(charla.fecha)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Hora</p>
            <p className="font-medium">{charla.hora}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Duración</p>
            <p className="font-medium">{charla.duracionMin} min</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Relator</p>
            <p className="font-medium">{charla.relator}</p>
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Contenido</p>
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{charla.contenido}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Asistentes</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {charla.asistentes.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.nombre}</span>
                  <span className="block text-xs text-slate-500">
                    {a.rut} · {a.cargo}
                  </span>
                </span>
                {a.firma ? <img src={a.firma} alt="Firma" className="h-9 w-24 rounded border border-slate-200 bg-white object-contain" /> : <Badge tone="crit">Sin firma</Badge>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

export default function Charlas() {
  const { company, route, navigate, can } = useStore();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [q, setQ] = useState('');
  const [nueva, setNueva] = useState(false);
  const [detalle, setDetalle] = useState<Charla | null>(null);

  useEffect(() => {
    if (route.params.get('nuevo') === '1' && can('crearCharla')) {
      setNueva(true);
      navigate('charlas');
    }
  }, [route, can, navigate]);

  const lista = company.charlas
    .filter((c) => filtro === 'todas' || c.tipo === filtro)
    .filter((c) => !q || `${c.tema} ${c.relator} ${c.area}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora));

  const count = (t: Filtro) => (t === 'todas' ? company.charlas.length : company.charlas.filter((c) => c.tipo === t).length);

  return (
    <div>
      <PageHeader
        title="Charlas, Capacitaciones y ODI"
        subtitle="Registro con firma táctil y acta legal PDF (DS 40 Art. 21)"
        icon={<Megaphone className="size-6" />}
        actions={
          can('crearCharla') && (
            <Button variant="success" size="lg" icon={<Plus className="size-5" />} onClick={() => setNueva(true)}>
              Nueva charla
            </Button>
          )
        }
      />
      <Tabs<Filtro>
        value={filtro}
        onChange={setFiltro}
        tabs={[
          { id: 'todas', label: 'Todas', count: count('todas') },
          { id: 'charla5', label: 'Charlas 5 min', count: count('charla5') },
          { id: 'capacitacion', label: 'Capacitaciones', count: count('capacitacion') },
          { id: 'odi', label: 'ODI', count: count('odi') },
        ]}
      />
      <div className="relative mb-4">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar por tema, relator o área" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {lista.length === 0 ? (
        <EmptyState icon={<BookOpen className="size-10" />} title="Sin registros" text="Registre la primera charla con firma táctil de los asistentes." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((c) => (
            <button key={c.id} type="button" onClick={() => setDetalle(c)} className="text-left">
              <Card className="h-full transition-shadow hover:shadow-md" bodyClass="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <Badge tone={c.tipo === 'charla5' ? 'info' : c.tipo === 'odi' ? 'warn' : 'dark'}>{c.tipo === 'charla5' ? 'Charla 5 min' : c.tipo === 'odi' ? 'ODI' : 'Capacitación'}</Badge>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Users className="size-3.5" /> {c.asistentes.length}
                  </span>
                </div>
                <p className="line-clamp-2 font-semibold text-navy">{c.tema}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {c.area} · {c.relator}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" /> {formatDate(c.fecha)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> {c.duracionMin} min
                  </span>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {nueva && (
        <NuevaCharla
          onClose={() => setNueva(false)}
          onSaved={(c) => {
            setNueva(false);
            setDetalle(c);
          }}
        />
      )}
      {detalle && <DetalleCharla charla={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}
