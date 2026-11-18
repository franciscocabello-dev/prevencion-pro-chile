import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileDown,
  FileSpreadsheet,
  Megaphone,
  MonitorSmartphone,
  PenLine,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useStore } from '../../../services/store';
import type { Asistente, Charla, TipoCharla } from '../../../types';
import { TEMAS_CHARLA, TIPO_CHARLA_LABEL } from '../../../data/catalogos';
import { formatDate, nowTime, todayISO } from '../../../utils/date';
import { uid } from '../../../utils/id';
import { validateRut } from '../../../utils/rut';
import { generarActaCharla } from '../../../utils/pdfGenerator';
import { exportarAsistenciaCSV, exportarTodasCSV } from '../../../utils/csv';
import { formatDateTime, hashCharla, hashFirma, nuevoSesionId, payloadCharla, urlVerificacion } from '../../../utils/verification';
import { renderPlantilla } from '../../../utils/templateEngine';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, RutInput, Select, Tabs, TextArea, cx } from '../../ui';
import SignaturePad from '../../ui/SignaturePad';
import KioskMode from './KioskMode';

type Filtro = 'todas' | TipoCharla;

const emptyAsistente = () => ({ nombre: '', rut: '', cargo: '', firma: '' });
const PASOS = ['Tema', 'Firma relator', 'Asistentes', 'Cierre'];

