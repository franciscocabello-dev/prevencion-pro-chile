import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, CheckCircle2, LogOut, PenLine, Search, UserPlus, Users } from 'lucide-react';
import type { Asistente, Trabajador } from '../../../types';
import { validateRut } from '../../../utils/rut';
import { uid } from '../../../utils/id';
import { Button, Field, Input, RutInput, cx } from '../../ui';
import SignaturePad from '../../ui/SignaturePad';

interface Props {
  sesionId: string;
  tema: string;
  relator: string;
  area: string;
  qrValue: string;
  nomina: Trabajador[];
  asistentes: Asistente[];
  onAdd: (a: Asistente) => void;
  onExit: () => void;
}

type Paso = 'identificar' | 'firmar' | 'listo';

/**
 * Modo Kiosco: pantalla completa para pasar el celular/tablet trabajador por trabajador.
 * Cada trabajador se identifica con un toque, firma y devuelve el equipo.
 */
export default function KioskMode({ sesionId, tema, relator, area, qrValue, nomina, asistentes, onAdd, onExit }: Props) {
  const [paso, setPaso] = useState<Paso>('identificar');
  const [q, setQ] = useState('');
  const [manual, setManual] = useState(false);
  const [persona, setPersona] = useState({ nombre: '', rut: '', cargo: '' });
  const [firma, setFirma] = useState('');
  const [ultimo, setUltimo] = useState('');
  const [verQR, setVerQR] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Pantalla completa real cuando el navegador lo permite (Android/escritorio; iOS usa overlay fijo)
  useEffect(() => {
    const el = rootRef.current;
    if (el?.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => undefined);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // Tras firmar, vuelve automáticamente a la pantalla de identificación
  useEffect(() => {
    if (paso !== 'listo') return;
    const t = setTimeout(() => setPaso('identificar'), 2800);
    return () => clearTimeout(t);
  }, [paso]);

  const firmados = useMemo(() => new Set(asistentes.map((a) => a.rut)), [asistentes]);
  const pendientes = nomina.filter(
    (t) => t.activo && !firmados.has(t.rut) && (q ? `${t.nombre} ${t.rut}`.toLowerCase().includes(q.toLowerCase()) : t.area === area || nomina.length <= 20),
  );

  const elegir = (t: Pick<Trabajador, 'nombre' | 'rut' | 'cargo'>) => {
    setPersona({ nombre: t.nombre, rut: t.rut, cargo: t.cargo });
    setFirma('');
    setManual(false);
    setPaso('firmar');
  };

  const manualOk = persona.nombre.trim().length > 3 && validateRut(persona.rut) && !firmados.has(persona.rut) && persona.cargo.trim();

  const confirmar = () => {
    if (!firma) return;
    onAdd({ id: uid('as'), nombre: persona.nombre.trim(), rut: persona.rut, cargo: persona.cargo.trim(), firma, firmadoEn: new Date().toISOString() });
    setUltimo(persona.nombre.split(' ')[0]);
    setPersona({ nombre: '', rut: '', cargo: '' });
    setFirma('');
    setQ('');
    setPaso('listo');
  };

  return (
    <div ref={rootRef} className="fixed inset-0 z-[70] flex flex-col bg-surface" role="dialog" aria-modal="true" aria-label="Modo kiosco de firmas">
      {/* Cabecera de sesión */}
      <header className="flex items-center gap-3 bg-navy px-4 py-3 text-white pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => setVerQR((v) => !v)} className="paper shrink-0 rounded-md p-1" aria-label="Ver QR de sesión">
          <QRCodeSVG value={qrValue} size={40} level="M" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{tema}</p>
          <p className="truncate text-xs text-slate-300">
            {sesionId} · Relator: {relator}
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-ok px-3 py-1 text-sm font-bold text-white">
          <Users className="size-4" /> {asistentes.length}
        </span>
        <button
          type="button"
          onClick={() => {
            if (asistentes.length === 0 || confirm('¿Terminar el modo kiosco y volver al registro de la charla?')) onExit();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10"
        >
          <LogOut className="size-4" /> <span className="hidden sm:inline">Terminar</span>
        </button>
      </header>

      {verQR && (
        <div className="flex flex-col items-center gap-2 border-b border-slate-200 bg-white px-4 py-4 text-center">
          <div className="paper rounded-lg p-3">
            <QRCodeSVG value={qrValue} size={180} level="M" />
          </div>
          <p className="max-w-sm text-xs text-slate-500">
            QR de la sesión <b>{sesionId}</b>. Identifica esta charla y se imprime en el acta PDF para verificar su autenticidad.
          </p>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-5">
        {paso === 'identificar' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-2xl font-black text-navy">¿Quién va a firmar?</p>
              <p className="text-sm text-slate-500">Toque su nombre. Luego firme con el dedo y devuelva el equipo.</p>
            </div>
            {!manual ? (
              <>
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" />
                  <Input className="py-3.5 pl-11 text-base" placeholder="Buscar mi nombre o RUT" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {pendientes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => elegir(t)}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-4 text-left transition-colors hover:border-navy active:scale-[0.99]"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy text-base font-bold text-white">
                        {t.nombre
                          .split(' ')
                          .slice(0, 2)
                          .map((x) => x[0])
                          .join('')}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-base font-bold text-navy">{t.nombre}</span>
                        <span className="block text-xs text-slate-500">
                          {t.rut} · {t.cargo}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                {pendientes.length === 0 && <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">No hay más trabajadores pendientes en la nómina{q ? ' para esa búsqueda' : ' del área'}.</p>}
                <Button block size="lg" variant="secondary" icon={<UserPlus className="size-5" />} onClick={() => setManual(true)}>
                  No aparezco en la lista
                </Button>
              </>
            ) : (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                <Field label="Nombre completo" required>
                  <Input className="py-3 text-base" value={persona.nombre} onChange={(e) => setPersona({ ...persona, nombre: e.target.value })} />
                </Field>
                <RutInput value={persona.rut} onChange={(v) => setPersona({ ...persona, rut: v })} required />
                {firmados.has(persona.rut) && <p className="text-xs font-medium text-crit">Este RUT ya firmó en esta sesión.</p>}
                <Field label="Cargo" required>
                  <Input className="py-3 text-base" value={persona.cargo} onChange={(e) => setPersona({ ...persona, cargo: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="lg" variant="secondary" onClick={() => setManual(false)}>
                    Volver
                  </Button>
                  <Button size="lg" disabled={!manualOk} onClick={() => setPaso('firmar')}>
                    Continuar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {paso === 'firmar' && (
          <div className="flex flex-1 flex-col gap-4">
            <button type="button" onClick={() => setPaso('identificar')} className="flex items-center gap-1 self-start text-sm font-semibold text-slate-500">
              <ArrowLeft className="size-4" /> No soy yo
            </button>
            <div className="rounded-lg bg-white p-4 text-center border border-slate-200">
              <p className="text-2xl font-black text-navy">{persona.nombre}</p>
              <p className="text-sm text-slate-500">
                RUT {persona.rut} · {persona.cargo}
              </p>
              <p className="mt-2 text-xs text-slate-500">Declaro haber participado y comprendido la actividad «{tema}».</p>
            </div>
            <SignaturePad label="Firme con el dedo" value={firma} onChange={setFirma} height={260} />
            <Button block size="lg" variant="success" className="py-5 text-lg" icon={<PenLine className="size-6" />} disabled={!firma} onClick={confirmar}>
              Confirmar mi firma
            </Button>
          </div>
        )}

        {paso === 'listo' && (
          <button type="button" onClick={() => setPaso('identificar')} className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <CheckCircle2 className="size-28 text-ok" />
            <p className="text-3xl font-black text-navy">¡Gracias, {ultimo}!</p>
            <p className="text-lg text-slate-600">Firma registrada. Entregue el equipo al siguiente trabajador.</p>
            <p className="text-xs text-slate-400">Toque para continuar</p>
          </button>
        )}
      </main>

      <footer className={cx('border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-500 pb-[max(0.5rem,env(safe-area-inset-bottom))]')}>
        {asistentes.length} firma(s) registradas en esta sesión · hora exacta y huella digital quedan selladas en el acta
      </footer>
    </div>
  );
}