function NuevaCharla({ onClose, onSaved }: { onClose: () => void; onSaved: (c: Charla) => void }) {
  const { company, state, rol, updateCompany, notify, firmaRelatorGuardada, guardarFirmaRelator } = useStore();
  const rubro = company.empresa.rubro;
  const [sesionId] = useState(() => nuevoSesionId(todayISO()));
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<TipoCharla>('charla5');
  const [temaId, setTemaId] = useState('');
  const [tema, setTema] = useState('');
  const [contenido, setContenido] = useState('');
  const [plantillaId, setPlantillaId] = useState('');
  const [fecha, setFecha] = useState(todayISO());
  const [hora, setHora] = useState(nowTime());
  const [duracion, setDuracion] = useState(5);
  const [area, setArea] = useState(company.areas[0] ?? '');
  const [relator, setRelator] = useState(state.usuario);
  const [cargoRelator, setCargoRelator] = useState(rol === 'prevencionista' ? 'Experto en Prevención de Riesgos' : rol === 'supervisor' ? 'Supervisor' : 'Jefatura');
  const [usarGuardada, setUsarGuardada] = useState(!!firmaRelatorGuardada);
  const [firmaNueva, setFirmaNueva] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [iniciadaEn, setIniciadaEn] = useState('');
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [nuevo, setNuevo] = useState(emptyAsistente());
  const [buscar, setBuscar] = useState('');
  const [kiosco, setKiosco] = useState(false);

  const firmaRelator = usarGuardada && firmaRelatorGuardada ? firmaRelatorGuardada : firmaNueva;

  const temas = useMemo(() => TEMAS_CHARLA.filter((t) => t.rubros === 'todos' || t.rubros.includes(rubro)), [rubro]);
  const otrosTemas = useMemo(() => TEMAS_CHARLA.filter((t) => !(t.rubros === 'todos' || t.rubros.includes(rubro))), [rubro]);
  // Plantillas aplicables a sesiones grupales (las de un trabajador se generan en Documentos)
  const plantillas = company.plantillas
    .filter((p) => p.categoria === 'charla5' || p.categoria === 'odi' || p.categoria === 'procedimiento')
    .sort((a, b) => Number(b.categoria === (tipo === 'odi' ? 'odi' : 'charla5')) - Number(a.categoria === (tipo === 'odi' ? 'odi' : 'charla5')));

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

  const aplicarPlantilla = () => {
    const pl = company.plantillas.find((p) => p.id === plantillaId);
    if (!pl) return;
    const texto = renderPlantilla(pl.cuerpo, { company, relator, fecha, tema, area });
    const base = TEMAS_CHARLA.find((x) => x.id === temaId)?.contenido;
    setContenido(base ? `${texto}\n\nPuntos clave: ${base}` : texto);
    notify(`Plantilla «${pl.nombre}» aplicada con variables reemplazadas`, 'info');
  };

  const sugeridos = company.trabajadores.filter(
    (t) => t.activo && !asistentes.some((a) => a.rut === t.rut) && (buscar ? `${t.nombre} ${t.rut}`.toLowerCase().includes(buscar.toLowerCase()) : t.area === area),
  );

  const rutValido = validateRut(nuevo.rut);
  const rutDuplicado = asistentes.some((a) => a.rut === nuevo.rut);
  const puedeAgregar = nuevo.nombre.trim().length > 3 && rutValido && !rutDuplicado && nuevo.cargo.trim() && nuevo.firma;

  const agregar = (a: Asistente) => setAsistentes((x) => (x.some((y) => y.rut === a.rut) ? x : [...x, a]));

  const agregarManual = () => {
    if (!puedeAgregar) return;
    agregar({ id: uid('as'), ...nuevo, nombre: nuevo.nombre.trim(), cargo: nuevo.cargo.trim(), firmadoEn: new Date().toISOString() });
    setNuevo(emptyAsistente());
    setBuscar('');
    notify(`${nuevo.nombre.split(' ')[0]} agregado a la lista`, 'info');
  };

  // QR de la sesión (en vivo, se actualiza con cada firma)
  const qrValue = useMemo(
    () =>
      urlVerificacion({
        v: 1,
        id: sesionId,
        k: 'charla',
        emp: company.empresa.rut,
        tit: tema.slice(0, 60),
        ts: iniciadaEn || new Date().toISOString(),
        rel: relator,
        n: asistentes.length,
        h: 'EN-CURSO',
      }),
    [sesionId, company.empresa.rut, tema, iniciadaEn, relator, asistentes.length],
  );

  const confirmarRelator = () => {
    if (!usarGuardada && recordar && firmaNueva) guardarFirmaRelator(firmaNueva);
    setIniciadaEn(new Date().toISOString());
    setStep(3);
  };

  const guardar = () => {
    const base: Charla = {
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
      sesionId,
      iniciadaEn,
      cerradaEn: new Date().toISOString(),
      plantillaId: plantillaId || undefined,
    };
    const charla = { ...base, hash: hashCharla(base) };
    updateCompany((c) => ({ ...c, charlas: [charla, ...c.charlas] }));
    notify('Sesión cerrada y sellada con QR de verificación');
    onSaved(charla);
  };

  const paso1Ok = tema.trim() && contenido.trim() && area && relator.trim();

  if (kiosco)
    return (
      <KioskMode
        sesionId={sesionId}
        tema={tema}
        relator={relator}
        area={area}
        qrValue={qrValue}
        nomina={company.trabajadores}
        asistentes={asistentes}
        onAdd={agregar}
        onExit={() => setKiosco(false)}
      />
    );

  return (
    <Modal
      title={`Nueva ${TIPO_CHARLA_LABEL[tipo].split(' (')[0]}`}
      onClose={() => {
        if (asistentes.length === 0 || confirm('¿Descartar la sesión en curso? Se perderán las firmas capturadas.')) onClose();
      }}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            Paso {step} de 4 · {PASOS[step - 1]}
          </span>
          <div className="flex gap-2">
            {step > 1 && step !== 3 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                Atrás
              </Button>
            )}
            {step === 1 && (
              <Button disabled={!paso1Ok} onClick={() => setStep(2)}>
                Continuar
              </Button>
            )}
            {step === 2 && (
              <Button disabled={!firmaRelator} icon={<PenLine className="size-4" />} onClick={confirmarRelator}>
                Firmar e iniciar sesión
              </Button>
            )}
            {step === 3 && (
              <Button disabled={asistentes.length === 0} onClick={() => setStep(4)}>
                Cerrar lista ({asistentes.length} firmas)
              </Button>
            )}
            {step === 4 && (
              <>
                <Button variant="secondary" onClick={() => setStep(3)}>
                  Agregar más
                </Button>
                <Button variant="success" icon={<CheckCircle2 className="size-4" />} onClick={guardar}>
                  Cerrar y sellar sesión
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {PASOS.map((l, i) => (
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
                className={cx('min-h-12 rounded-md border px-2 py-2 text-center text-xs font-semibold sm:text-sm', tipo === t ? 'border-navy bg-navy text-white' : 'border-slate-200 text-slate-600')}
              >
                {t === 'charla5' ? 'Charla 5 min' : t === 'capacitacion' ? 'Capacitación' : 'ODI (DS 44)'}
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
          <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-end">
            <Field label="Plantilla de texto (opcional)" className="flex-1" hint="Reemplaza {{EMPRESA}}, {{AREA}}, {{RELATOR}}, {{FECHA}}, {{TEMA}}…">
              <Select value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)} placeholder="Sin plantilla" options={plantillas.map((p) => ({ value: p.id, label: p.nombre }))} />
            </Field>
            <Button variant="secondary" icon={<Wand2 className="size-4" />} disabled={!plantillaId} onClick={aplicarPlantilla}>
              Aplicar
            </Button>
          </div>
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
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-navy">El relator firma una sola vez por sesión</p>
            <p className="text-slate-600">Su firma se aplica al acta completa. Los trabajadores firman después, uno a uno o en Modo Kiosco.</p>
          </div>
          {firmaRelatorGuardada && (
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setUsarGuardada(true)} className={cx('rounded-lg border p-3 text-left', usarGuardada ? 'border-ok bg-ok-50' : 'border-slate-200')}>
                <p className="text-sm font-semibold text-navy">Usar mi firma guardada</p>
                <img src={firmaRelatorGuardada} alt="Firma guardada" className="paper mt-2 h-16 w-full rounded border border-slate-200 object-contain" />
              </button>
              <button type="button" onClick={() => setUsarGuardada(false)} className={cx('rounded-lg border p-3 text-left', !usarGuardada ? 'border-ok bg-ok-50' : 'border-slate-200')}>
                <p className="text-sm font-semibold text-navy">Firmar de nuevo</p>
                <p className="mt-1 text-xs text-slate-500">Reemplaza la firma para esta sesión.</p>
              </button>
            </div>
          )}
          {(!firmaRelatorGuardada || !usarGuardada) && (
            <>
              <SignaturePad label={`Firma del relator: ${relator}`} value={firmaNueva} onChange={setFirmaNueva} />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="size-4 accent-navy" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
                Recordar mi firma en este dispositivo para próximas sesiones
              </label>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 rounded-lg border border-navy/15 p-4 sm:flex-row sm:items-center">
            <div className="paper mx-auto shrink-0 rounded-lg p-2 sm:mx-0">
              <QRCodeSVG value={qrValue} size={112} level="M" />
            </div>
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-navy sm:justify-start">
                <QrCode className="size-4" /> Sesión {sesionId}
              </p>
              <p className="text-xs text-slate-500">
                Iniciada {formatDateTime(iniciadaEn)} · Relator firmado ✓ · {asistentes.length} firma(s)
              </p>
              <Button block size="lg" variant="dark" icon={<MonitorSmartphone className="size-5" />} onClick={() => setKiosco(true)}>
                Iniciar Modo Kiosco
              </Button>
              <p className="text-[11px] text-slate-500">Pantalla completa para pasar el equipo trabajador por trabajador.</p>
            </div>
          </div>

          <details className="rounded-lg border border-slate-200">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-navy">Registro manual (uno por uno)</summary>
            <div className="space-y-3 border-t border-slate-100 p-3">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Buscar en nómina (por defecto: trabajadores del área)" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sugeridos.slice(0, 12).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNuevo({ nombre: t.nombre, rut: t.rut, cargo: t.cargo, firma: '' })}
                    className={cx('inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium [@media(pointer:fine)]:min-h-9', nuevo.rut === t.rut ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-navy hover:border-navy')}
                  >
                    {t.nombre.split(' ').slice(0, 2).join(' ')}
                  </button>
                ))}
                {sugeridos.length === 0 && <span className="text-xs text-slate-500">Sin coincidencias. Ingrese los datos manualmente.</span>}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Nombre completo" required className="sm:col-span-3">
                  <Input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre y apellidos" />
                </Field>
                <RutInput value={nuevo.rut} onChange={(v) => setNuevo({ ...nuevo, rut: v })} required />
                <Field label="Cargo" required className="sm:col-span-2">
                  <Input value={nuevo.cargo} onChange={(e) => setNuevo({ ...nuevo, cargo: e.target.value })} />
                </Field>
              </div>
              {rutDuplicado && <p className="text-xs font-medium text-crit">Este RUT ya firmó en esta actividad.</p>}
              <SignaturePad label="Firma del asistente" value={nuevo.firma} onChange={(f) => setNuevo((n) => ({ ...n, firma: f }))} />
              <Button block variant="success" size="lg" disabled={!puedeAgregar} icon={<UserPlus className="size-5" />} onClick={agregarManual}>
                Agregar asistente firmado
              </Button>
            </div>
          </details>

          {asistentes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-navy">Lista de asistencia ({asistentes.length})</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {asistentes.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy">{a.nombre}</span>
                      <span className="block text-xs text-slate-500">
                        {a.rut} · {a.cargo} · {formatDateTime(a.firmadoEn).split(' ')[1]}
                      </span>
                    </span>
                    <img src={a.firma} alt="Firma" className="paper h-9 w-24 rounded border border-slate-200 object-contain" />
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

      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-navy">{tema}</p>
            <p className="mt-1 text-slate-600">
              {formatDate(fecha)} · {hora} hrs · {duracion} min · {area}
            </p>
            <p className="mt-1 text-slate-600">
              Sesión {sesionId} · iniciada {formatDateTime(iniciadaEn)}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <img src={firmaRelator} alt="Firma relator" className="paper h-14 w-32 rounded border border-slate-200 object-contain" />
            <div className="text-sm">
              <p className="font-semibold text-navy">{relator}</p>
              <p className="text-xs text-slate-500">
                {cargoRelator} · huella {hashFirma(firmaRelator)}
              </p>
            </div>
          </div>
          <p className="flex items-start gap-2 rounded-lg bg-ok-50 p-3 text-sm text-ok-800">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Al cerrar, se registra la hora exacta y se calcula un sello SHA-256 sobre el contenido y las {asistentes.length + 1} firmas. Cualquier alteración posterior invalida el QR de verificación del acta.
          </p>
        </div>
      )}
    </Modal>
  );
}

function DetalleCharla({ charla, onClose }: { charla: Charla; onClose: () => void }) {
  const { company, can, updateCompany, notify } = useStore();
  const integra = !charla.hash || hashCharla(charla) === charla.hash;
  const qr = urlVerificacion(payloadCharla(company, charla));
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
            variant="secondary"
            icon={<FileSpreadsheet className="size-4" />}
            onClick={() => {
              exportarAsistenciaCSV(company, charla);
              notify('Lista de asistencia exportada (CSV para Excel)');
            }}
          >
            Exportar CSV / Excel
          </Button>
          <Button
            icon={<FileDown className="size-4" />}
            onClick={() => {
              generarActaCharla(company, charla);
              notify('Acta legal PDF con QR de verificación descargada');
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
          {integra ? (
            <Badge tone="ok" dot>
              Sello íntegro
            </Badge>
          ) : (
            <Badge tone="crit" dot>
              Contenido alterado
            </Badge>
          )}
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
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center">
          <div className="paper mx-auto shrink-0 rounded-lg p-1.5 sm:mx-0">
            <QRCodeSVG value={qr} size={96} level="M" />
          </div>
          <div className="min-w-0 flex-1 text-xs text-slate-600">
            <p className="text-sm font-semibold text-navy">Sesión {charla.sesionId ?? charla.id}</p>
            <p>Cierre: {formatDateTime(charla.cerradaEn)}</p>
            <p className="font-mono break-all">SHA-256 {charla.hash?.slice(0, 32).toUpperCase()}</p>
          </div>
          {charla.firmaRelator && <img src={charla.firmaRelator} alt="Firma relator" className="paper h-14 w-32 shrink-0 rounded border border-slate-200 object-contain" />}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Contenido</p>
          <p className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-line text-slate-700">{charla.contenido}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">Asistentes</p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {charla.asistentes.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.nombre}</span>
                  <span className="block text-xs text-slate-500">
                    {a.rut} · {a.cargo} · {formatDateTime(a.firmadoEn)}
                  </span>
                </span>
                {a.firma ? <img src={a.firma} alt="Firma" className="paper h-9 w-24 rounded border border-slate-200 object-contain" /> : <Badge tone="crit">Sin firma</Badge>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

export default function Charlas() {
  const { company, route, navigate, can, notify } = useStore();
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
    .filter((c) => !q || `${c.tema} ${c.relator} ${c.area} ${c.sesionId ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora));

  const count = (t: Filtro) => (t === 'todas' ? company.charlas.length : company.charlas.filter((c) => c.tipo === t).length);

  return (
    <div>
      <PageHeader
        title="Charlas y ODI"
        subtitle="Registre charlas con firma en el celular y obtenga el acta con QR"
        icon={<Megaphone className="size-6" />}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              disabled={!lista.length}
              onClick={() => {
                exportarTodasCSV(company, lista);
                notify(`Asistencia consolidada de ${lista.length} sesiones exportada`);
              }}
            >
              Exportar CSV
            </Button>
            {can('crearCharla') && (
              <Button icon={<Plus className="size-4" />} onClick={() => setNueva(true)}>
                Nueva charla
              </Button>
            )}
          </>
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
        <Input className="pl-9" placeholder="Buscar por tema, relator, área o ID de sesión" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {lista.length === 0 ? (
        <EmptyState icon={<BookOpen className="size-10" />} title="Sin registros" text="Registre la primera charla con firma táctil de los asistentes." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((c) => (
            <button key={c.id} type="button" onClick={() => setDetalle(c)} className="text-left">
              <Card className="h-full transition-colors hover:border-slate-400" bodyClass="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <Badge tone={c.tipo === 'odi' ? 'dark' : 'neutral'}>{c.tipo === 'charla5' ? 'Charla 5 min' : c.tipo === 'odi' ? 'ODI' : 'Capacitación'}</Badge>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Users className="size-3.5" /> {c.asistentes.length}
                  </span>
                </div>
                <p className="line-clamp-2 font-semibold text-navy">{c.tema}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {c.area} · {c.relator}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" /> {formatDate(c.fecha)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> {c.duracionMin} min
                  </span>
                  {c.sesionId && (
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <QrCode className="size-3.5" /> {c.sesionId}
                    </span>
                  )}
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
